# workspace-enhance clarify — chốt 6 ambiguity (025-workspace-enhance)

- Ngày: 2026-07-11
- Feature: `025-workspace-enhance` (issue #25)
- Nguồn: `docs/intake/025-workspace-enhance.md` + yêu cầu người dùng
- Người quyết định: hoanghainh1188 (2026-07-11) — "chốt luôn khuyến nghị".
- Chi tiết map-reduce/citation tách ADR: `2026-07-11-studio-mapreduce-citation.md`.

## Quyết định

**1. (SỬA 2026-07-11 — người dùng đảo quyết định) TĂNG NGÂN SÁCH, KHÔNG map-reduce.** Giữ chip `[n]` chính
xác TUYỆT ĐỐI (Constitution II ở mức cao nhất). Thay vì map-reduce, **nới `STUDIO_CONTEXT_BUDGET` 8000 →
16000** (vẫn dưới context window model local) để bao phủ notebook lớn hơn trong 1 lượt. Notebook vượt ngân
sách mới (16000) → vẫn chỉ tổng hợp phần đầu + cờ `truncated` + ghi chú (như 021) — KHÔNG hạ citation xuống
mức nguồn. Kết hợp với lọc-theo-nguồn (#2): người dùng tổng hợp riêng từng tài liệu lớn → mỗi lần vừa ngân
sách + chip chính xác. → ADR `2026-07-11-studio-mapreduce-citation.md` đánh dấu ĐÃ BÁC (phương án cân nhắc).
Ban đầu chốt map-reduce hybrid; người dùng ưu tiên độ chính xác citation nên chọn tăng ngân sách.

**2. Lọc theo nguồn — KHÔNG lưu tách theo nguồn.** Thêm `sourceId?` vào `studio:generate`; khi có → chỉ gom
chunk của nguồn đó vào ngữ cảnh. Kết quả vẫn lưu theo UNIQUE `(notebook_id, kind)` (ghi đè như thường) — MVP
không mở schema lưu tách theo nguồn. UI: dropdown "Tất cả nguồn / <nguồn>" ở đầu cột Studio.

**3. Export — Copy (clipboard) + Export .md (IPC mới).** Copy = `navigator.clipboard.writeText` (renderer
thuần). Export = kênh IPC mới `studio:export` (main mở `dialog.showSaveDialog` + ghi file .md; KHÔNG log nội
dung). Nút Copy + Export trên `StudioResultCard`.

**4. Lưu độ rộng cột — localStorage TOÀN CỤC.** Khoá `workspace-col-widths` (renderer). Min/max: Nguồn
220–460px, Studio 200–420px, Chat co giãn phần còn lại. Splitter kéo giữa cột 1-2 và 2-3.

**5. Nhớ notebook gần nhất — localStorage.** Khoá `last-notebook-id` (renderer, không IPC). Nút Workspace
trên rail → nếu có id đã lưu VÀ notebook còn tồn tại → mở `/workspace/<id>`; nếu không → placeholder có CTA
"Chọn notebook" (về `/notebooks`). Cập nhật `last-notebook-id` khi mở workspace 1 notebook.

**6. Kích thước — 1 feature, chia phase.** A (Studio: map-reduce + filter + Copy/Export + skeleton — đụng
main/IPC) → B (kéo đổi cột — renderer thuần) → C (nav nhớ notebook — renderer thuần).

## Điểm chạm (gap code)

- `studio-service.ts` (021): thêm nhánh map-reduce khi vượt ngân sách + tham số `sourceId?` (lọc nguồn).
- `studio:generate` input thêm `sourceId?`; kênh mới `studio:export` (main ghi .md qua save dialog).
- `StudioResultCard` (021): nút Copy/Export + skeleton; `StudioColumn`: dropdown chọn nguồn.
- `Workspace.tsx` + `sources.css`: splitter + grid động (CSS var độ rộng) + localStorage.
- `NavRail.tsx`/router: nút Workspace nhớ `last-notebook-id`; `WorkspacePlaceholder` thêm CTA.

## Hệ quả

- ADR `2026-07-11-studio-mapreduce-citation.md` REVISE mục "hoãn map-reduce" của `studio-context-strategy`.
- `security-reviewer` chạy (thêm ghi file qua dialog + clipboard). KHÔNG migration.
