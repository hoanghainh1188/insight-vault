# Tasks: UI Polish v1 (nền design-system + đối chiếu prototype)

**Feature**: `023-ui-polish` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Cách tiếp cận**: Feature THUẦN renderer (không main/IPC/DB/migration). Chống hồi quy = **giữ mọi e2e cũ
xanh** (SC-002) + thêm e2e a11y. Logic tách được (`useModalA11y`) có unit. `[P]` = song song (khác file).

**Nguồn**: [research.md](./research.md) (R1–R7b — token values từ prototype `:root`),
[data-model.md](./data-model.md) (design tokens), [contracts/ui-contract.md](./contracts/ui-contract.md).
Clarify `2026-07-11-ui-polish-clarify.md`.

**KHÔNG đổi**: `useChat`/`useStudio`/`useSourceViewer`/notebooks hooks, IPC, main, DB. Chỉ markup/CSS/SVG +
hook a11y thuần.

**Chống hồi quy (giữ xanh):** `rag-qa · source-viewer · studio · notebook-crud · ingestion · no-egress ·
navigation · shell · onboarding · ai-onboarding · *-security` (13 spec).

---

## Phase 1: Setup

- [X] T001 [P] Trích giá trị token chuẩn từ `docs/03-ui/prototype.html` `:root` (đã xác nhận research R1/R2): citation `#9A6510`/`#FCEFCF`/`#E8C878`; ghi chú vào đầu `src/renderer/shared/tokens.css` (comment nhóm token mới) — chuẩn bị chỗ.

---

## Phase 2: Foundational (nền dùng chung — CHẶN các nhóm)

- [X] T002 [P] `src/renderer/shared/icons.tsx` (MỚI): hand-inline SVG icon component (nav: notebooks/workspace/settings; send; search; plus; upload; close). Mỗi icon nhận `size`/`aria-hidden`; KHÔNG lib/CDN.
- [X] T003 [P] `src/renderer/shared/useModalA11y.ts` (MỚI): hook thuần nhận `{active, onClose, containerRef}` → gắn keydown Escape→onClose, focus phần tử đầu khi mở, focus trap (Tab/Shift+Tab vòng trong container). Trả handler nếu cần.
- [X] T004 [P] `tests/unit/ui-modal-a11y.test.ts` — test `useModalA11y` (jsdom/DI DOM): Escape gọi onClose; focus phần tử đầu khi active; Tab tại phần tử cuối vòng về đầu (trap). (RED trước T003 GREEN.)

**Checkpoint**: icon + hook a11y sẵn cho các nhóm.

---

## Phase 3: Nhóm A — Design-system tokens (US1 citation vàng) 🎯 nền + P1

**Goal**: chip `[n]` (Chat + Studio) + highlight (viewer) dùng bảng màu vàng semantic; gom màu/motion token.

**Independent Test**: chip Chat/Studio + highlight viewer đều vàng `--cite*`, phân biệt nút `--accent`; bấm chip vẫn mở viewer.

- [X] T005 [US1] `src/renderer/shared/tokens.css`: THÊM `--cite:#9A6510` · `--cite-bg:#FCEFCF` · `--cite-line:#E8C878`; `--duration-fast:150ms` · `--duration-normal:300ms` · `--ease-out-expo:cubic-bezier(.16,1,.3,1)`; token semantic cho màu hardcode (`--accent-line`#d3e6df · `--warn-line`#ead9ae · `--warn-strong`#d99a2b · `--danger-line`#e6c2bd · `--danger-bg`#fbeae8). Additive — không xoá token cũ.
- [X] T006 [US1] `src/renderer/features/rag-qa/rag-qa.css`: `.cite` đổi từ `--accent-soft` sang bảng `--cite*` (nền/viền/chữ) + mono font + `.cite:focus-visible{outline:2px solid var(--cite)}`. Transition dùng `--duration-fast`/`--ease-out-expo`.
- [X] T007 [P] [US1] `src/renderer/features/studio/studio.css`: đảm bảo chip `.cite` (StudioResultCard dùng cùng class) kế thừa token vàng; nếu có override màu accent thì gỡ.
- [X] T008 [P] [US1] `src/renderer/features/source-viewer/source-viewer.css`: highlight `.hl` đổi `--warn-*` → `--cite-bg` + box-shadow `--cite-line`; (tuỳ) nhãn `.hltag` nền `--cite`.
- [X] T009 [US1] Rà & thay màu hardcode đã token hoá (T005) trong `app.css`/`sources.css`/`rag-qa.css`/… bằng `var(--…)` (SC-005). Thêm `@media (prefers-reduced-motion: reduce)` giảm/tắt transition (FR-012).
- [X] T010 [US1] `tests/e2e/ui-polish.spec.ts` (case citation): chip `[n]` Chat + Studio có computed color thuộc bảng cite (không phải accent); bấm chip → Source Viewer mở (hành vi giữ). Có thể assert qua `getComputedStyle` hoặc class.

**Checkpoint**: citation vàng nhất quán 3 nơi, không vỡ hành vi.

---

## Phase 4: Nhóm B — Cấu trúc khớp prototype (US2) — P1

**Goal**: NavRail 60px icon · composer (model chip + send icon + mode segmented) · bubble AI bỏ nền + nhãn.

**Independent Test**: đối chiếu wireframe từng phần; điều hướng + gửi câu hỏi chạy như trước.

- [X] T011 [US2] `src/renderer/features/app-shell/NavRail.tsx` + `app.css`: rail dọc 60px icon-only (dùng `icons.tsx`), brand "IV" trên, Settings đáy (flex spacer), active state `--accent-soft`, mỗi mục `aria-label`/`title`. Điều hướng qua router giữ nguyên.
- [X] T012 [US2] `src/renderer/features/rag-qa/ModeToggle.tsx` + css: segmented control (pill 2 đoạn, nền trượt bằng `transform`), `role`/`aria-pressed`. Giữ prop `mode`/`onChange`.
- [X] T013 [US2] `src/renderer/features/rag-qa/ChatColumn.tsx`: composer `.cbox` + hàng `.cbar` gồm ModeToggle + model chip (đọc `window.api.aiGetSelectedModels().chatModel` → "Local · <model>"/"Local · chưa chọn", bấm→`navigate('/settings')`) + nút gửi icon (`aria-label="Gửi"`, giữ testid `chat-send`). KHÔNG đổi `useChat`/`send`.
- [X] T014 [P] [US2] `src/renderer/features/rag-qa/MessageBubble.tsx` + css: bỏ nền bubble AI (giữ nền user), thêm nhãn `.who` ("InsightVault"/"Bạn", testid `bubble-who`), line-height 1.6; giữ `renderWithChips`/`onCite`.
- [X] T015 [US2] `tests/e2e/ui-polish.spec.ts` (case cấu trúc): NavRail có mục aria-label + điều hướng đúng route; composer có `composer-model` + `chat-send`; bubble có `bubble-who`; gửi 1 câu (UNREACHABLE_OLLAMA → block, kiểm không vỡ). Không đổi hành vi.

**Checkpoint**: 3 phần cấu trúc khớp prototype, chức năng giữ.

---

## Phase 5: Nhóm C — A11y + trạng thái (US3) — P2

**Goal**: focus-visible · modal Escape/aria-modal/trap · empty state Notebooks · skeleton Chat.

**Independent Test**: keyboard-only qua nav/nút; modal Escape đóng; Notebooks rỗng/no-result; skeleton khi chờ.

- [X] T016 [US3] `src/renderer/features/sources/AddSourceModal.tsx`: dùng `useModalA11y` → `aria-modal="true"` + `role="dialog"` + nút X (`modal-close`, icon từ icons.tsx) + Escape đóng + focus trap.
- [X] T017 [P] [US3] `src/renderer/features/notebooks/NotebookModal.tsx`: áp `useModalA11y` (aria-modal + Escape + X + trap) tương tự.
- [X] T018 [P] [US3] `src/renderer/features/notebooks/NotebooksGrid.tsx`: empty state (`notebooks.length===0` → thông báo + CTA tạo, testid `notebooks-empty`) + no-result (`query`≠"" & `filtered.length===0` → "Không tìm thấy notebook", testid `notebooks-no-result`). (Search/+ icon từ icons.tsx.)
- [X] T019 [P] [US3] `src/renderer/features/rag-qa/ChatColumn.tsx` + css: skeleton bubble khi `loading` (testid `chat-skeleton`), shimmer bằng opacity/transform (reduced-motion tắt).
- [X] T020 [US3] `:focus-visible` outline (token `--accent`) cho `.nav-item`/nút/chip trong `app.css` + css feature liên quan (FR-009).
- [X] T021 [US3] `tests/e2e/ui-polish.spec.ts` (case a11y): Tab tới nav → `:focus-visible` thấy được; mở AddSource/Notebook modal → `aria-modal` + Escape đóng; Notebooks rỗng → `notebooks-empty`; gửi câu (mock) → `chat-skeleton` (nếu chờ được).

**Checkpoint**: a11y + trạng thái đạt SC-003/004/006.

---

## Phase 6: Chống hồi quy + gate (cross-cutting)

- [X] T022 Chạy TOÀN BỘ e2e cũ (13 spec) — nếu đổi testid nào (vd nút gửi) mà spec cũ dùng, cập nhật spec tương ứng CÙNG commit. Bảo đảm SC-002 (0 hồi quy).
- [X] T023 [P] Kiểm `no-egress.spec` xanh (icon inline không thêm request — SC-008); rà không còn màu hardcode đã token hoá (SC-005) bằng grep.
- [X] T024 Chạy `npm run lint` + `npm run test` (unit useModalA11y) + `npm run build` xanh; cập nhật `[X]` task đã xong.

---

## Dependencies & thứ tự

- **Setup (T001)** → **Foundational (T002–T004)** CHẶN các nhóm (icon + hook dùng chung).
- **Nhóm A (T005–T010)** nền token — nên làm trước B/C (B/C dùng token motion/focus).
- **Nhóm B (T011–T015)** dùng icons.tsx + token.
- **Nhóm C (T016–T021)** dùng useModalA11y + icons + token.
- **Chống hồi quy (T022–T024)** sau cùng.

## Song song (ví dụ)

- Foundational: T002, T003 [P] (T004 test đi cùng T003).
- Nhóm A: T007, T008 [P] (studio + viewer css khác file) sau T005/T006.
- Nhóm C: T017, T018, T019 [P] (khác file) sau T016.

## MVP

**Nhóm A (Phase 1–3)** = MVP giá trị cao nhất: citation vàng nhất quán (củng cố kiểm-chứng-được), chi phí
thấp. B (khớp wireframe) + C (a11y/empty) là increment.
