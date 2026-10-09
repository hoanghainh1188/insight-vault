# Tasks: Huỷ lượt tạo kết quả Studio (149)

**Input**: `specs/20261009-113857-studio-cancel/` (plan, spec, research R1–R7, data-model, contracts/studio-cancel.md, quickstart)

> **Sửa sau analyze (2026-10-09):** A1 — `finish()` trả lý do huỷ + `cancelLogFields` thuần có test (T006); kịch bản supersede trong e2e (T017).

**Tests**: BẮT BUỘC (Constitution IV — TDD): hàm / module thuần viết test trước, chạy thấy FAIL rồi mới code.

**Quy ước**: không chạy prettier lên `docs/00-glossary.md`, `docs/04-decisions/INDEX.md` (sửa bằng script). Commit theo phase. `[P]` = khác tệp, không phụ thuộc.

---

## Phase 1: Setup / Foundational — lỗi huỷ + nối signal ở provider

- [X] T001 Append glossary bằng script (KHÔNG prettier) TRƯỚC khi đặt tên: huỷ lượt tạo Studio (`studio:cancel`, `studioCancel`), sổ lượt
      (`createGenerationRegistry`, `CancelReason`), lỗi huỷ (`ChatAbortedError` / mã `studioCancelled`), lượt hiện hành (`isCurrentGeneration`) — `docs/00-glossary.md`.
- [X] T002 Viết test TRƯỚC `tests/unit/chat-abort.test.ts` cho `src/main/services/ai-runtime/abort.ts`: `ChatAbortedError` (name, `isChatAborted`),
      `assertNotAborted(undefined | chưa abort | đã abort)`, `linkAbort(outer, controller)` — outer đã abort ⇒ controller abort ngay; outer abort sau ⇒ controller
      abort; `unlink()` gỡ listener (abort sau unlink không ảnh hưởng); outer undefined ⇒ no-op. Chạy thấy FAIL; hiện thực ⇒ xanh.
- [X] T003 [P] Viết test TRƯỚC trong `tests/unit/ollama-client.test.ts`: nhánh không-stream với `fetchFn` giả tôn trọng `init.signal` — signal ngoài abort trong
      lúc fetch ⇒ ném `ChatAbortedError` (không phải `UserFacingError("ollamaHttp")` / timeout); abort trong lúc đọc body ⇒ `ChatAbortedError`; không truyền
      signal ⇒ như cũ; timeout nội bộ vẫn là lỗi cũ. Chạy thấy FAIL; sửa `src/main/services/ai-runtime/ollama-client.ts` (dùng `linkAbort`, phạm vi gồm
      `res.json()`) ⇒ xanh.
- [X] T004 [P] Viết test TRƯỚC `tests/unit/online-http-abort.test.ts`: `callJson({…, signal})` — abort ⇒ `ChatAbortedError` (KHÔNG `OnlineProviderError`
      kind `timeout`); egress kết thúc (badge về nghỉ — kiểm qua `withEgress` / privacy state); timeout thật vẫn `OnlineProviderError(timeout)`. Chạy thấy FAIL;
      sửa `src/main/services/ai-runtime/online/online-http.ts` (`CallJsonOptions.signal`, kiểm `aborted` trước `errorForCause`) ⇒ xanh.
- [X] T005 Truyền `opts.signal` vào `callJson` ở nhánh không-stream của `openai-provider.ts`, `anthropic-provider.ts`, `gemini-provider.ts`
      (`src/main/services/ai-runtime/online/`); thêm 1 test mỗi provider (fetch giả, abort ⇒ `ChatAbortedError`) vào `tests/unit/online-providers.test.ts` (viết test TRƯỚC, thấy FAIL); sửa chú thích
      `ChatStreamOpts.signal` ở `provider.ts` (áp cả nhánh không-stream).

---

## Phase 2: User Story 1 + 3 — Main huỷ được một lượt (Priority: P1)

**Goal**: sổ lượt + điểm kiểm huỷ + IPC `studio:cancel`; lượt bị huỷ không gọi thêm AI, không lưu, kết cục `studioCancelled`.

**Independent Test**: unit với chat giả: huỷ ở mọi điểm ⇒ không thêm lượt gọi, repo không `upsert`, lỗi mã `studioCancelled`; registry đúng owner / supersede.

- [X] T006 [US1] Viết test TRƯỚC `tests/unit/generation-registry.test.ts` cho `createGenerationRegistry` (`src/main/services/studio/generation-registry.ts`):
      register trả signal; `cancel` đúng owner ⇒ `true` + signal aborted + `reason`; owner khác / id lạ / đã finish / đã huỷ ⇒ `false`; `finish` idempotent;
      register cùng `(notebookId, kind)` ⇒ lượt cũ aborted `superseded`; khác kind / notebook không ảnh hưởng; `abortAllFor(owner)` chỉ lượt của owner (`window`);
      `abortAll`; (analyze A1) `finish(id)` trả `reason` nếu lượt đã bị huỷ (null nếu không) và hàm thuần `cancelLogFields(kind, lastPhase, reason)` ⇒
      `{kind, phase, reason}` (phase mặc định `"start"`, không id / notebook). Chạy thấy FAIL; hiện thực ⇒ xanh.
- [X] T007 [US1] Viết test TRƯỚC trong `tests/unit/studio-map-reduce.test.ts`: `signal` aborted trước phần đầu ⇒ 0 lượt chat; abort trong lúc chat phần 2 (chat giả
      ném `ChatAbortedError`) ⇒ KHÔNG thử lại (tổng lượt gọi = 2), ném `ChatAbortedError`; abort giữa vòng rút gọn ⇒ không gọi lô kế; abort trước bước viết ⇒
      không gọi bước cuối; không phát tiến độ sau khi abort; không truyền signal ⇒ test cũ giữ kỳ vọng. Chạy thấy FAIL; sửa `map-reduce.ts` (truyền signal vào
      `chat`, `assertNotAborted` ở ranh giới, rethrow trong retry) ⇒ xanh.
- [X] T008 [US1] Viết test TRƯỚC trong `tests/unit/studio-service.test.ts`: `generate(input, {onProgress, signal})` (đổi chữ ký — cập nhật các test 146 gọi
      `generate(input, cb)`); abort sau `contextInfo` ⇒ 0 lượt chat; chat ném `ChatAbortedError` ⇒ ném `UserFacingError` mã `studioCancelled`; abort sau lượt
      chat cuối nhưng trước `upsert` ⇒ repo `upsert` KHÔNG được gọi; không signal ⇒ như cũ. Chạy thấy FAIL; sửa `studio-service.ts`; thêm mã `studioCancelled`
      vào `src/shared/codes/user-error.ts` + thông điệp dự phòng vi/en (`src/shared/i18n/domains/core.ts`, cạnh `studioNoNotes`) ⇒ xanh.
- [X] T009 [US1] Viết test TRƯỚC: thêm `studio:cancel` vào `tests/unit/studio-channels-whitelist.test.ts`; FAIL; thêm `studioCancel: "studio:cancel"` +
      `ChannelResponse` `{ cancelled: boolean }` vào `src/shared/ipc/channels.ts` ⇒ xanh.
- [X] T010 [US1] Nối dây (I/O mỏng, không logic): `src/main/index.ts` `deps.chat(messages, o)` ⇒ `provider.chat({messages, numCtx}, {signal: o?.signal})`;
      `src/main/ipc/register.ts` — `studio:generate` (qua `safeHandleWithSender`) đăng ký sổ khi `generationId` hợp lệ, truyền `{onProgress, signal}`,
      `finally` `finish`, log `studio.cancelled {kind, phase, reason}` khi kết cục huỷ (phase gần nhất theo emitter); `studio:cancel(id, reason)` ⇒
      `registry.cancel(id, sender, reason ∈ user|navigate)`; `sender.once("destroyed")` ⇒ `abortAllFor`; `window-all-closed` ⇒ `abortAll`. Không log id / nội dung.
- [X] T011 [P] [US1] Thêm `studioCancel(generationId, reason?)` vào `src/preload/index.ts`.

---

## Phase 3: User Story 1 + 2 + 4 — Renderer: nút Huỷ, kết cục, lượt hiện hành, tự huỷ (Priority: P1/P2)

- [X] T012 [US4] Viết test TRƯỚC `tests/unit/studio-generation.test.ts` cho `src/renderer/features/studio/studio-generation.ts`: `isCurrentGeneration`
      (khớp / khác id / loại không có), `outcomeOf` (mã `studioCancelled` ⇒ cancelled; lỗi khác / online ⇒ failed), `cancelFocusTarget(hasResult)`. FAIL ⇒ hiện thực ⇒ xanh.
- [X] T013 [US1] Viết test TRƯỚC (jsdom) `tests/unit/studio-cancel-hook.test.ts` cho `useStudio`: `cancel(kind)` gọi `studioCancel(id, "user")` + `cancelling[kind]`;
      kết cục huỷ ⇒ trả `"cancelled"`, không `errors` / `onlineFailed`, `loading` tắt, tiến độ xoá, kết quả cũ giữ; lượt resolve dù đã bấm Huỷ ⇒ `"done"`;
      A→B→A: kết quả lượt cũ về muộn KHÔNG ghi `results` / không tắt `loading` / không đổi `localKinds` của lượt mới (trả `"stale"`); đổi notebook ⇒
      `studioCancel(id, "navigate")` cho mọi lượt đang chạy; unmount ⇒ như trên; lượt "Tạo bằng AI cục bộ" huỷ ⇒ về nghỉ, không khôi phục lỗi online;
      hai loại song song: huỷ một loại không ảnh hưởng loại kia. Chạy thấy FAIL.
- [X] T014 [US1] Sửa `src/renderer/features/studio/useStudio.ts` (kết cục 4 trạng thái qua `isCurrentGeneration` / `outcomeOf`, `cancel`, `cancelling`,
      tự huỷ khi đổi notebook / unmount); T013 xanh; `studio-notebook-switch`, `studio-progress-hook`, `online-fallback-ui` vẫn xanh (cập nhật mock
      `studioCancel` nếu cần, không đổi kỳ vọng).
- [X] T015 [US1] Viết test TRƯỚC (jsdom) `tests/unit/studio-cancel-ui.test.ts`: `StudioCancel` — nhãn "Huỷ" / "Cancel", `aria-label` "Huỷ tạo Tóm tắt tài liệu" /
      "Cancel creating …", sau bấm "Đang huỷ…" `disabled`; `StudioColumn` — nút Huỷ hiện mỗi khi đang tạo (trước tiến độ đầu: cạnh skeleton; có tiến độ: cạnh
      dòng pha; Tạo lại: trên card cũ); kết cục huỷ ⇒ `announce("Đã huỷ tạo …")` đúng một lần, không khối lỗi, focus về "Tạo lại" (có card) hoặc nút loại khi
      focus đang ở nút Huỷ; CSS hàng pha + nút không tràn (`min-width: 0`, `flex-wrap`). Chạy thấy FAIL.
- [X] T016 [US1] Hiện thực `src/renderer/features/studio/StudioCancel.tsx`, sửa `StudioColumn.tsx` (đặt nút, announce theo kết cục `run`, focus), `studio.css`;
      khoá i18n `studio.cancelAria`, `studio.cancelling` (`src/shared/i18n/domains/studio.ts`), `a11y.studioCancelled` (`a11y.ts`) vi/en; T015 xanh;
      `studio-progress-ui`, `studio-parts-ui` vẫn xanh.

---

## Phase 4: Polish

- [X] T017 E2E `tests/e2e/studio-cancel.spec.ts` (khuôn `studio-progress.spec.ts`): `window.api.studioCancel` tồn tại, không `invoke` chung; Ollama giả HTTP ghi
      số request `/api/chat` + sự kiện `close`, lượt map thứ 2 treo ~20 s; tài liệu ~40.000 ký tự; thấy "Đang đọc phần 2/" ⇒ bấm `studio-cancel-<kind>` ⇒ server
      thấy kết nối đóng ≤ 2 s, không request mới trong 3 s, thẻ về nghỉ, không `studio-error-*`, `studioList` không có kết quả mới; kịch bản có kết quả cũ ⇒ Tạo lại
      ⇒ Huỷ ⇒ card cũ nguyên vẹn; đổi notebook giữa lúc tạo ⇒ server thấy `close`; (supersede) gọi `studioGenerate` lần 2 cùng loại với `generationId` mới qua `window.api` ⇒ kết nối của lượt đầu `close`, lượt đầu reject `studioCancelled`; ảnh chụp cột Studio 900 px vi/en (không tràn).
- [X] T018 [P] ADR `docs/04-decisions/2026-10-09-studio-cancel.md` (IPC, sổ lượt + owner + supersede, điểm kiểm huỷ, huỷ ≠ timeout, tự huỷ khi rời notebook thay
      146 #8, A→B→A; giới hạn đã biết: request online đã tới có thể bị tính phí, Ollama có thể không dừng sinh ngay — theo kết quả đo thủ công) + append dòng
      `docs/04-decisions/INDEX.md` bằng script.
- [X] T019 Test gate: `npm run lint`, `npm test` (coverage ≥ 80%), `npx electron-vite build`, `npx playwright test`; chạy thủ công quickstart mục 1–4 với Ollama
      cục bộ (ghi kết quả "Ollama dừng sinh" vào ADR).

---

## Dependencies

T001 → T002 → (T003 ∥ T004) → T005 → Phase 2 (T006; T007 → T008; T009; T010 cần T005–T009; T011 ∥) → Phase 3 (T012 → T013 → T014 → T015 → T016) → Phase 4.

## Implementation Strategy

MVP = Phase 1–3 (huỷ được + UI). Phase 4 bằng chứng e2e / ADR. Commit theo phase.
