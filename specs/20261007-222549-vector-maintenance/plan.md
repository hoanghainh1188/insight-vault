# Implementation Plan: Bảo trì kho vector (gộp phân mảnh + dọn phiên bản cũ), hoãn ANN

**Branch**: `116-vector-maintenance` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20261007-222549-vector-maintenance/spec.md`; quyết định
`docs/04-decisions/2026-10-07-vector-maintenance-clarify.md`.

## Summary

Thêm một bộ điều phối bảo trì kho vector chạy ngầm ở main process: đếm thao tác ghi qua một decorator bọc `VectorStore`,
hẹn giờ theo hàm thuần (debounce 60 s, bắt kịp sau khởi động 45 s, sau reindex, trần 1 lần/10 phút, follow-up sau biên
giữ phiên bản), đo kho (`stats`) rồi qua cổng (không bận, đủ dung lượng trống, ≥ 64 fragment hoặc ≥ 20 phiên bản cũ),
gọi `table.optimize({ cleanupOlderThan: now − 10 phút })`. Lỗi bị nuốt, backoff, ngưng sau 3 lỗi. Sao lưu chờ bảo
trì đang chạy xong trước khi chụp. Ghi ADR hoãn ANN kèm số liệu. Research (chạy thật LanceDB 0.31) xác nhận: gộp
625→1 fragment đưa search 21,4→2,6 ms; dọn phiên bản 78→23 MB; `SIGKILL` giữa chừng không hỏng bảng; ghi đồng thời an toàn.

## Technical Context

**Language/Version**: TypeScript 5 (Electron main process, Node ≥ 20)

**Primary Dependencies**: `@lancedb/lancedb` 0.31.0 (đã có), Electron, `node:fs/promises` (`statfs`)

**Storage**: LanceDB bảng `chunks` ở `<userData>/vectors/` (không đổi schema); không đụng SQLite

**Testing**: vitest (unit + integration LanceDB thật trên `mkdtemp`), Playwright e2e (không đổi), eval 108 hồi quy

**Target Platform**: macOS + Windows desktop (Electron)

**Project Type**: desktop-app (Electron, main/preload/renderer)

**Performance Goals**: search p50 về mức bảng gọn (≤ ~3 ms @15–20k vector) sau bảo trì; bảo trì < 1 s ở quy mô vault
thường (đo 0,2 s gộp + 0,5 s dọn @20k)

**Constraints**: không UI, không IPC mới, không egress; không tạo index; không đổi kết quả truy vấn; không chặn người dùng

**Scale/Scope**: vault cá nhân 10k–200k vector; ~5 file mới trong `src/main/services/vector-maintenance/`, sửa
`vector-store.ts`, `ingestion.ts`, `vault-lock.ts`, `backup-service.ts`, `index.ts`; 4 mock test cập nhật

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc                      | Đánh giá                                                                                                                                                                                               | Kết quả |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| I — Local-first, no egress      | Chỉ thao tác tệp cục bộ (`optimize`, `statfs`, `readdir`); không gọi mạng, không telemetry, badge không đổi.                                                                                           | PASS    |
| II — Verifiable citations       | Không đổi `chunk.id`/vector/locator; integration test chứng minh search/count/getVectorsByIds giống hệt; eval 108 hồi quy.                                                                             | PASS    |
| III — Desktop security boundary | Toàn bộ ở main; không kênh IPC/preload mới; log chỉ số đếm + `errorType` (không đường dẫn/nội dung/`message`).                                                                                         | PASS    |
| IV — Test-first & coverage      | `schedule.ts`, `maintenance.ts`, `track-writes.ts` thuần/DI, test viết trước (RED→GREEN), nằm trong `src/main/services/**` (đã tính coverage); adapter LanceDB giữ như cũ (phủ bằng integration test). | PASS    |
| V — Phased delivery             | Một pha nhỏ, không phụ thuộc 008/online; không tính năng trả phí.                                                                                                                                      | PASS    |

Re-check sau Phase 1: không phát sinh vi phạm (không có mục Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/20261007-222549-vector-maintenance/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/vector-maintenance.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
src/main/services/
├── vector-maintenance/              # MỚI (cô lập theo feature)
│   ├── constants.ts                 # hằng số R10 (đặt tên)
│   ├── schedule.ts                  # hàm thuần: state, nextAction, evaluateGate, applyOutcome
│   ├── track-writes.ts              # decorator đếm ghi (C2)
│   ├── classify-error.ts            # lỗi optimize ⇒ "conflict" (hoãn) | errorType (lỗi)
│   └── maintenance.ts               # bộ điều phối DI (C4): hẹn giờ, single-flight, log, whenIdle
├── ingestion/
│   ├── vector-store.ts              # + stats / optimize / activeOperations (C1)
│   └── ingestion.ts                 # + onVectorWrite ⇒ trackVectorWrites (C7)
└── vault-backup/
    ├── vault-lock.ts                # + isVaultBusy (C5)
    └── backup-service.ts            # + waitVectorIdle? (C6)
src/main/index.ts                    # wiring: tạo maintenance sau vaultLock, startup, reindex.finally, will-quit dispose

tests/unit/
├── vector-maintenance-schedule.test.ts      # MỚI (test-first)
├── vector-maintenance.test.ts               # MỚI (fake timers, test-first)
├── vector-maintenance-track-writes.test.ts  # MỚI
├── vector-maintenance-classify-error.test.ts# MỚI
├── vector-store-optimize.test.ts            # MỚI — LanceDB thật
├── vault-lock.test.ts / vault-backup-*.test.ts  # + isVaultBusy, waitVectorIdle
└── ingestion-*.test.ts, embed-reindex-runner.test.ts  # cập nhật mock VectorStore (optimize/stats/activeOperations)

docs/04-decisions/
├── 2026-10-07-vector-maintenance.md         # ADR MỚI: hoãn ANN + số liệu + tham số bảo trì
├── 2026-07-11-lancedb-integration.md        # + ghi chú "đã thay thế bởi" (không xoá)
├── 2026-07-11-ingestion-clarify.md          # + ghi chú tương tự cho dòng 30
└── INDEX.md                                 # + 1 dòng ADR
docs/00-glossary.md                          # APPEND thuật ngữ mới (vector maintenance, fragment, compaction, prune, brute-force, ANN)
```

**Structure Decision**: module riêng `src/main/services/vector-maintenance/` (theo quy ước cô lập feature); chỉ chạm
vùng dùng chung tối thiểu (adapter kho, ingestion composition root, vault-lock, backup-service, index.ts). README
không đổi (không có hành vi người dùng thấy — clarify #4/#10).

## Design notes

1. **Wiring thứ tự** (`index.ts`): `createIngestion({ onVectorWrite: () => maintenance?.notifyWrite() })` (ref lười như
   `isVaultLocked`) → `vaultLock` → `maintenance = createVectorMaintenance({ store: ingestion.vectorStore, isBusy: () =>
isVaultBusy(vaultLock), freeBytes: statfs(dataDir), storeBytes: dirSize(vectors/), … })` → `createBackupService({ …,
waitVectorIdle: () => maintenance.whenIdle(BACKUP_WAIT_TIMEOUT_MS) })` → sau `resumeAwaiting()` gọi
   `maintenance.scheduleStartup()`; trong `runReindex(...).finally` gọi `maintenance.notifyReindexDone()`;
   `app.on("will-quit", () => maintenance.dispose())`.
2. **`activeOperations`**: adapter tăng/giảm bộ đếm quanh `search`, `getVectorsByIds`, `countBy*` (try/finally).
3. **`stats(retentionMs)`**: `stats()` + `listVersions()`; `prunableVersions` = số phiên bản có `timestamp` <
   `Date.now() − retentionMs`, trừ phiên bản mới nhất.
4. **Phân loại lỗi**: `classifyOptimizeError(e)` ⇒ `{ kind: "conflict" }` nếu tên/thông điệp (chỉ dùng để phân loại,
   KHÔNG log) khớp `/conflict|retryable/i`; ngược lại `{ kind: "error", errorType: constructor.name }`.
5. **Busy log không spam**: `skip` cùng `reason` liên tiếp chỉ log lần đầu.
6. **Vault phình sẵn**: `scheduleStartup` bắt kịp; lần đầu chỉ gộp, lần follow-up (11 phút sau) dọn phiên bản.

## Complexity Tracking

Không có vi phạm Constitution cần biện minh.
