---
description: "Task list — 116 bảo trì kho vector (gộp phân mảnh + dọn phiên bản cũ), hoãn ANN"
---

# Tasks: Bảo trì kho vector (gộp phân mảnh + dọn phiên bản cũ), hoãn ANN

**Input**: `specs/20261007-222549-vector-maintenance/` (plan.md, spec.md, research.md, data-model.md, contracts/vector-maintenance.md, quickstart.md)

**Tests**: BẮT BUỘC (Constitution IV + yêu cầu TDD) — mọi hàm thuần viết test trước, chạy thấy FAIL rồi mới implement.

**Organization**: theo user story của spec (US1–US3 P1, US4 P2). Commit theo phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: US1 dung lượng / US2 độ trễ & tương đương kết quả / US3 không cản trở người dùng / US4 ADR hoãn ANN

---

## Phase 1: Setup

- [X] T001 Tạo `src/main/services/vector-maintenance/constants.ts` với các hằng số có tên theo research R10 (`DEBOUNCE_MS=60_000`, `STARTUP_DELAY_MS=45_000`, `MIN_INTERVAL_MS=600_000`, `RETENTION_MS=600_000`, `FOLLOW_UP_MS=RETENTION_MS+60_000`, `FRAGMENT_THRESHOLD=64`, `PRUNABLE_VERSIONS_THRESHOLD=20`, `FREE_SPACE_FACTOR=2`, `MAX_CONSECUTIVE_FAILURES=3`, `BACKOFF_BASE_MS=600_000`, `BACKUP_WAIT_TIMEOUT_MS=120_000`), mỗi hằng có chú thích nguồn (clarify #/R#)

---

## Phase 2: Foundational (chặn mọi story)

**Mục tiêu**: adapter kho vector có `stats`/`optimize`/`activeOperations` (C1) — đã chứng minh trên LanceDB thật.

- [X] T002 Viết test integration LanceDB thật (FAIL trước vì chưa có phương thức) `tests/unit/vector-store-optimize.test.ts` theo mẫu `vector-store-delete-by-ids.test.ts`: (a) bảng chưa có ⇒ `stats(0)` và `optimize(0)` trả `null`; (b) 80 lô `add` 3 chiều + `deleteBySource` một nửa ⇒ `stats(0).fragmentCount ≥ 64`, `prunableVersions ≥ 20`; `optimize(0)` ⇒ `fragmentCount === 1`, `versionsRemoved > 0`, `bytesFreed > 0`, `dirSize` thư mục sau ≤ 50% trước (SC-001); (c) `search`/`countBySource`/`countByNotebook`/`getVectorsByIds` giống hệt trước/sau (so sánh sâu cả `score`); (d) `optimize(RETENTION_MS)` ngay sau ghi ⇒ gộp nhưng `versionsRemoved === 0`; (e) ghi đồng thời (`add` + `deleteBySource`) trong lúc `optimize(0)` ⇒ số hàng đúng kỳ vọng; (f) `activeOperations()` = 0 lúc rảnh và > 0 trong lúc một `search` đang chờ
- [X] T003 Mở rộng `src/main/services/ingestion/vector-store.ts`: thêm kiểu `VectorStoreStats`, `VectorOptimizeResult`; thêm vào `interface VectorStore` (bắt buộc) `stats(retentionMs)`, `optimize(retentionMs)`, `activeOperations()`; mở rộng kiểu tối thiểu `LanceTable` (`optimize`, `stats`, `listVersions`); cài đặt trong `createLanceVectorStore` (dùng handle cache, `cleanupOlderThan: new Date(Date.now() - retentionMs)`, KHÔNG truyền `deleteUnverified`; `prunableVersions` = số phiên bản có `timestamp` cũ hơn mốc, trừ phiên bản mới nhất; bộ đếm đọc try/finally quanh `search`/`getVectorsByIds`/`countBy*`) ⇒ T002 PASS
- [X] T004 [P] Cập nhật mọi mock `VectorStore` cho đủ phương thức mới (`stats: async () => null`, `optimize: async () => null`, `activeOperations: () => 0`) trong `tests/unit/ingestion-pipeline.test.ts`, `tests/unit/ingestion-reprocess.test.ts`, `tests/unit/ingestion-other-kinds-unchanged.test.ts`, `tests/unit/ingestion-pdf-blocks.test.ts` (và `tests/unit/embed-reindex-runner.test.ts` nếu dùng `VectorStore` đầy đủ); `npx tsc --noEmit -p tsconfig.node.json` (hoặc lệnh typecheck của repo) sạch
- [X] T005 Commit phase: `feat(116): VectorStore.stats/optimize/activeOperations + integration test LanceDB thật`

**Checkpoint**: adapter sẵn sàng; chưa có hành vi tự động.

---

## Phase 3: User Story 1 — Dung lượng không phình mãi (P1) 🎯 MVP

**Goal**: bảo trì tự chạy ngầm sau đợt ghi / khởi động / reindex, gộp fragment và (ở lần follow-up) dọn phiên bản cũ.

**Independent Test**: unit với đồng hồ giả: ghi ⇒ sau 60 s chạy `optimize`; lần có gộp ⇒ follow-up sau 11 phút; kho dưới ngưỡng ⇒ `skip belowThreshold`.

### Tests (viết trước, phải FAIL)

- [X] T006 [P] [US1] `tests/unit/vector-maintenance-track-writes.test.ts` (C2): `add` (records>0), `deleteBySource`, `deleteByIds` (ids>0), `deleteByNotebook`, `dropTable` thành công ⇒ `onWrite` 1 lần; `add([])`/`deleteByIds([])` ⇒ không gọi; thao tác lỗi ⇒ ném lại nguyên lỗi, không gọi; `onWrite` ném ⇒ bị nuốt; phương thức đọc chuyển tiếp nguyên kết quả; không sửa object gốc
- [X] T007 [P] [US1] `tests/unit/vector-maintenance-schedule.test.ts` (C3, data-model): `initialState` idle; `recordWrite` ⇒ `wait` tới `lastWriteAt+DEBOUNCE_MS`, ghi tiếp dời mốc; `requestRun("startup"|"reindex")` ⇒ `check` ngay (nếu qua `MIN_INTERVAL_MS`); trần tần suất ⇒ `wait` tới `lastRunAt+MIN_INTERVAL_MS`; `running`/`disabled` ⇒ `idle`; `evaluateGate`: thứ tự lý do `busy` > `noTable` > `belowThreshold` > `lowDisk` (`freeBytes < 2×storeBytes`); chạy khi `fragmentCount ≥ 64` hoặc `prunableVersions ≥ 20`; `applyOutcome(done)` reset `dirtyWrites`/`consecutiveFailures`, đặt `followUpAt=now+FOLLOW_UP_MS` chỉ khi đã gộp; `followUpAt` tới ⇒ `check` với `trigger:"followUp"`; mọi hàm trả object mới (không mutate input)

### Implementation

- [X] T008 [P] [US1] `src/main/services/vector-maintenance/track-writes.ts` — `trackVectorWrites(store, onWrite)` ⇒ T006 PASS
- [X] T009 [US1] `src/main/services/vector-maintenance/schedule.ts` — kiểu `MaintenanceState`/`Trigger`/`MaintenanceDecision`/`GateInput`/`GateResult`/`MaintenanceOutcome` + `initialState`, `recordWrite`, `requestRun`, `nextAction`, `evaluateGate`, `markRunning`, `applyOutcome` (phần `done`/`deferred`) ⇒ T007 PASS
- [X] T010 [US1] Test trước `tests/unit/vector-maintenance.test.ts` (C4, `vi.useFakeTimers` + `setTimer`/`now` tiêm vào, store giả): `notifyWrite` ⇒ sau 60 s gọi `stats` rồi `optimize(RETENTION_MS)` đúng 1 lần, log `vector.maintenance.start` + `done` với meta đúng khoá C4; `scheduleStartup` ⇒ kiểm sau 45 s; `notifyReindexDone` ⇒ kiểm ngay; dưới ngưỡng ⇒ `skip belowThreshold`, không `optimize`; bảng chưa có ⇒ `skip noTable`; follow-up sau gộp ⇒ lần kiểm thứ hai với `trigger:"followUp"`; `dispose` huỷ mọi hẹn giờ
- [X] T011 [US1] `src/main/services/vector-maintenance/maintenance.ts` — `createVectorMaintenance(deps)` (hẹn giờ đơn, single-flight: cờ `running` bật NGAY ĐẦU lần kiểm (trước khi đo `stats`/`freeBytes`/`storeBytes`) và `whenIdle` tính theo cờ này; kiểm lại `isBusy()` ngay trước `optimize`, bận ⇒ hoãn `busy` (analyze U1); log theo C4, không ném) ⇒ T010 PASS
- [X] T012a [US1] Test trước `tests/unit/vault-backup-lock.test.ts`: `isVaultBusy` true khi có nguồn đang xử lý / reindex / thao tác sao lưu-khôi phục / `withLock` đang giữ / `lockUntilExit`; false khi rảnh ⇒ FAIL; rồi thêm `isVaultBusy` (C5) vào `src/main/services/vault-backup/vault-lock.ts` ⇒ PASS (analyze I1: đưa lên trước wiring)
- [X] T012 [US1] `src/main/services/ingestion/ingestion.ts` — tham số `onVectorWrite?: () => void` ⇒ bọc `trackVectorWrites` và dùng bản bọc cho pipeline + `Ingestion.vectorStore` (C7)
- [X] T013 [US1] Wiring `src/main/index.ts`: `onVectorWrite: () => maintenance?.notifyWrite()` (ref lười); tạo `maintenance` sau `vaultLock` với `isBusy: () => isVaultBusy(vaultLock) || ingestion.vectorStore.activeOperations() > 0`, `freeBytes` = `statfs(dataDir)` (`bavail*bsize`), `storeBytes` = `dirSize(join(dataDir,"vectors"), createFsOps())`, `log: logEvent`, `logError`; `scheduleStartup()` sau `resumeAwaiting()`; `notifyReindexDone()` trong `.finally` của `runReindex`; `app.on("will-quit", () => maintenance.dispose())`
- [X] T014 [US1] Commit phase: `feat(116): bảo trì kho vector tự động ngầm (lên lịch thuần + điều phối + wiring)`

**Checkpoint**: MVP — kho tự gộp/dọn.

---

## Phase 4: User Story 2 — Truy vấn không chậm dần, kết quả không đổi (P1)

**Goal**: chứng minh độ trễ về mức bảng gọn và kết quả truy vấn tương đương.

**Independent Test**: T002(c) + hồi quy eval 108.

- [X] T015 [US2] Bổ sung `tests/unit/vector-store-optimize.test.ts`: truy vấn trên ≥ 2 notebook với nhiều vector truy vấn (≥ 5) ⇒ danh sách `{id, sourceId, score}` giống hệt trước/sau `optimize`; `fragmentCount` sau < trước (tiêu chí SC-002/SC-003 ở quy mô test)
- [X] T016 [US2] Chạy `EVAL_MODE=current npm run eval:retrieval` ⇒ in "hồi quy OK" (không sửa `tests/eval/`); ghi kết quả vào ADR (T025)
- [X] T017 [US2] Commit phase (nếu có thay đổi): `test(116): kết quả truy vấn tương đương trước/sau bảo trì`

---

## Phase 5: User Story 3 — Không cản trở người dùng (P1)

**Goal**: hoãn khi bận, sao lưu chờ bảo trì xong, lỗi nuốt + backoff + ngưng sau 3 lỗi.

**Independent Test**: unit của schedule/maintenance/vault-lock/backup-service.

### Tests (viết trước, phải FAIL)

- [X] T018 [P] [US3] (đã chuyển lên T012a — analyze I1) Không còn việc; giữ ID để ổn định đánh số
- [X] T019 [P] [US3] `tests/unit/vault-backup-service.test.ts`: `waitVectorIdle` được gọi trong khoá trước khi chụp; trả `false` ⇒ `createBackup` trả `busy`, không gọi snapshot, khoá nhả; trả `true` ⇒ hành vi cũ; không truyền ⇒ hành vi cũ; áp dụng cả bản tự sao lưu trước khi khôi phục (`confirmRestore`)
- [X] T020 [P] [US3] `tests/unit/vector-maintenance-classify-error.test.ts`: lỗi tên/thông điệp chứa conflict/retryable/commit ⇒ `{kind:"conflict"}`; khác ⇒ `{kind:"error", errorType: constructor.name}`; giá trị không phải Error ⇒ `errorType: typeof`
- [X] T021 [US3] Bổ sung test `tests/unit/vector-maintenance-schedule.test.ts` + `tests/unit/vector-maintenance.test.ts`: bận ⇒ `skip busy` + thử lại sau `DEBOUNCE_MS`, không `optimize`; `activeOperations()>0` ⇒ bận; `skip busy` lặp lại chỉ log 1 lần; `lowDisk` ⇒ `skip lowDisk`; `conflict` ⇒ hoãn (không tăng lỗi); lỗi ⇒ `vector.maintenance.error` (logError, meta `errorType`/`consecutiveFailures`/`disabled`, KHÔNG `message`), backoff 10 → 20 phút, lỗi thứ 3 ⇒ `disabled`, sau đó mọi kích hoạt ⇒ không chạy; thành công reset bộ đếm; `whenIdle` resolve ngay khi rảnh, chờ lần đang chạy (kể cả khi đang ở pha đo trước `optimize`), `false` khi quá timeout; bận phát sinh giữa lúc đo ⇒ không gọi `optimize`, `skip busy` (analyze U1); không phương thức nào ném dù store/`freeBytes` ném

### Implementation

- [X] T022 [P] [US3] `src/main/services/vector-maintenance/classify-error.ts` ⇒ T020 PASS
- [X] T023 [US3] `waitVectorIdle?` trong `src/main/services/vault-backup/backup-service.ts` (C6) ⇒ T019 PASS; `applyOutcome(error)`/backoff/disabled trong `schedule.ts` + nhánh bận/lỗi/`whenIdle` trong `maintenance.ts` ⇒ T021 PASS; `index.ts` truyền `waitVectorIdle: () => maintenance.whenIdle(BACKUP_WAIT_TIMEOUT_MS)` vào `createBackupService`
- [X] T024 [US3] Commit phase: `feat(116): bảo trì hoãn khi bận, sao lưu chờ bảo trì, backoff + ngưng sau 3 lỗi`

---

## Phase 6: User Story 4 — ADR hoãn ANN (P2)

- [X] T025 [P] [US4] ADR mới `docs/04-decisions/2026-10-07-vector-maintenance.md`: quyết định giữ brute-force/hoãn ANN; bảng số liệu issue #116 (2,1/5,5/12,8 ms; IVF_PQ Recall 0,34; HNSW_SQ 0,98; bitmap chậm hơn) + research R2/R3/R4/R5; tham số bảo trì (R10); điều kiện xem lại (p95 > 50 ms sau bảo trì hoặc ~1 triệu vector/notebook, đo lại Recall bằng harness 108); kết quả hồi quy T016
- [X] T026 [P] [US4] Thêm ghi chú "Đã thay thế bởi `2026-10-07-vector-maintenance.md` (116)" cạnh đoạn IVF_PQ lazily trong `docs/04-decisions/2026-07-11-lancedb-integration.md` và cạnh dòng 30 của `docs/04-decisions/2026-07-11-ingestion-clarify.md` (không xoá nội dung cũ)
- [X] T027 [US4] Chèn 1 dòng ADR vào `docs/04-decisions/INDEX.md` bằng chèn thô (KHÔNG chạy prettier lên file này)
- [X] T028 [US4] Commit phase: `docs(116): ADR hoãn ANN kèm số liệu + ghi chú thay thế`

---

## Phase 7: Polish & Cross-Cutting

- [X] T029 APPEND thuật ngữ mới vào `docs/00-glossary.md` (vector maintenance, fragment, compaction, prune/dọn phiên bản, brute-force, ANN) — chỉ thêm dòng, không sửa term cũ, không prettier
- [X] T030 `npm run lint`, `npm test` (coverage ≥ 80%, các file `vector-maintenance/*` được tính), `npm run build`
- [X] T031 Rà `grep -rn "vector.maintenance" src` ⇒ mọi meta chỉ dùng khoá trong C4; không log đường dẫn/`message`
- [X] T032 Commit: `chore(116): glossary + polish`

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 (MVP) → US2 ‖ US3 → US4 (US4 phụ thuộc T016 để ghi kết quả hồi quy) → Polish.
- US2 chỉ dùng adapter (Phase 2) và có thể làm song song với US3 sau US1.
- Trong mỗi story: test trước (FAIL) → implement → PASS → commit.

## Parallel Examples

- Phase 2: T004 song song với T003 sau khi T002 viết xong.
- US1: T006 ‖ T007, rồi T008 ‖ T009.
- US3: T019 ‖ T020, rồi T022.
- US4: T025 ‖ T026.

## Implementation Strategy

MVP = Phase 1 + 2 + US1 (kho tự gộp/dọn). Sau đó US3 (an toàn phối hợp — bắt buộc trước khi merge), US2 (chứng
minh tương đương), US4 (ADR). Cả 4 story phải xong trong PR #116.
