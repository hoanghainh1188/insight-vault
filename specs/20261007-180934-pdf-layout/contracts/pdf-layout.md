# Contract — bố cục trang PDF (hàm thuần, `src/main/services/ingestion/pdf-layout/`)

```text
layoutPage(items: LayoutItem[], page: PageGeometry): { text: string; blocks: {start,end}[]; fallback: boolean }
```

## Quy tắc

1. Bỏ item rỗng; item xoay giữ thứ tự gốc, nối cuối trang (sau nội dung thường).
2. Dòng: gom item chồng lấn dọc ≥ 50% chiều cao nhỏ hơn; sắp theo x; khe > 0,15 × h ⇒ một dấu cách (không trùng).
3. Cột: XY-cut theo khe dọc (≥ 2% bề rộng, ≤ 10% dòng cắt ngang), 2–3 cột; dòng trải toàn trang ở trên/dưới giữ vị trí;
   không có khe ⇒ một vùng.
4. Đoạn: khoảng cách baseline > 1,5 × chiều cao dòng ⇒ `\n\n`; còn lại nối bằng dấu cách; gạch nối cuối dòng + chữ
   thường đầu dòng sau ⇒ nối liền.
5. Bảng: ≥ 3 dòng liên tiếp, ≥ 2 ô/dòng, mép trái ô thẳng hàng (≤ 0,5 × h), cùng số cột ≥ 80% dòng; loại mục lục
   (`\.{4,}`) và danh sách đầu dòng ⇒ Markdown `| a | b |`, ô rỗng `| |`, `|` ⇒ `\|`, hàng phân cách `|---|` sau hàng
   đầu, bảng cách văn bản bằng `\n\n`; `blocks` ghi khoảng ký tự của bảng.
6. `text` ở dạng cố định của `cleanText` (`cleanText(text) === text`).
7. `items.length > MAX_LAYOUT_ITEMS_PER_PAGE` hoặc lỗi ⇒ `{ text: items.map(i=>i.text).join(" "), blocks: [],
   fallback: true }` (cách cũ).

## Bất biến

- Hàm thuần, không I/O; không bỏ chữ nào (mọi ký tự không rỗng của item xuất hiện đúng một lần trong `text`, trừ dấu
  gạch nối bị nối và dấu cách chuẩn hoá).
