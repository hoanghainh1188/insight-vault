import type { VectorStoreStats } from "../ingestion/vector-store";
import {
  BACKOFF_BASE_MS,
  DEBOUNCE_MS,
  FOLLOW_UP_MS,
  FRAGMENT_THRESHOLD,
  FREE_SPACE_FACTOR,
  MAX_CONSECUTIVE_FAILURES,
  MIN_INTERVAL_MS,
  PRUNABLE_VERSIONS_THRESHOLD,
} from "./constants";

// 116 (contracts C3, data-model): lên lịch bảo trì kho vector — HÀM THUẦN. Không I/O, không Date.now(): thời
// điểm là tham số `now`. Mỗi hàm trả trạng thái MỚI (không sửa input).

export type Trigger = "write" | "startup" | "reindex" | "followUp";

export type DeferReason =
  "busy" | "noTable" | "belowThreshold" | "lowDisk" | "conflict";

export interface MaintenanceState {
  /** Số thao tác ghi chưa được bảo trì "done" bao trọn. */
  readonly dirtyWrites: number;
  readonly lastWriteAt: number | null;
  /** Thời điểm BẮT ĐẦU lần chạy thật gần nhất (done/error) — cho trần tần suất. */
  readonly lastRunAt: number | null;
  /** Lý do kích hoạt đang chờ + mốc sớm nhất được chạy. */
  readonly pendingReason: Trigger | null;
  readonly pendingDueAt: number | null;
  /** Hẹn kiểm lại để dọn phiên bản sau biên (lần trước có gộp). */
  readonly followUpAt: number | null;
  readonly consecutiveFailures: number;
  /** Ngưng tới lần khởi động sau (đủ MAX_CONSECUTIVE_FAILURES lỗi). */
  readonly disabled: boolean;
  readonly running: boolean;
  /** Lần đang chạy: trigger, thời điểm bắt đầu, số ghi lúc bắt đầu. */
  readonly runTrigger: Trigger | null;
  readonly runStartedAt: number | null;
  readonly runDirtyAtStart: number;
}

export type MaintenanceDecision =
  | { kind: "idle" }
  | { kind: "wait"; delayMs: number; trigger: Trigger }
  | { kind: "check"; trigger: Trigger };

export type MaintenanceOutcome =
  | {
      kind: "done";
      fragmentsBefore: number;
      fragmentsAfter: number;
      versionsRemoved: number;
      bytesFreed: number;
      durationMs: number;
    }
  | { kind: "deferred"; reason: DeferReason }
  | { kind: "error"; errorType: string };

export interface GateInput {
  busy: boolean;
  stats: VectorStoreStats | null;
  freeBytes: number;
  storeBytes: number;
}

export type GateResult = { run: true } | { run: false; reason: DeferReason };

export function initialState(): MaintenanceState {
  return {
    dirtyWrites: 0,
    lastWriteAt: null,
    lastRunAt: null,
    pendingReason: null,
    pendingDueAt: null,
    followUpAt: null,
    consecutiveFailures: 0,
    disabled: false,
    running: false,
    runTrigger: null,
    runStartedAt: null,
    runDirtyAtStart: 0,
  };
}

/** Một thao tác ghi: kho chưa yên ⇒ dời mốc chạy tới now + DEBOUNCE_MS (giữ lý do đang chờ nếu có). */
export function recordWrite(
  s: MaintenanceState,
  now: number,
): MaintenanceState {
  return {
    ...s,
    dirtyWrites: s.dirtyWrites + 1,
    lastWriteAt: now,
    pendingReason: s.pendingReason ?? "write",
    pendingDueAt: now + DEBOUNCE_MS,
  };
}

/** Yêu cầu kiểm (bắt kịp sau khởi động / sau reindex) sau `delayMs`, nhưng vẫn chờ kho yên sau lần ghi cuối. */
export function requestRun(
  s: MaintenanceState,
  trigger: "startup" | "reindex",
  now: number,
  delayMs = 0,
): MaintenanceState {
  const quietAt = s.lastWriteAt === null ? now : s.lastWriteAt + DEBOUNCE_MS;
  return {
    ...s,
    pendingReason: trigger,
    pendingDueAt: Math.max(now + delayMs, quietAt, s.pendingDueAt ?? now),
  };
}

export function nextAction(
  s: MaintenanceState,
  now: number,
): MaintenanceDecision {
  if (s.disabled || s.running) return { kind: "idle" };
  let trigger: Trigger;
  let dueAt: number;
  if (s.pendingReason !== null) {
    trigger = s.pendingReason;
    dueAt = s.pendingDueAt ?? now;
  } else if (s.followUpAt !== null) {
    trigger = "followUp";
    dueAt = s.followUpAt;
  } else {
    return { kind: "idle" };
  }
  if (s.lastRunAt !== null) {
    dueAt = Math.max(dueAt, s.lastRunAt + MIN_INTERVAL_MS);
  }
  return dueAt <= now
    ? { kind: "check", trigger }
    : { kind: "wait", delayMs: dueAt - now, trigger };
}

/** Bắt đầu một lần kiểm (single-flight). Lý do đang chờ được "nhận" — ghi mới trong lúc chạy tạo lý do mới. */
export function markRunning(
  s: MaintenanceState,
  now: number,
): MaintenanceState {
  const trigger: Trigger = s.pendingReason ?? "followUp";
  return {
    ...s,
    running: true,
    runTrigger: trigger,
    runStartedAt: now,
    runDirtyAtStart: s.dirtyWrites,
    pendingReason: null,
    pendingDueAt: null,
    followUpAt: trigger === "followUp" ? null : s.followUpAt,
  };
}

/** Khôi phục lý do chờ (hoãn/backoff) nhưng không lùi mốc của ghi mới phát sinh trong lúc chạy. */
function retryLater(
  s: MaintenanceState,
  trigger: Trigger,
  dueAt: number,
): Pick<MaintenanceState, "pendingReason" | "pendingDueAt"> {
  return {
    pendingReason: s.pendingReason ?? trigger,
    pendingDueAt: Math.max(dueAt, s.pendingDueAt ?? dueAt),
  };
}

export function applyOutcome(
  s: MaintenanceState,
  outcome: MaintenanceOutcome,
  now: number,
): MaintenanceState {
  const trigger = s.runTrigger ?? "followUp";
  const base: MaintenanceState = {
    ...s,
    running: false,
    runTrigger: null,
    runStartedAt: null,
    runDirtyAtStart: 0,
  };
  if (outcome.kind === "done") {
    return {
      ...base,
      dirtyWrites: Math.max(0, s.dirtyWrites - s.runDirtyAtStart),
      lastRunAt: s.runStartedAt ?? now,
      consecutiveFailures: 0,
      followUpAt:
        outcome.fragmentsBefore > outcome.fragmentsAfter
          ? now + FOLLOW_UP_MS
          : null,
    };
  }
  if (outcome.kind === "deferred") {
    // Bận/xung đột là tạm thời ⇒ thử lại khi kho yên; các lý do khác chờ kích hoạt mới.
    if (outcome.reason === "busy") {
      return { ...base, ...retryLater(s, trigger, now + DEBOUNCE_MS) };
    }
    if (outcome.reason === "conflict") {
      // optimize ĐÃ chạy (rồi thua commit) ⇒ tính vào trần tần suất để xung đột lặp lại không quét kho mỗi phút
      // (security review 116); không tính lỗi.
      return {
        ...base,
        lastRunAt: s.runStartedAt ?? now,
        ...retryLater(s, trigger, now + DEBOUNCE_MS),
      };
    }
    return base;
  }
  const failures = s.consecutiveFailures + 1;
  const disabled = failures >= MAX_CONSECUTIVE_FAILURES;
  return {
    ...base,
    lastRunAt: s.runStartedAt ?? now,
    consecutiveFailures: failures,
    disabled,
    ...(disabled
      ? {}
      : retryLater(s, trigger, now + BACKOFF_BASE_MS * 2 ** (failures - 1))),
  };
}

/** Kho đủ "bẩn" để gộp (nhiều fragment) hoặc dọn (nhiều phiên bản cũ quá biên) — research R3. */
export function needsMaintenance(stats: VectorStoreStats): boolean {
  return (
    stats.fragmentCount >= FRAGMENT_THRESHOLD ||
    stats.prunableVersions >= PRUNABLE_VERSIONS_THRESHOLD
  );
}

export function evaluateGate(input: GateInput): GateResult {
  if (input.busy) return { run: false, reason: "busy" };
  if (input.stats === null) return { run: false, reason: "noTable" };
  if (!needsMaintenance(input.stats)) {
    return { run: false, reason: "belowThreshold" };
  }
  if (input.freeBytes < FREE_SPACE_FACTOR * input.storeBytes) {
    return { run: false, reason: "lowDisk" };
  }
  return { run: true };
}
