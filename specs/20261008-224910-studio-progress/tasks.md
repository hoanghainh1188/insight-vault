# Tasks: Hiển thị tiến độ khi tạo kết quả Studio (146)

> **Sửa sau `/speckit-analyze` (2026-10-08):** M1 tách bộ phát sự kiện IPC thành hàm thuần có test (T009–T010); L1 kiểm giảm chuyển động (T017, T020);
> L2 trường hợp "Tạo bằng AI cục bộ" (T014); L3 kiểm gọi `announce` khi đổi pha (T016).

**Input**: `specs/20261008-224910-studio-progress/` (plan, spec, research R1–R6, data-model, contracts/studio-progress.md, quickstart)

**Tests**: BẮT BUỘC (Constitution IV — TDD): hàm thuần viết test trước, chạy thấy FAIL rồi mới code.

**Quy ước**: không chạy prettier lên `docs/00-glossary.md`, `docs/04-decisions/INDEX.md` (sửa bằng script). Commit theo phase. `[P]` = khác tệp, không phụ thuộc.

---

## Phase 1: Setup / Foundational

- [X] T001 Append glossary bằng script (KHÔNG prettier) TRƯỚC khi đặt tên: `StudioProgressEvent`, `StudioProgressPhase` (`reading`/`condensing`/`writing`),
      `generationId` (định danh lượt tạo Studio), tiến độ bất định (indeterminate progress) — `docs/00-glossary.md`.
- [X] T002 Viết test TRƯỚC `tests/unit/studio-progress-id.test.ts` cho `isValidGenerationId` (chuỗi `[A-Za-z0-9_-]{1,64}` hợp lệ; rỗng, > 64, ký tự lạ, không
      phải chuỗi ⇒ false). Chạy thấy FAIL.
- [X] T003 Hiện thực `src/shared/studio-progress.ts` (`isValidGenerationId`, `STUDIO_PROGRESS_PHASES` theo thứ tự) và thêm kiểu `StudioProgressPhase`,
      `StudioProgressEvent`, `StudioGenerateInput.generationId?` vào `src/shared/ipc/types.ts`; T002 xanh.
- [X] T004 Viết test TRƯỚC: thêm `studio:progress` vào kỳ vọng `tests/unit/studio-channels-whitelist.test.ts` (và `tests/unit/ipc-whitelist.test.ts` nếu liệt kê);
      chạy thấy FAIL; rồi thêm `studioProgress: "studio:progress"` vào `src/shared/ipc/channels.ts` (kiểu push) ⇒ xanh.

---

## Phase 2: User Story 1 + 2 — Main báo tiến độ (Priority: P1)

**Goal**: map-reduce/studio-service phát `reading i/N` · `condensing` · `writing` (một lượt: chỉ `writing`), qua `studio:progress`.

**Independent Test**: unit với chat giả: thứ tự + số đếm sự kiện; kết quả giống hệt khi không có `onProgress`.

- [X] T005 [US1] Viết test TRƯỚC trong `tests/unit/studio-map-reduce.test.ts`: `onProgress` nhận `reading 1/N..N/N` đúng thứ tự (N = `parts`, kể cả khi bị cắt ở
      `maxMapCalls`), lần thử lại trong cùng phần KHÔNG phát thêm, `condensing` phát đúng 1 lần chỉ khi có vòng rút gọn (0 vòng ⇒ không phát), `writing` 1 lần trước
      bước cuối; `onProgress` ném lỗi ⇒ lượt tạo vẫn xong; kết quả (`raw`, `map`, `parts`, `truncated`) giống hệt khi không truyền `onProgress`. Chạy thấy FAIL.
- [X] T006 [US1] Sửa `src/main/services/studio/map-reduce.ts`: tham số `onProgress?` trong `MapReduceInput` + truyền xuống `condense`; phát theo contract; bọc
      try/catch nuốt lỗi callback; T005 xanh; các test map-reduce cũ giữ nguyên kỳ vọng.
- [X] T007 [US2] Viết test TRƯỚC trong `tests/unit/studio-service.test.ts`: `generate(input, onProgress)` một lượt ⇒ đúng một sự kiện `writing` (không index/total);
      nhiều phần ⇒ chuỗi sự kiện của map-reduce; không truyền `onProgress` ⇒ như cũ. Chạy thấy FAIL.
- [X] T008 [US2] Sửa `src/main/services/studio/studio-service.ts` (`generate(input, onProgress?)`); T007 xanh.
- [X] T009 [US1] (analyze M1) Viết test TRƯỚC `tests/unit/studio-progress-emitter.test.ts` cho hàm thuần `createStudioProgressEmitter(input, send)`:
  `generationId` hợp lệ ⇒ trả `onProgress` gửi đúng `{generationId, notebookId, kind, phase, index?, total?}` (KHÔNG thêm trường nào khác — không nội dung);
  thiếu/không hợp lệ (rỗng, > 64 ký tự, ký tự lạ, không phải chuỗi) ⇒ trả `undefined` (không gửi gì); `send` ném lỗi ⇒ nuốt. Chạy thấy FAIL.
- [X] T010 [US1] Hiện thực `src/main/services/studio/progress-emitter.ts` (`createStudioProgressEmitter`) cho T009 xanh; sửa `src/main/ipc/register.ts` handler
  `studio:generate` chỉ nối dây: `generate(input, createStudioProgressEmitter(input, ev => gửi studio:progress tới mọi cửa sổ))` (theo khuôn `rag:streamToken`); không log payload.
- [X] T011 [P] [US1] Thêm `onStudioProgress(cb) ⇒ () => void` vào `src/preload/index.ts` (chỉ nhận).

---

## Phase 3: User Story 1 + 2 + 4 — Renderer hiển thị đúng thẻ (Priority: P1/P2)

**Goal**: thẻ đúng loại hiện dòng pha + thanh tiến độ; bỏ sự kiện lượt khác/lùi; xoá khi xong/lỗi/đổi notebook.

- [X] T012 [US4] Viết test TRƯỚC `tests/unit/studio-progress.test.ts` cho `applyStudioProgress` (áp khi id + notebook khớp; bỏ id lạ, notebook khác, index lùi, pha lùi;
      không mutate) và `progressText` (vi/en đúng câu clarify #11). Chạy thấy FAIL.
- [X] T013 [US4] Hiện thực `src/renderer/features/studio/studio-progress.ts`; thêm khoá i18n `studio.progress.{reading,condensing,writing,label}` vi/en vào
      `src/shared/i18n/domains/studio.ts`; T012 xanh.
- [X] T014 [US4] Viết test TRƯỚC (jsdom) `tests/unit/studio-progress-hook.test.ts` cho `useStudio`: mỗi `generate` gửi `generationId` mới; sự kiện đúng id ⇒
      `progress[kind]` cập nhật; sự kiện lượt cũ (tạo lại) bị bỏ; kết quả/lỗi ⇒ xoá tiến độ; đổi notebook ⇒ xoá; hai loại song song độc lập; (analyze L2) "Tạo bằng AI cục bộ" (`target: "local"`) cũng gửi `generationId` mới và
  nhận tiến độ riêng, sự kiện của lượt online lỗi trước đó bị bỏ. Chạy thấy FAIL.
- [X] T015 [US4] Sửa `src/renderer/features/studio/useStudio.ts` (sinh id bằng `crypto.randomUUID()`, `activeIds` ref, đăng ký `onStudioProgress`, trả `progress`);
      T014 xanh; `tests/unit/studio-notebook-switch.test.ts` vẫn xanh.
- [X] T016 [US1] Viết test TRƯỚC (jsdom) `tests/unit/studio-progress-ui.test.ts` cho `StudioProgress`: pha đọc ⇒ "Đang đọc phần 2/5…" + `role="progressbar"`
      có `aria-valuenow=2`/`aria-valuemax=5`; pha khác ⇒ bất định (không valuenow, có `aria-valuetext`); English khi ngôn ngữ en; (analyze L3) `StudioColumn` gọi `announce` đúng câu khi tiến độ của một loại đổi pha (mock `announce`). Chạy thấy FAIL.
- [X] T017 [US1] Hiện thực `src/renderer/features/studio/StudioProgress.tsx` + kiểu trong `src/renderer/features/studio/studio.css` (thanh xác định/bất định,
      `@media (prefers-reduced-motion: reduce)` tắt hiệu ứng — (analyze L1) kiểm bằng ảnh chụp e2e với `reducedMotion: "reduce"` ở T020 và test đọc CSS có khối
  media này; không tràn ở cột hẹp); sửa `src/renderer/features/studio/StudioColumn.tsx`: có tiến độ và chưa có kết
      quả ⇒ thay skeleton; có kết quả cũ ⇒ hiện trên card; nút giữ "Đang tạo…"; T016 xanh; `tests/unit/studio-parts-ui.test.ts` vẫn xanh.

---

## Phase 4: User Story 3 — Thông báo trình đọc màn hình (Priority: P2)

- [ ] T018 [US3] Viết test TRƯỚC (trong `tests/unit/studio-progress.test.ts`) cho `progressAnnouncement(prev, next, label, tr)`: câu khi vào `reading` lần đầu,
      `condensing`, `writing` (khi có pha trước); mốc giữa khi `total ≥ 3` và `index = ceil(total/2)`; null còn lại; tổng số câu một lượt 6 phần ≤ 6 (gồm start/done hiện có).
      Chạy thấy FAIL.
- [ ] T019 [US3] Hiện thực `progressAnnouncement` + khoá `a11y.studioProgress{Reading,Condensing,Writing}` vi/en (`src/shared/i18n/domains/a11y.ts`); gọi `announce`
      trong `StudioColumn.tsx` khi tiến độ của loại đổi; T018 xanh.

---

## Phase 5: Polish

- [ ] T020 E2E `tests/e2e/studio-progress.spec.ts`: `window.api.onStudioProgress` tồn tại, không có `invoke` chung; Ollama giả HTTP (như e2e #135) trả `/api/tags` +
      `/api/chat` chậm ~1,5 s ⇒ notebook nhỏ: thẻ hiện "Đang viết…" (testid tiến độ) rồi kết quả; ảnh chụp cột Studio hẹp vi/en (không tràn); (analyze L1) một lần chạy với `reducedMotion: "reduce"` ⇒ thanh bất định không có animation (`getComputedStyle(...).animationName === "none"`).
- [ ] T021 [P] ADR `docs/04-decisions/2026-10-08-studio-progress.md` (kênh, điểm phát, mốc thông báo, giới hạn đã biết: song song chậm hơn, không phục hồi khi quay lại,
      không Huỷ — #149, không ETA) + append dòng `docs/04-decisions/INDEX.md` bằng script.
- [ ] T022 Test gate: `npm run lint`, `npm test` (coverage ≥ 80%), `npx electron-vite build`, `npx playwright test`; chạy thủ công quickstart mục 1–2 với Ollama cục bộ nếu có.

---

## Dependencies

T001 → T002–T004 → Phase 2 (T005→T006, T007→T008, T009→T010 (cần T003/T004/T008), T011 ∥) → Phase 3 (T012→T013→T014→T015→T016→T017) → Phase 4 (T018→T019) → Phase 5.

## Implementation Strategy

MVP = Phase 1–3 (main báo + thẻ hiển thị). Phase 4 hoàn thiện khả năng tiếp cận. Commit theo phase.
