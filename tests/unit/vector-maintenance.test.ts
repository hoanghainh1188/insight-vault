import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  VectorOptimizeResult,
  VectorStoreStats,
} from "../../src/main/services/ingestion/vector-store";
import {
  BACKOFF_BASE_MS,
  DEBOUNCE_MS,
  FOLLOW_UP_MS,
  MIN_INTERVAL_MS,
  RETENTION_MS,
  STARTUP_DELAY_MS,
} from "../../src/main/services/vector-maintenance/constants";
import { createVectorMaintenance } from "../../src/main/services/vector-maintenance/maintenance";

// 116 (contracts C4): bộ điều phối bảo trì — đồng hồ + hẹn giờ giả (vi.useFakeTimers), store giả.

const ALLOWED_META = new Set([
  "trigger",
  "reason",
  "fragmentsBefore",
  "fragmentsAfter",
  "prunableVersions",
  "versionsRemoved",
  "bytesFreed",
  "durationMs",
  "errorType",
  "consecutiveFailures",
  "disabled",
]);

interface Harness {
  m: ReturnType<typeof createVectorMaintenance>;
  store: {
    stats: ReturnType<typeof vi.fn>;
    optimize: ReturnType<typeof vi.fn>;
    activeOperations: ReturnType<typeof vi.fn>;
  };
  busy: { value: boolean };
  freeBytes: ReturnType<typeof vi.fn>;
  events: {
    level: "info" | "error";
    event: string;
    meta: Record<string, unknown>;
  }[];
}

const dirty: VectorStoreStats = {
  fragmentCount: 120,
  rowCount: 1000,
  prunableVersions: 0,
};
const clean: VectorStoreStats = {
  fragmentCount: 1,
  rowCount: 1000,
  prunableVersions: 0,
};
const merged: VectorOptimizeResult = {
  fragmentsRemoved: 120,
  fragmentsAdded: 1,
  versionsRemoved: 3,
  bytesFreed: 4096,
};

function setup(
  opts: { stats?: VectorStoreStats | null; free?: number } = {},
): Harness {
  const events: Harness["events"] = [];
  const busy = { value: false };
  const store = {
    stats: vi.fn(async () => (opts.stats === undefined ? dirty : opts.stats)),
    optimize: vi.fn(async () => merged),
    activeOperations: vi.fn(() => 0),
  };
  const freeBytes = vi.fn(async () => opts.free ?? 1e12);
  const m = createVectorMaintenance({
    store,
    isBusy: () => busy.value,
    freeBytes,
    storeBytes: async () => 1e6,
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    log: (event, meta) => events.push({ level: "info", event, meta }),
    logError: (event, meta) => events.push({ level: "error", event, meta }),
  });
  return { m, store, busy, freeBytes, events };
}

const names = (h: Harness) => h.events.map((e) => e.event);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000_000);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("US1 — kích hoạt + chạy", () => {
  it("ghi ⇒ sau DEBOUNCE_MS gọi optimize(RETENTION_MS) đúng 1 lần, log start + done đúng meta", async () => {
    const h = setup();
    h.m.notifyWrite();
    h.m.notifyWrite();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
    expect(h.store.optimize).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.store.optimize).toHaveBeenCalledTimes(1);
    expect(h.store.optimize).toHaveBeenCalledWith(RETENTION_MS);
    expect(h.store.stats).toHaveBeenCalledWith(RETENTION_MS);
    expect(names(h)).toEqual([
      "vector.maintenance.start",
      "vector.maintenance.done",
    ]);
    const done = h.events[1]!.meta;
    expect(done).toMatchObject({
      trigger: "write",
      fragmentsBefore: 120,
      fragmentsAfter: 1,
      versionsRemoved: 3,
      bytesFreed: 4096,
    });
    expect(typeof done["durationMs"]).toBe("number");
    for (const e of h.events) {
      for (const k of Object.keys(e.meta))
        expect(ALLOWED_META.has(k)).toBe(true);
    }
  });

  it("scheduleStartup ⇒ kiểm sau STARTUP_DELAY_MS", async () => {
    const h = setup();
    h.m.scheduleStartup();
    await vi.advanceTimersByTimeAsync(STARTUP_DELAY_MS - 1);
    expect(h.store.stats).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.store.optimize).toHaveBeenCalledTimes(1);
    expect(h.events[0]!.meta["trigger"]).toBe("startup");
  });

  it("notifyReindexDone ⇒ kiểm ngay", async () => {
    const h = setup();
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.store.optimize).toHaveBeenCalledTimes(1);
    expect(h.events[0]!.meta["trigger"]).toBe("reindex");
  });

  it("dưới ngưỡng ⇒ skip belowThreshold, không optimize, không đo đĩa", async () => {
    const h = setup({ stats: clean });
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.store.optimize).not.toHaveBeenCalled();
    expect(h.freeBytes).not.toHaveBeenCalled();
    expect(h.events).toEqual([
      {
        level: "info",
        event: "vector.maintenance.skip",
        meta: { trigger: "reindex", reason: "belowThreshold" },
      },
    ]);
  });

  it("bảng chưa có ⇒ skip noTable", async () => {
    const h = setup({ stats: null });
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.store.optimize).not.toHaveBeenCalled();
    expect(h.events[0]!.meta).toEqual({
      trigger: "reindex",
      reason: "noTable",
    });
  });

  it("có gộp ⇒ kiểm follow-up sau FOLLOW_UP_MS để dọn phiên bản", async () => {
    const h = setup();
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(0);
    h.store.stats.mockResolvedValue({ ...clean, prunableVersions: 50 });
    h.store.optimize.mockResolvedValue({
      fragmentsRemoved: 0,
      fragmentsAdded: 0,
      versionsRemoved: 50,
      bytesFreed: 9999,
    });
    await vi.advanceTimersByTimeAsync(FOLLOW_UP_MS);
    expect(h.store.optimize).toHaveBeenCalledTimes(2);
    expect(h.events.at(-1)!.meta).toMatchObject({
      trigger: "followUp",
      versionsRemoved: 50,
      bytesFreed: 9999,
    });
    // Không gộp thêm ⇒ không hẹn follow-up nữa.
    await vi.advanceTimersByTimeAsync(10 * FOLLOW_UP_MS);
    expect(h.store.optimize).toHaveBeenCalledTimes(2);
  });

  it("trần tần suất: ghi ngay sau một lần chạy ⇒ chờ tới MIN_INTERVAL_MS", async () => {
    const h = setup();
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(0);
    h.m.notifyWrite();
    await vi.advanceTimersByTimeAsync(MIN_INTERVAL_MS - 1);
    expect(h.store.optimize).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.store.optimize).toHaveBeenCalledTimes(2);
  });

  it("dispose huỷ mọi hẹn giờ", async () => {
    const h = setup();
    h.m.notifyWrite();
    h.m.dispose();
    await vi.advanceTimersByTimeAsync(10 * MIN_INTERVAL_MS);
    expect(h.store.stats).not.toHaveBeenCalled();
    h.m.notifyWrite();
    await vi.advanceTimersByTimeAsync(10 * MIN_INTERVAL_MS);
    expect(h.store.stats).not.toHaveBeenCalled();
  });
});

describe("US3 — không cản trở người dùng", () => {
  it("bận ⇒ skip busy (log 1 lần dù lặp), không đo, thử lại sau DEBOUNCE_MS; hết bận ⇒ chạy", async () => {
    const h = setup();
    h.busy.value = true;
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(h.store.stats).not.toHaveBeenCalled();
    expect(h.events).toEqual([
      {
        level: "info",
        event: "vector.maintenance.skip",
        meta: { trigger: "reindex", reason: "busy" },
      },
    ]);
    h.busy.value = false;
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(h.store.optimize).toHaveBeenCalledTimes(1);
  });

  it("có thao tác đọc/ghi đang chạy (activeOperations > 0) ⇒ coi là bận", async () => {
    const h = setup();
    h.store.activeOperations.mockReturnValue(1);
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.store.optimize).not.toHaveBeenCalled();
    expect(h.events[0]!.meta["reason"]).toBe("busy");
  });

  it("bận phát sinh trong lúc đo ⇒ không optimize, skip busy (đóng kẽ hở với sao lưu)", async () => {
    const h = setup();
    h.freeBytes.mockImplementation(async () => {
      h.busy.value = true; // sao lưu lấy khoá đúng lúc đang đo đĩa
      return 1e12;
    });
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.store.optimize).not.toHaveBeenCalled();
    expect(h.events.at(-1)!.meta["reason"]).toBe("busy");
  });

  it("thiếu dung lượng ⇒ skip lowDisk", async () => {
    const h = setup({ free: 1e6 });
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.store.optimize).not.toHaveBeenCalled();
    expect(h.events[0]!.meta["reason"]).toBe("lowDisk");
  });

  it("xung đột commit ⇒ skip conflict, không tính lỗi, thử lại sau MIN_INTERVAL_MS", async () => {
    const h = setup();
    h.store.optimize.mockRejectedValueOnce(
      new Error("Retryable commit conflict for version 9"),
    );
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(0);
    expect(names(h)).toEqual([
      "vector.maintenance.start",
      "vector.maintenance.skip",
    ]);
    expect(h.events[1]!.meta).toEqual({
      trigger: "reindex",
      reason: "conflict",
    });
    await vi.advanceTimersByTimeAsync(MIN_INTERVAL_MS - 1);
    expect(h.store.optimize).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.store.optimize).toHaveBeenCalledTimes(2);
  });

  it("đo dung lượng trống lỗi (statfs ném) ⇒ hoãn lowDisk, không tính lỗi (security review)", async () => {
    const h = setup();
    h.freeBytes.mockRejectedValue(new Error("EIO"));
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.store.optimize).not.toHaveBeenCalled();
    expect(h.events).toEqual([
      {
        level: "info",
        event: "vector.maintenance.skip",
        meta: { trigger: "reindex", reason: "lowDisk" },
      },
    ]);
  });

  it("lỗi ⇒ logError (không message), backoff 10 → 20 phút, lỗi thứ 3 ⇒ ngưng; không bao giờ ném", async () => {
    const h = setup();
    h.store.optimize.mockRejectedValue(
      new TypeError("secret /Users/x/doc.pdf"),
    );
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.store.optimize).toHaveBeenCalledTimes(1);
    const err = h.events.find((e) => e.level === "error")!;
    expect(err).toEqual({
      level: "error",
      event: "vector.maintenance.error",
      meta: {
        trigger: "reindex",
        errorType: "TypeError",
        consecutiveFailures: 1,
        disabled: false,
      },
    });
    expect(JSON.stringify(h.events)).not.toContain("secret");
    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS);
    expect(h.store.optimize).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS * 2);
    expect(h.store.optimize).toHaveBeenCalledTimes(3);
    expect(h.events.at(-1)!.meta).toMatchObject({
      consecutiveFailures: 3,
      disabled: true,
    });
    h.m.notifyWrite();
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(100 * MIN_INTERVAL_MS);
    expect(h.store.optimize).toHaveBeenCalledTimes(3);
    expect(h.events.at(-1)!.meta).toEqual({
      trigger: "write",
      reason: "disabled",
    });
  });

  it("store/freeBytes/isBusy ném ⇒ nuốt thành lỗi, không ném ra ngoài", async () => {
    const h = setup();
    h.store.stats.mockRejectedValue(new RangeError("x"));
    expect(() => h.m.notifyReindexDone()).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.events.at(-1)!.meta["errorType"]).toBe("RangeError");
  });

  it("whenIdle: rảnh ⇒ true ngay; đang chạy ⇒ chờ xong; quá hạn ⇒ false", async () => {
    const h = setup();
    expect(await h.m.whenIdle(1000)).toBe(true);

    let release: (v: VectorOptimizeResult) => void = () => undefined;
    h.store.optimize.mockImplementation(
      () => new Promise<VectorOptimizeResult>((r) => (release = r)),
    );
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.m.isRunning()).toBe(true);

    const late = h.m.whenIdle(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await late).toBe(false);

    const ok = h.m.whenIdle(60_000);
    release(merged);
    await vi.advanceTimersByTimeAsync(0);
    expect(await ok).toBe(true);
    expect(h.m.isRunning()).toBe(false);
  });

  it("whenIdle chờ cả pha đo trước optimize (running bật từ đầu lần kiểm)", async () => {
    const h = setup();
    let releaseStats: (v: VectorStoreStats) => void = () => undefined;
    h.store.stats.mockImplementationOnce(
      () => new Promise<VectorStoreStats>((r) => (releaseStats = r)),
    );
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.m.isRunning()).toBe(true);
    const idle = h.m.whenIdle(60_000);
    releaseStats(dirty);
    await vi.advanceTimersByTimeAsync(0);
    expect(await idle).toBe(true);
  });

  it("dispose ⇒ whenIdle đang chờ trả false ngay (không treo lúc thoát)", async () => {
    const h = setup();
    h.store.optimize.mockImplementation(() => new Promise(() => undefined));
    h.m.notifyReindexDone();
    await vi.advanceTimersByTimeAsync(0);
    const idle = h.m.whenIdle(60_000);
    h.m.dispose();
    expect(await idle).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("setTimer ném sau một lần chạy ⇒ không unhandled rejection (code review)", async () => {
    let calls = 0;
    const m = createVectorMaintenance({
      store: {
        stats: async () => dirty,
        optimize: async () => merged,
        activeOperations: () => 0,
      },
      isBusy: () => false,
      freeBytes: async () => 1e12,
      storeBytes: async () => 1e6,
      now: () => Date.now(),
      setTimer: () => {
        calls += 1;
        throw new Error("timer");
      },
      clearTimer: () => undefined,
      log: () => undefined,
      logError: () => undefined,
    });
    expect(() => m.notifyReindexDone()).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1); // follow-up được hẹn (và ném) — bị nuốt
    expect(m.isRunning()).toBe(false);
  });
});
