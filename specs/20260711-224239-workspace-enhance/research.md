# Research — Workspace enhancements (025)

6 ambiguity đã chốt (`2026-07-11-workspace-enhance-clarify.md`) → không NEEDS CLARIFICATION. **Lưu ý**:
quyết định #1 đã ĐẢO (2026-07-11) — **KHÔNG map-reduce**, chỉ **tăng ngân sách** (giữ chip `[n]` chính xác).
ADR `2026-07-11-studio-mapreduce-citation.md` đánh dấu map-reduce ĐÃ BÁC.

## R1 — Studio: 1-lượt + ngân sách rộng hơn + lọc nguồn (KHÔNG map-reduce)

- **Decision**: `generate({notebookId, kind, sourceId?})`:
  1. Gom `ScoredChunk[]`: nếu `sourceId` → chỉ `listChunks(sourceId)` (nguồn ready + thuộc notebook); else
     toàn bộ nguồn ready (như 021).
  2. **Luôn 1-lượt**: `buildContext(scored, STUDIO_CONTEXT_BUDGET)` (ngân sách nới **8000 → 16000**) + `chat`
     - `postprocessCitations` + `citationsFromMap` fallback + cờ `truncated` (như 021) → chip `[n]` CHÍNH XÁC
       tới đoạn.
  3. Notebook vượt 16000 → `truncated=true` + ghi chú "dựa trên phần đầu" (như 021). KHÔNG map-reduce, KHÔNG
     `partsCount`, KHÔNG citation mức nguồn.
- **Rationale**: giữ độ chính xác citation tuyệt đối (ưu tiên người dùng). Ngân sách gấp đôi + lọc theo nguồn
  (US2 — tổng hợp riêng từng tài liệu) bao phủ hầu hết ca thực tế. `studio-service` DI (021) không đổi chữ
  ký ngoài `sourceId` trong input.
- **Xác nhận**: `buildContext(scored, budget)` (013, đã có tham số budget từ 021) — chỉ truyền budget mới.
  16000 ký tự ≈ 4–5k token, dưới context window model local phổ biến (8k–32k). `studio-service` = assembly
  (exclude coverage) → thay đổi phủ bởi e2e/thủ công.

## R2 — (BÁC) Map-reduce / batch.ts

- Đã cân nhắc `splitIntoBatches` + citation mức nguồn nhưng **BÁC** (hạ độ chính xác citation). Không tạo
  `batch.ts`, không `prompt` map/reduce, không `partsCount`. Ghi chép ở ADR (REJECTED) — mở lại nếu sau cần
  bao phủ notebook cực lớn.

## R4 — Export .md (kênh studio:export)

- **Decision**: kênh `studio:export {content, suggestedName}` → main `exportMarkdown(win, content, name)`:
  `dialog.showSaveDialog({defaultPath: sanitizeName(name)+'.md', filters:[{name:'Markdown',
extensions:['md']}]})`; `canceled` → `{saved:false}`; else `fs.writeFile(filePath, content, 'utf8')` →
  `{saved:true, path}`. KHÔNG log `content`. `sanitizeName(name)` THUẦN (bỏ `/\:*?"<>|`, cắt dài, rỗng→mặc
  định) → export riêng để unit-test.
- Copy: renderer `navigator.clipboard.writeText(content)` (không IPC); lỗi → thông báo, không treo.
- **Rationale**: ghi file CHỈ ở main (Constitution III); người dùng chủ động chọn nơi lưu (không tự ghi/gửi
  — không egress). `dialog`/`fs` I/O exclude coverage; `sanitizeName` thuần test được.

## R5 — Lọc theo nguồn (dropdown)

- **Decision**: `StudioColumn` dropdown "Tất cả nguồn / <tên nguồn>" (đọc `sourceListByNotebook`, chỉ nguồn
  `status==="ready"`); state `scope: sourceId | null`; `useStudio.generate(kind, scope)` → `studioGenerate({
notebookId, kind, sourceId: scope ?? undefined})`. Kết quả vẫn lưu theo `(notebook, kind)` (ghi đè) — KHÔNG
  lưu tách theo nguồn (giữ schema).
- **Rationale**: đổi ngữ cảnh lần tạo là đủ; không mở schema (không migration).

## R6 — Kéo cột (useColumnWidths THUẦN)

- **Decision**: state `{src:number, studio:number}` (px). `clampWidths(w)` — clamp `src`∈[220,460],
  `studio`∈[200,420]. `parseWidths(raw)` — JSON.parse an toàn, thiếu/hỏng → default `{src:300, studio:260}`.
  Persist localStorage `workspace-col-widths`. Grid: `grid-template-columns: var(--col-src) 1fr
var(--col-studio)` (Chat = 1fr). 2 splitter `.col-splitter` pointer events: `pointerdown`→
  `setPointerCapture`, `pointermove`→cập nhật width theo delta + clamp, `pointerup`→persist.
  `clampWidths`/`parseWidths` THUẦN → test.
- **Rationale**: CSS var + 1fr → kéo mượt, không đụng layout logic. Clamp/parse tách thuần.

## R7 — Nav nhớ notebook (lastNotebook THUẦN)

- **Decision**: `getLastNotebookId()`/`setLastNotebookId(id)` qua localStorage `last-notebook-id`. Workspace
  `setLastNotebookId(notebookId)` trong effect khi mở. NavRail mục Workspace → `to={getLastNotebookId() ?
'/workspace/'+id : '/workspace'}`. `WorkspacePlaceholder` (bare `/workspace`): nếu `getLastNotebookId()`
  hợp lệ + notebook TỒN TẠI (kiểm qua `notebookList`) → `<Navigate to=/workspace/id>`; else CTA "Chọn
  notebook" → `/notebooks`.
- **Rationale**: nav là trạng thái UI → localStorage (không IPC mới). Kiểm tồn tại tránh mở notebook đã xoá.
  `lastNotebook` thuần → test get/set + parse rỗng/hỏng.

## Xác nhận code tái dùng

- `studio-service` (021) DI `{ listSources, listChunks, studioRepo, chat }` — thêm `sourceId` filter, KHÔNG
  đổi DI. Ngân sách qua `buildContext(scored, STUDIO_CONTEXT_BUDGET)` (constant nới rộng).
- `StudioGenerateInput` (021) +`sourceId?` (additive). `StudioResult` KHÔNG đổi (không `partsCount`).
- Export: electron `dialog` + `node:fs` (đã có ở main; không thêm dependency).

## Tổng kết

Không NEEDS CLARIFICATION. Không migration/dependency. KHÔNG map-reduce (đảo quyết định — chip [n] chính xác
tuyệt đối). Thay đổi 013 = 0. Nhóm A = tăng constant + `sourceId` filter + export + UI. B/C renderer thuần.
