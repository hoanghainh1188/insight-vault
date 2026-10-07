# Contracts — 116 vector-maintenance

Feature thuần main process: **không** kênh IPC mới, **không** đổi `preload`, **không** đổi kiểu `@shared/ipc`.
Hợp đồng dưới đây là giao diện nội bộ giữa các module main.

## C1 — `VectorStore` (mở rộng, `src/main/services/ingestion/vector-store.ts`)

Giữ nguyên mọi phương thức cũ. THÊM (bắt buộc):

```ts
/** 116: đo kho. Bảng chưa tồn tại ⇒ null. Không ghi gì. */
stats(retentionMs: number): Promise<VectorStoreStats | null>;
/** 116: gộp fragment + dọn phiên bản cũ hơn `retentionMs`. KHÔNG bật deleteUnverified. Bảng chưa có ⇒ null. */
optimize(retentionMs: number): Promise<VectorOptimizeResult | null>;
/** 116: số thao tác đọc (search/getVectorsByIds/countBy*) đang chạy — bảo trì không bắt đầu khi > 0. */
activeReads(): number;
```

- `optimize`/`stats` dùng handle `table` cache sẵn (không mở handle mới); `dropTable` vẫn reset handle.
- Không log trong adapter (tầng bảo trì log).
- `ReindexVectorStore` (059) KHÔNG đổi.

## C2 — `trackVectorWrites(store, onWrite): VectorStore` (`src/main/services/vector-maintenance/track-writes.ts`)

- Trả `VectorStore` mới (không sửa `store`) chuyển tiếp mọi phương thức; sau khi `add` (records > 0),
  `deleteBySource`, `deleteByIds` (ids > 0), `deleteByNotebook`, `dropTable` **thành công** ⇒ gọi `onWrite()`.
- Lỗi của thao tác gốc được ném lại nguyên vẹn, KHÔNG gọi `onWrite`. Lỗi trong `onWrite` bị nuốt.

## C3 — Hàm thuần lên lịch (`src/main/services/vector-maintenance/schedule.ts`)

```ts
initialState(): MaintenanceState
recordWrite(s, now): MaintenanceState
requestRun(s, trigger: "startup" | "reindex", now): MaintenanceState
nextAction(s, now): MaintenanceDecision
evaluateGate(input: GateInput): GateResult
applyOutcome(s, outcome: MaintenanceOutcome, now): MaintenanceState
markRunning(s, now): MaintenanceState
```

Ngữ nghĩa: xem `data-model.md`. Không I/O, không `Date.now()` bên trong.

## C4 — Bộ điều phối `createVectorMaintenance(deps)` (`src/main/services/vector-maintenance/maintenance.ts`)

```ts
interface VectorMaintenanceDeps {
  store: Pick<VectorStore, "stats" | "optimize" | "activeReads">;
  isBusy: () => boolean; // isVaultBusy(vaultLock)
  freeBytes: () => Promise<number>; // statfs(dataDir)
  storeBytes: () => Promise<number>; // dirSize(vectors/)
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (h: unknown) => void;
  log: (event: string, meta: Record<string, unknown>) => void;
  logError: (event: string, meta: Record<string, unknown>) => void;
}
interface VectorMaintenance {
  notifyWrite(): void;
  scheduleStartup(): void; // một lần bắt kịp sau STARTUP_DELAY_MS
  notifyReindexDone(): void;
  isRunning(): boolean;
  /** Resolve true khi không có lần bảo trì nào đang chạy (ngay nếu đang rảnh); false nếu quá timeoutMs. */
  whenIdle(timeoutMs: number): Promise<boolean>;
  dispose(): void; // huỷ hẹn giờ; không chờ lần đang chạy (R4)
}
```

- **Không bao giờ ném** ra ngoài (mọi phương thức + callback hẹn giờ bọc try/catch).
- Single-flight: tối đa 1 lần bảo trì; cờ `running` bật từ ĐẦU lần kiểm (trước khi đo) và `whenIdle` dựa trên cờ này;
  kiểm lại `isBusy()` ngay trước `optimize` (bận ⇒ `skip busy`) — đóng kẽ hở với `withLock` của sao lưu.

### Sự kiện nhật ký (088, `logEvent`/`logError`)

| Sự kiện                    | Mức   | Meta (CHỈ các khoá này)                                                                       |
| -------------------------- | ----- | --------------------------------------------------------------------------------------------- |
| `vector.maintenance.start` | info  | `trigger`, `fragmentsBefore`, `prunableVersions`                                              |
| `vector.maintenance.done`  | info  | `trigger`, `fragmentsBefore`, `fragmentsAfter`, `versionsRemoved`, `bytesFreed`, `durationMs` |
| `vector.maintenance.skip`  | info  | `trigger`, `reason` (`busy`/`noTable`/`lowDisk`/`belowThreshold`/`conflict`/`disabled`)       |
| `vector.maintenance.error` | error | `trigger`, `errorType`, `consecutiveFailures`, `disabled`                                     |

`skip` với `reason: "busy"` chỉ log khi đổi lý do (tránh spam mỗi phút). KHÔNG đường dẫn, KHÔNG nội dung, KHÔNG `message`.

## C5 — `isVaultBusy(lock)` (`src/main/services/vault-backup/vault-lock.ts`)

`isVaultBusy(lock: Pick<VaultLock, "getState" | "isLocked">): boolean` = `lock.getState().busy || lock.isLocked()`.

## C6 — `BackupServiceDeps.waitVectorIdle?` (`src/main/services/vault-backup/backup-service.ts`)

`waitVectorIdle?: () => Promise<boolean>` — gọi trong `lock.withLock` trước `createSnapshot`; `false` ⇒ ném
`VaultBackupFailure("busy")`. Không truyền ⇒ hành vi cũ.

## C7 — `createIngestion` thêm `onVectorWrite?: () => void`

Nếu có: `ingestion.vectorStore = trackVectorWrites(lance, onVectorWrite)` và pipeline dùng bản bọc đó.
