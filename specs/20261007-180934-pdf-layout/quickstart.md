# Quickstart — kiểm chứng 112 pdf-layout

## Điều kiện

Node 24, `npm ci`. Không cần Internet (fixture PDF sinh trong thư mục tạm lúc chạy test).

## 1. Unit + tích hợp

```bash
npm test
```

Kỳ vọng xanh, coverage ≥ 80%, gồm:

- `pdf-layout` (hàm thuần trên item tổng hợp): dựng dòng, 2/3 cột, đoạn + gạch nối, bảng có/không viền, mục lục/danh
  sách KHÔNG bị nhận là bảng, ô rỗng/`|`/nhiều dòng, trang xoay, tiếng Việt có dấu, dự phòng khi quá nhiều item.
- `parsePdf` trên PDF tự sinh (1 cột, 2 cột, bảng, tiếng Việt nhúng font): văn bản đúng thứ tự, bảng Markdown đúng ô.
- `chunker` có `blocks`: bảng ngắn không bị cắt, bảng dài cắt theo hàng, `chunk.text === T.slice(...)`; không có
  `blocks` ⇒ kết quả y như cũ.
- `cleanText(render(table)) === render(table)`.
- Migration #9; pipeline `reprocess`: thành công hoán đổi + `extraction_version = 2`; lỗi/huỷ ở từng bước ⇒ dữ liệu cũ
  nguyên vẹn; vault lock / tệp mất / hash khác ⇒ đúng kết quả contract.
- `source:getContent` với `chunkId` cũ ⇒ `citationValid: false`.
- Hiệu năng: PDF tự sinh nhiều trang — thời gian cách mới ≤ 2× cách cũ (SC-006).

## 2. Hồi quy bộ đánh giá 108

```bash
EVAL_MODE=current npm run eval:retrieval
```

Kỳ vọng: "✓ Khớp số liệu ghi trong RELEVANCE_CALIBRATION (hồi quy OK)".

## 3. Gate

```bash
npm run lint && npm run build && npx playwright test
```

## 4. Thử trên app (`npm run dev`)

1. Nạp một PDF bài báo 2 cột ⇒ mở trình xem nguồn: đọc hết cột trái rồi cột phải, có tách đoạn.
2. Nạp một PDF có bảng ⇒ trình xem nguồn hiện `| ô | ô |` + hàng `|---|`; hỏi một giá trị trong bảng ⇒ chip `[n]` tô sáng
   đúng vùng bảng.
3. Với một PDF nạp TRƯỚC khi cài bản này: cột Nguồn có gợi ý "Xử lý lại để giữ bố cục"; hỏi một câu để có chip `[n]`.
4. Menu nguồn ⇒ "Xử lý lại" ⇒ hộp xác nhận nêu hệ quả ⇒ đồng ý ⇒ tiến độ theo trang (nguồn vẫn hỏi đáp được trong lúc
   chạy) ⇒ xong, gợi ý biến mất.
5. Bấm chip `[n]` cũ ở bước 3 ⇒ nguồn mở, không tô sáng, có ghi chú "vị trí trích dẫn cũ không còn chính xác"; hỏi lại ⇒
   chip mới tô sáng đúng.
6. Đổi tên/di chuyển tệp gốc rồi "Xử lý lại" ⇒ dẫn sang "Chọn lại tệp gốc…"; sửa nội dung tệp gốc ⇒ bị chặn kèm lý do.
7. Bấm "Xử lý lại" rồi huỷ giữa chừng ⇒ nguồn vẫn dùng dữ liệu cũ.
