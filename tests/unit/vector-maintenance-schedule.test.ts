import { describe, expect, it } from "vitest";
import {
  BACKOFF_BASE_MS,
  DEBOUNCE_MS,
  FOLLOW_UP_MS,
  FRAGMENT_THRESHOLD,
  MAX_CONSECUTIVE_FAILURES,
  MIN_INTERVAL_MS,
  PRUNABLE_VERSIONS_THRESHOLD,
} from "../../src/main/services/vector-maintenance/constants";
import {
  applyOutcome,
  evaluateGate,
  initialState,
  markRunning,
  needsMaintenance,
  nextAction,
  recordWrite,
  requestRun,
  type MaintenanceState,
} from "../../src/main/services/vector-maintenance/schedule";

// 116 (contracts C3, data-model): hàm thuần lên lịch bảo trì — đồng hồ là tham số `now`.

const T0 = 1_000_000_000;
const stats = (fragmentCount: number, prunableVersions = 0) => ({
  fragmentCount,
  rowCount: 100,
  prunableVersions,
});
const doneOutcome = (fragmentsBefore: number, fragmentsAfter: number) =>
  ({
    kind: "done",
    fragmentsBefore,
    fragmentsAfter,
    versionsRemoved: 0,
    bytesFreed: 0,
    durationMs: 5,
  }) as const;

/** Chạy một lần trọn: markRunning ở `at` rồi applyOutcome ở `at`. */
function ranAt(
  s: MaintenanceState,
  at: number,
  outcome: Parameters<typeof applyOutcome>[1],
) {
  return applyOutcome(markRunning(s, at), outcome, at);
}

describe("nextAction — kích hoạt + debounce", () => {
  it("trạng thái đầu ⇒ idle", () => {
    expect(nextAction(initialState(), T0)).toEqual({ kind: "idle" });
  });

  it("ghi ⇒ chờ DEBOUNCE_MS; ghi tiếp dời mốc; đủ yên ⇒ check(write)", () => {
    let s = recordWrite(initialState(), T0);
    expect(s.dirtyWrites).toBe(1);
    expect(nextAction(s, T0)).toEqual({
      kind: "wait",
      delayMs: DEBOUNCE_MS,
      trigger: "write",
    });
    s = recordWrite(s, T0 + 30_000);
    expect(s.dirtyWrites).toBe(2);
    expect(nextAction(s, T0 + DEBOUNCE_MS)).toEqual({
      kind: "wait",
      delayMs: 30_000,
      trigger: "write",
    });
    expect(nextAction(s, T0 + 30_000 + DEBOUNCE_MS)).toEqual({
      kind: "check",
      trigger: "write",
    });
  });

  it("requestRun startup có trễ; reindex không ghi gần đây ⇒ check ngay", () => {
    const st = requestRun(initialState(), "startup", T0, 45_000);
    expect(nextAction(st, T0)).toEqual({
      kind: "wait",
      delayMs: 45_000,
      trigger: "startup",
    });
    const rx = requestRun(initialState(), "reindex", T0);
    expect(nextAction(rx, T0)).toEqual({ kind: "check", trigger: "reindex" });
  });

  it("requestRun ngay sau đợt ghi vẫn chờ kho yên (debounce)", () => {
    const s = requestRun(recordWrite(initialState(), T0), "reindex", T0 + 1000);
    expect(nextAction(s, T0 + 1000)).toEqual({
      kind: "wait",
      delayMs: DEBOUNCE_MS - 1000,
      trigger: "reindex",
    });
  });

  it("trần tần suất: sau một lần chạy, lần kế không trước lastRunAt + MIN_INTERVAL_MS", () => {
    const s = recordWrite(
      ranAt(initialState(), T0, doneOutcome(10, 10)),
      T0 + 1,
    );
    expect(nextAction(s, T0 + 1 + DEBOUNCE_MS)).toEqual({
      kind: "wait",
      delayMs: MIN_INTERVAL_MS - 1 - DEBOUNCE_MS,
      trigger: "write",
    });
  });

  it("đang chạy ⇒ idle; ghi trong lúc chạy được giữ cho lần sau", () => {
    let s = markRunning(recordWrite(initialState(), T0), T0 + DEBOUNCE_MS);
    expect(s.running).toBe(true);
    expect(nextAction(s, T0 + DEBOUNCE_MS)).toEqual({ kind: "idle" });
    s = recordWrite(s, T0 + DEBOUNCE_MS + 10);
    s = applyOutcome(s, doneOutcome(70, 1), T0 + DEBOUNCE_MS + 20);
    expect(s.running).toBe(false);
    expect(s.dirtyWrites).toBe(1);
    expect(nextAction(s, T0 + DEBOUNCE_MS + 20).kind).toBe("wait");
  });
});

describe("applyOutcome", () => {
  it("done có gộp ⇒ follow-up sau FOLLOW_UP_MS; done không gộp ⇒ không follow-up", () => {
    const merged = ranAt(
      recordWrite(initialState(), T0),
      T0 + DEBOUNCE_MS,
      doneOutcome(70, 1),
    );
    expect(merged.dirtyWrites).toBe(0);
    expect(merged.consecutiveFailures).toBe(0);
    expect(merged.followUpAt).toBe(T0 + DEBOUNCE_MS + FOLLOW_UP_MS);
    expect(nextAction(merged, T0 + DEBOUNCE_MS + FOLLOW_UP_MS)).toEqual({
      kind: "check",
      trigger: "followUp",
    });
    const flat = ranAt(initialState(), T0, doneOutcome(1, 1));
    expect(flat.followUpAt).toBeNull();
    expect(nextAction(flat, T0 + 10 * FOLLOW_UP_MS)).toEqual({ kind: "idle" });
  });

  it("chạy follow-up xoá mốc follow-up", () => {
    const merged = ranAt(initialState(), T0, doneOutcome(70, 1));
    const at = T0 + FOLLOW_UP_MS;
    const s = ranAt(merged, at, doneOutcome(1, 1));
    expect(s.followUpAt).toBeNull();
    expect(nextAction(s, at + 10 * FOLLOW_UP_MS)).toEqual({ kind: "idle" });
  });

  it("deferred busy ⇒ thử lại sau DEBOUNCE_MS, không tính lỗi, không tính là đã chạy", () => {
    const s = ranAt(requestRun(initialState(), "reindex", T0), T0, {
      kind: "deferred",
      reason: "busy",
    });
    expect(s.consecutiveFailures).toBe(0);
    expect(s.lastRunAt).toBeNull();
    expect(nextAction(s, T0)).toEqual({
      kind: "wait",
      delayMs: DEBOUNCE_MS,
      trigger: "reindex",
    });
  });

  it("conflict ⇒ không tính lỗi nhưng optimize đã chạy ⇒ áp trần tần suất (security review)", () => {
    const s = ranAt(requestRun(initialState(), "reindex", T0), T0, {
      kind: "deferred",
      reason: "conflict",
    });
    expect(s.consecutiveFailures).toBe(0);
    expect(s.lastRunAt).toBe(T0);
    expect(nextAction(s, T0)).toEqual({
      kind: "wait",
      delayMs: MIN_INTERVAL_MS,
      trigger: "reindex",
    });
  });

  it("deferred noTable/belowThreshold/lowDisk ⇒ hết việc chờ", () => {
    for (const reason of ["noTable", "belowThreshold", "lowDisk"] as const) {
      const s = ranAt(requestRun(initialState(), "startup", T0), T0, {
        kind: "deferred",
        reason,
      });
      expect(nextAction(s, T0 + 10 * MIN_INTERVAL_MS)).toEqual({
        kind: "idle",
      });
    }
  });

  it("lỗi ⇒ backoff 10 rồi 20 phút; lỗi thứ 3 ⇒ disabled tới lần khởi động sau", () => {
    const err = { kind: "error", errorType: "Error" } as const;
    let s = ranAt(requestRun(initialState(), "startup", T0), T0, err);
    expect(s.consecutiveFailures).toBe(1);
    expect(nextAction(s, T0)).toEqual({
      kind: "wait",
      delayMs: BACKOFF_BASE_MS,
      trigger: "startup",
    });
    const t2 = T0 + BACKOFF_BASE_MS;
    s = ranAt(s, t2, err);
    expect(nextAction(s, t2)).toEqual({
      kind: "wait",
      delayMs: BACKOFF_BASE_MS * 2,
      trigger: "startup",
    });
    const t3 = t2 + BACKOFF_BASE_MS * 2;
    s = ranAt(s, t3, err);
    expect(s.consecutiveFailures).toBe(MAX_CONSECUTIVE_FAILURES);
    expect(s.disabled).toBe(true);
    expect(
      nextAction(recordWrite(s, t3 + 1), t3 + 10 * MIN_INTERVAL_MS),
    ).toEqual({
      kind: "idle",
    });
  });

  it("thành công sau lỗi ⇒ reset bộ đếm lỗi", () => {
    const err = { kind: "error", errorType: "Error" } as const;
    const s = ranAt(
      ranAt(initialState(), T0, err),
      T0 + BACKOFF_BASE_MS,
      doneOutcome(1, 1),
    );
    expect(s.consecutiveFailures).toBe(0);
  });

  it("không mutate input", () => {
    const s0 = initialState();
    const frozen = Object.freeze({ ...s0 });
    expect(() => recordWrite(frozen, T0)).not.toThrow();
    expect(() => requestRun(frozen, "startup", T0)).not.toThrow();
    expect(() => markRunning(frozen, T0)).not.toThrow();
    const r = Object.freeze(markRunning(s0, T0));
    expect(() => applyOutcome(r, doneOutcome(70, 1), T0)).not.toThrow();
    expect(s0).toEqual(initialState());
  });
});

describe("cổng bảo trì", () => {
  it("needsMaintenance theo ngưỡng fragment / phiên bản cũ", () => {
    expect(
      needsMaintenance(
        stats(FRAGMENT_THRESHOLD - 1, PRUNABLE_VERSIONS_THRESHOLD - 1),
      ),
    ).toBe(false);
    expect(needsMaintenance(stats(FRAGMENT_THRESHOLD))).toBe(true);
    expect(needsMaintenance(stats(1, PRUNABLE_VERSIONS_THRESHOLD))).toBe(true);
  });

  it("evaluateGate: busy > noTable > belowThreshold > lowDisk", () => {
    const big = stats(FRAGMENT_THRESHOLD);
    expect(
      evaluateGate({ busy: true, stats: null, freeBytes: 0, storeBytes: 10 }),
    ).toEqual({ run: false, reason: "busy" });
    expect(
      evaluateGate({ busy: false, stats: null, freeBytes: 0, storeBytes: 10 }),
    ).toEqual({ run: false, reason: "noTable" });
    expect(
      evaluateGate({
        busy: false,
        stats: stats(1),
        freeBytes: 0,
        storeBytes: 10,
      }),
    ).toEqual({ run: false, reason: "belowThreshold" });
    expect(
      evaluateGate({ busy: false, stats: big, freeBytes: 19, storeBytes: 10 }),
    ).toEqual({ run: false, reason: "lowDisk" });
    expect(
      evaluateGate({ busy: false, stats: big, freeBytes: 20, storeBytes: 10 }),
    ).toEqual({ run: true });
  });
});
