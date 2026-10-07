import type { VectorStore } from "../ingestion/vector-store";
import { classifyOptimizeError } from "./classify-error";
import { RETENTION_MS, STARTUP_DELAY_MS } from "./constants";
import {
  applyOutcome,
  evaluateGate,
  initialState,
  markRunning,
  needsMaintenance,
  nextAction,
  recordWrite,
  requestRun,
  type MaintenanceOutcome,
  type MaintenanceState,
  type Trigger,
} from "./schedule";

// 116 (contracts C4): bộ điều phối bảo trì kho vector ở main. Quyết định "khi nào" nằm ở schedule.ts (thuần);
// file này chỉ hẹn giờ, đo kho, gọi optimize, ghi nhật ký. Single-flight; KHÔNG BAO GIỜ ném ra ngoài — lỗi bảo
// trì không được ảnh hưởng nạp/hỏi đáp/sao lưu (FR-016).

type LogFn = (event: string, meta: Record<string, unknown>) => void;

export interface VectorMaintenanceDeps {
  store: Pick<VectorStore, "stats" | "optimize" | "activeReads">;
  /** Bận theo định nghĩa chung của vault (isVaultBusy) — nguồn đang xử lý, reindex, sao lưu/khôi phục. */
  isBusy: () => boolean;
  freeBytes: () => Promise<number>;
  storeBytes: () => Promise<number>;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  log: LogFn;
  logError: LogFn;
}

export interface VectorMaintenance {
  notifyWrite(): void;
  /** Một lần bắt kịp sau STARTUP_DELAY_MS (vault cũ đã phình sẵn). */
  scheduleStartup(): void;
  notifyReindexDone(): void;
  isRunning(): boolean;
  /** true khi không còn lần bảo trì nào đang chạy; false nếu quá `timeoutMs`. */
  whenIdle(timeoutMs: number): Promise<boolean>;
  /** Huỷ hẹn giờ (thoát app). Không chờ lần đang chạy — optimize commit nguyên tử (research R4). */
  dispose(): void;
}

function errorTypeOf(e: unknown): string {
  return e instanceof Error ? e.constructor.name : typeof e;
}

export function createVectorMaintenance(
  deps: VectorMaintenanceDeps,
): VectorMaintenance {
  let state: MaintenanceState = initialState();
  let timer: unknown = null;
  let disposed = false;
  /** Lý do "skip" vừa log — cùng lý do lặp lại không log nữa (tránh spam mỗi phút khi bận lâu). */
  let lastSkip: string | null = null;
  let idleWaiters: (() => void)[] = [];

  const busyNow = (): boolean => deps.isBusy() || deps.store.activeReads() > 0;

  const skip = (trigger: Trigger, reason: string): void => {
    if (reason === lastSkip) return;
    lastSkip = reason;
    deps.log("vector.maintenance.skip", { trigger, reason });
  };

  /** Một lần kiểm: bận → đo → cổng → optimize. Trả kết quả cho schedule (không ném). */
  const attempt = async (trigger: Trigger): Promise<MaintenanceOutcome> => {
    if (busyNow()) return { kind: "deferred", reason: "busy" };
    const stats = await deps.store.stats(RETENTION_MS);
    if (stats === null) return { kind: "deferred", reason: "noTable" };
    if (!needsMaintenance(stats)) {
      return { kind: "deferred", reason: "belowThreshold" };
    }
    const [freeBytes, storeBytes] = await Promise.all([
      deps.freeBytes(),
      deps.storeBytes(),
    ]);
    // Kiểm bận lần nữa NGAY trước optimize: sao lưu có thể vừa lấy khoá trong lúc đo (analyze U1).
    const gate = evaluateGate({
      busy: busyNow(),
      stats,
      freeBytes,
      storeBytes,
    });
    if (!gate.run) return { kind: "deferred", reason: gate.reason };

    deps.log("vector.maintenance.start", {
      trigger,
      fragmentsBefore: stats.fragmentCount,
      prunableVersions: stats.prunableVersions,
    });
    const startedAt = deps.now();
    try {
      const r = await deps.store.optimize(RETENTION_MS);
      if (r === null) return { kind: "deferred", reason: "noTable" };
      return {
        kind: "done",
        fragmentsBefore: stats.fragmentCount,
        fragmentsAfter:
          stats.fragmentCount - r.fragmentsRemoved + r.fragmentsAdded,
        versionsRemoved: r.versionsRemoved,
        bytesFreed: r.bytesFreed,
        durationMs: deps.now() - startedAt,
      };
    } catch (e) {
      const c = classifyOptimizeError(e);
      return c.kind === "conflict"
        ? { kind: "deferred", reason: "conflict" }
        : { kind: "error", errorType: c.errorType };
    }
  };

  const report = (trigger: Trigger, outcome: MaintenanceOutcome): void => {
    if (outcome.kind === "deferred") {
      skip(trigger, outcome.reason);
      return;
    }
    lastSkip = null;
    if (outcome.kind === "done") {
      deps.log("vector.maintenance.done", {
        trigger,
        fragmentsBefore: outcome.fragmentsBefore,
        fragmentsAfter: outcome.fragmentsAfter,
        versionsRemoved: outcome.versionsRemoved,
        bytesFreed: outcome.bytesFreed,
        durationMs: outcome.durationMs,
      });
      return;
    }
    deps.logError("vector.maintenance.error", {
      trigger,
      errorType: outcome.errorType,
      consecutiveFailures: state.consecutiveFailures,
      disabled: state.disabled,
    });
  };

  const runCheck = async (): Promise<void> => {
    state = markRunning(state, deps.now());
    const trigger = state.runTrigger ?? "followUp";
    let outcome: MaintenanceOutcome;
    try {
      outcome = await attempt(trigger);
    } catch (e) {
      outcome = { kind: "error", errorType: errorTypeOf(e) };
    }
    state = applyOutcome(state, outcome, deps.now());
    try {
      report(trigger, outcome);
    } catch {
      // Ghi nhật ký lỗi không được làm kẹt bộ điều phối.
    }
    const waiters = idleWaiters;
    idleWaiters = [];
    for (const w of waiters) w();
    reschedule();
  };

  function reschedule(): void {
    if (timer !== null) {
      deps.clearTimer(timer);
      timer = null;
    }
    if (disposed) return;
    const d = nextAction(state, deps.now());
    if (d.kind === "check") {
      void runCheck();
    } else if (d.kind === "wait") {
      timer = deps.setTimer(() => {
        timer = null;
        safely(reschedule);
      }, d.delayMs);
    }
  }

  function safely(fn: () => void): void {
    try {
      fn();
    } catch {
      // Bảo trì không bao giờ ném ra ngoài (FR-016).
    }
  }

  const trigger = (next: MaintenanceState, reason: Trigger): void => {
    if (disposed) return;
    state = next;
    if (state.disabled) {
      skip(reason, "disabled");
      return;
    }
    if (!state.running) reschedule();
  };

  return {
    notifyWrite: () =>
      safely(() => trigger(recordWrite(state, deps.now()), "write")),
    scheduleStartup: () =>
      safely(() =>
        trigger(
          requestRun(state, "startup", deps.now(), STARTUP_DELAY_MS),
          "startup",
        ),
      ),
    notifyReindexDone: () =>
      safely(() =>
        trigger(requestRun(state, "reindex", deps.now()), "reindex"),
      ),
    isRunning: () => state.running,
    whenIdle(timeoutMs) {
      if (!state.running) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        let settled = false;
        const handle = deps.setTimer(() => {
          if (settled) return;
          settled = true;
          resolve(false);
        }, timeoutMs);
        idleWaiters.push(() => {
          if (settled) return;
          settled = true;
          deps.clearTimer(handle);
          resolve(true);
        });
      });
    },
    dispose() {
      disposed = true;
      if (timer !== null) {
        deps.clearTimer(timer);
        timer = null;
      }
    },
  };
}
