# source-viewer clarify — chốt 9 ambiguity (019-source-viewer)

- Ngày: 2026-07-11
- Feature liên quan: `019-source-viewer` (pha 006, issue #19)
- Nguồn: `docs/intake/019-source-viewer.md` (9 ambiguity A1–A9) + phiên chốt với hoanghainh1188
- Người quyết định: hoanghainh1188 (2026-07-11). 3 quyết định kiến trúc do người dùng chọn trực tiếp (⭐);
  6 mục còn lại ủy quyền "chốt luôn khuyến nghị".
- Chi tiết tái dựng + highlight tách ADR riêng: `2026-07-11-source-viewer-strategy.md`.

## Quyết định theo từng ambiguity

**⭐ A1 — Lấy toàn văn: TÁI DỰNG TỪ CHUNK ĐÃ LƯU.** `listChunks(sourceId)` → ghép `chunk.text` theo
`charStart` tăng dần, cắt overlap → khôi phục đúng văn bản đã-làm-sạch. Hoàn toàn local (không re-parse
file, không re-fetch URL → đúng Constitution I), offset khớp `locator` 100%, KHÔNG đụng 011. Thuật toán
dedup + tái dựng ở ADR strategy.

**⭐ A2 — PDF: TEXT ĐÃ TRÍCH + HIGHLIGHT** (không render canvas). Hiển thị văn bản đã trích, tô nền đoạn
chunk (khớp wireframe S4, đủ "kiểm chứng được"). Render canvas PDF nguyên bản để pha sau (polish).

**⭐ A3 — Vị trí: OVERLAY/PANEL** trượt phủ trên Workspace, nút đóng để về chat (giữ ngữ cảnh). KHÔNG thay
toàn màn như wireframe (UX tốt hơn — nhảy qua lại chat↔nguồn dễ).

**A4 — Kênh IPC + payload.** Thêm 1 kênh `source:getContent(sourceId)` → `SourceContent { kind, title,
pageCount, text, pageBreaks }`:

- `text` = toàn văn tái dựng (đã-làm-sạch). Highlight dùng TRỰC TIẾP `locator.charStart/charEnd` (offset
  TOÀN CỤC vào `text`) → không cần tính offset theo trang. Đồng nhất mọi loại nguồn.
- `pageBreaks` = `[{page, offset}]` (chỉ PDF): offset ký tự nơi mỗi trang bắt đầu (suy từ chunk.page) — cho
  pager "Trang N" + chèn mốc trang. Non-PDF: `[]`.
  Viewer đã có `Citation.locator` từ cú bấm chip → chỉ cần `text` để hiển thị + highlight.

**A5 — Điều hướng nhiều chip.** Viewer state-driven: bấm chip khác (kể cả khi viewer đang mở) → cập nhật
tại chỗ (đổi nguồn nếu khác `sourceId`, đổi highlight theo locator mới). MVP KHÔNG có nút prev/next trong
viewer (điều hướng bằng bấm chip ở chat). Nhiều chip cùng notebook → mỗi lần bấm mở đúng chip đó.

**A6 — Ranh giới Constitution III.** Điều khoản "tài liệu/vector thô không đi qua renderer" nhắm: renderer
KHÔNG tự truy cập FS/DB — phải xin qua IPC main. Trả **văn bản nguồn để HIỂN THỊ** cho người dùng (đúng mục
đích viewer) qua kênh whitelisted `source:getContent` là **hợp lệ** — đây là nội dung người dùng chủ động
yêu cầu xem, không phải rò rỉ. "Vector thô" (embedding) vẫn KHÔNG bao giờ gửi ra renderer. Không log nội
dung tài liệu.

**A7 — Nguồn/chunk đã xoá.** `getContent` cho `sourceId` không tồn tại → trả `null`; viewer hiển thị thông
báo thân thiện "Nguồn không còn tồn tại." + nút đóng. Bấm chip trỏ chunk mồ côi → tương tự (highlight rỗng,
báo nhẹ).

**A8 — Non-PDF (page=null) cuộn theo gì.** Một trang dài cuộn tự do; khi mở, **auto-scroll tới `charStart`**

- highlight; KHÔNG có pager (không có khái niệm trang). PDF: chèn mốc "Trang N" theo `pageBreaks` + pager
  nhảy trang (cuộn tới offset trang).

**A9 — Mở nguồn TRỰC TIẾP từ cột Nguồn.** TRONG phạm vi (khớp wireframe S2 dòng 384). Bấm tên nguồn ở cột
Nguồn (011) → mở viewer nguồn đó ở ĐẦU tài liệu, KHÔNG highlight (không có citation). Tái dùng cùng viewer +
`getContent`. Điểm chạm: `SourceItem`/`SourceList` (feature 011) thêm `onOpen(sourceId)` — sửa nhỏ, tách
commit rõ.

## Gap code (điểm chạm feature khác — tách commit)

- `MessageBubble.tsx`/`ChatColumn.tsx` (013): nối `onCite(citation)` thật → mở viewer.
- `SourceItem.tsx`/`SourceList.tsx` (011): thêm `onOpen(sourceId)` → mở viewer (A9).
- `source-repo.ts` (011): CHỈ đọc (`listChunks`, `getById`) — KHÔNG sửa schema. Logic tái dựng nằm ở service
  mới `src/main/services/source-viewer/`.
- THÊM kênh `source:getContent` + type `SourceContent` (shared).

## Hệ quả

- `/speckit-plan` bám ADR `2026-07-11-source-viewer-strategy.md` (tái dựng + highlight) + clarify này.
- KHÔNG migration/schema mới; KHÔNG đụng pipeline 011. Chỉ đọc dữ liệu đã có.
- `security-reviewer` chạy (đọc nội dung nguồn qua IPC + hiển thị) — soi không-log + ranh giới III (A6).
