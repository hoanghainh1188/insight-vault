# Tasks: Markdown render (Chat + Studio, giữ chip [n])

**Feature**: `029-markdown-render` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Cách tiếp cận**: Test-First (Constitution IV, ≥80%). Parser markdown THUẦN unit-test = CRUX. THUẦN renderer
(không main/IPC/DB). Chống hồi quy: giữ e2e chip cũ xanh (SC-005).

**Nguồn**: [research.md](./research.md) (R1–R3), [data-model.md](./data-model.md),
[contracts/ui-contract.md](./contracts/ui-contract.md). Clarify `2026-07-12-markdown-render-clarify.md`.

**CRUX**: `parse.ts` (block/inline; chip `[n]` chỉ ngoài code; không sinh HTML → XSS-safe).

---

## Phase 1: Setup

- [x] T001 [P] `vitest.config.ts`: include `src/renderer/shared/markdown/parse.ts`.

## Phase 2: Foundational (parser — CHẶN US)

- [x] T002 [P] `tests/unit/markdown-parse.test.ts` — `parseMarkdown`: heading #/##/###; **đậm**/_nghiêng_/`code`; danh sách -/1.; khối code ``` (giữ literal, KHÔNG parse chip bên trong); đoạn/xuống dòng; chip `[n]` là inline `cite` (ngoài code) NHƯNG literal trong code; HTML thô `<script>` → text (không token đặc biệt); link `[t](u)` → inline `link` text (RED).
- [x] T003 [US1] Viết `src/renderer/shared/markdown/parse.ts` (THUẦN): `parseMarkdown(text): Block[]` + inline tokenizer → T002 GREEN.

**Checkpoint**: parser đúng + an toàn.

---

## Phase 3: US1+US2+US3 — Render markdown giữ chip an toàn (P1) 🎯 MVP

- [x] T004 [US1] Viết `src/renderer/shared/markdown/MarkdownContent.tsx`: render `Block[]` → React node (`h1..3`/`p`/`ul,ol,li`/`pre>code`; inline `strong`/`em`/`code`/text/`span` link; `cite` → `<button className="cite">` dùng `formatCitationLabel`+`onCite`). CHỈ React node — KHÔNG innerHTML. Props `{content, citeByN, onCite}`.
- [x] T005 [US2] `src/renderer/features/rag-qa/MessageBubble.tsx`: câu trả lời AI dùng `<MarkdownContent>` (tin user giữ text); gỡ `renderWithChips`/`CHIP_RE` local. Giữ testid chip `cite-<n>`.
- [x] T006 [US2] `src/renderer/features/studio/StudioResultCard.tsx`: nội dung dùng `<MarkdownContent>`; gỡ `renderWithChips`/`CHIP_RE` local. Giữ testid `studio-cite-<n>`.
- [x] T007 [US1] CSS: `rag-qa.css` `.bubble-text` + `studio.css` `.studio-card-body` bỏ `pre-wrap`; thêm style heading/list/`pre code`/`code` inline (spacing gọn, mono cho code).
- [x] T008 [US3] unit render `tests/unit/markdown-render.test.ts` (jsdom, tất định — mạnh hơn e2e cho kiểm an toàn): `<script>`/HTML thô KHÔNG tạo phần tử script (kiểm DOM thật); chip `[n]` → button.cite bấm gọi onCite; `[n]` trong code → literal; link → text (không `<a>`). Chip mở viewer end-to-end phủ bởi e2e source-viewer cũ + thủ công.

**Checkpoint**: markdown render + chip + an toàn.

---

## Phase 4: Chống hồi quy + gate

- [x] T009 Chạy TOÀN BỘ e2e cũ (16 spec) — SC-005 (chip bấm mở viewer vẫn đúng: source-viewer.spec UI). `no-egress.spec` xanh (SC-004).
- [x] T010 Chạy `npm run lint` + `npm run test` (coverage ≥80%: parse.ts) + `npm run build` xanh; cập nhật `[X]`.

---

## Dependencies & thứ tự

- Setup (T001) → Parser (T002–T003) CHẶN render.
- Render (T004) → MessageBubble/StudioCard (T005/T006) → CSS (T007) → e2e (T008).
- Gate (T009–T010) sau cùng.

## MVP

Toàn bộ (Phase 1–3) = MVP nhỏ gọn: parser + render + chip + an toàn.
