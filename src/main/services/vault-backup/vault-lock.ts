import type { VaultBackupState } from "@shared/ipc/types";
import { VaultBackupFailure } from "./errors";

// Busy + khoá vault (085, research R7). Busy (FR-026) = nguồn queued/processing, reindex nền, hoặc đang có 1 thao
// tác sao lưu/khôi phục. Khoá = chặn các kênh ghi vault (thêm/thử lại/xoá nguồn, xoá notebook) trong pha
// snapshot và sau khi xác nhận khôi phục (tới lúc exit).

export interface VaultLockDeps {
  hasActiveSources: () => boolean;
  isReindexing: () => boolean;
}

export type VaultOperation = "backup" | "restore";

export interface VaultLock {
  getState(): VaultBackupState;
  /** Bận vì nguồn/reindex (bỏ qua thao tác sao lưu/khôi phục đang giữ) — kiểm lại lúc xác nhận khôi phục. */
  externalBusy(): boolean;
  /** Ném `busy` nếu đang bận; ngược lại đánh dấu thao tác đang chạy. */
  beginOperation(op: VaultOperation): void;
  endOperation(): void;
  isLocked(): boolean;
  withLock<T>(fn: () => Promise<T>): Promise<T>;
  /** Khoá vĩnh viễn tới khi app thoát (sau xác nhận khôi phục). */
  lockUntilExit(): void;
}

export function createVaultLock(deps: VaultLockDeps): VaultLock {
  let operation: VaultOperation | null = null;
  let depth = 0;
  let permanent = false;

  const getState = (): VaultBackupState => {
    if (operation) return { busy: true, reason: "operation" };
    if (deps.hasActiveSources()) return { busy: true, reason: "processing" };
    if (deps.isReindexing()) return { busy: true, reason: "reindexing" };
    return { busy: false, reason: null };
  };

  return {
    getState,
    externalBusy: () => deps.hasActiveSources() || deps.isReindexing(),
    beginOperation(op) {
      if (getState().busy) throw new VaultBackupFailure("busy");
      operation = op;
    },
    endOperation() {
      operation = null;
    },
    isLocked: () => permanent || depth > 0,
    async withLock(fn) {
      depth += 1;
      try {
        return await fn();
      } finally {
        depth -= 1;
      }
    },
    lockUntilExit() {
      permanent = true;
    },
  };
}

/**
 * 116 (contracts C5, research R6): kho "bận" theo MỘT định nghĩa dùng chung — nguồn queued/processing/
 * reprocessing, reindex nền, thao tác sao lưu/khôi phục đang mở, khoá chụp, hoặc khoá vĩnh viễn sau xác nhận
 * khôi phục. Bảo trì kho vector chỉ bắt đầu khi hàm này trả false.
 */
export function isVaultBusy(
  lock: Pick<VaultLock, "getState" | "isLocked">,
): boolean {
  return lock.getState().busy || lock.isLocked();
}

/**
 * 186 PR C1 (T116, D8): bảo trì kho vector KHÔNG bị chặn bởi nguồn cuộc họp đang ghi/tạm dừng (ghi audio không đụng LanceDB);
 * vẫn bị chặn bởi thao tác sao lưu/khôi phục, khoá, reindex và mọi nguồn khác đang xử lý (kể cả cuộc họp đang hoàn tất).
 * Sao lưu/khôi phục vẫn dùng `getState()` (cuộc họp đang ghi = processing ⇒ bận).
 */
export function isMaintenanceBusy(
  lock: Pick<VaultLock, "getState" | "isLocked">,
  deps: {
    isReindexing: () => boolean;
    processingSourceIds: () => readonly string[];
    queuedCount: () => number;
    isReprocessing: () => boolean;
    recordingSourceId: () => string | null;
  },
): boolean {
  if (lock.isLocked() || lock.getState().reason === "operation") return true;
  if (deps.isReindexing() || deps.queuedCount() > 0 || deps.isReprocessing())
    return true;
  const rec = deps.recordingSourceId();
  return deps.processingSourceIds().some((id) => id !== rec);
}
