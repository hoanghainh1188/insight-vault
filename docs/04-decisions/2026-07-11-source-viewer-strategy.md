# Source content reconstruction & highlight strategy (019-source-viewer)

- Ngày: 2026-07-11
- Feature liên quan: `019-source-viewer` (áp cho mọi feature sau cần hiển thị nguồn + highlight locator)
- Câu hỏi gốc: viewer cần TOÀN VĂN nguồn để highlight `[charStart,charEnd)`, nhưng offset là theo văn bản
  đã-làm-sạch lúc chunk (011), không phải file gốc. Chốt cách lấy toàn văn + chiến lược highlight từng loại.
- Người quyết định: hoanghainh1188 (2026-07-11)

## Quyết định

### 1. Tái dựng toàn văn từ chunk đã lưu (không re-parse/re-fetch)

Văn bản đã-làm-sạch `T` của một nguồn được khôi phục từ các `chunk` trong SQLite:

- `chunker.ts` (`splitRanges`) đảm bảo các chunk **liền kề, overlap, phủ kín `[0, len(T))`** — mỗi
  `chunk.text = T[charStart : charEnd)`.
- **Thuật toán tái dựng** (sắp chunk theo `charStart` tăng dần) — CÓ fill gap ranh giới trang:
  ```
  let out = "", pos = 0;
  for (const c of chunksSortedByCharStart) {
    if (c.charStart > pos) {           // GAP = ranh giới trang PDF ("\n\n" của PAGE_SEP, len 2)
      out += "\n".repeat(c.charStart - pos);
      pos = c.charStart;
    }
    if (c.charEnd <= pos) continue;    // đã phủ hoàn toàn (overlap)
    out += c.text.slice(pos - c.charStart); // chỉ nối phần đuôi chưa phủ
    pos = c.charEnd;
  }
  return out;                          // = T (== joinPages, đã verify)
  ```
  **Fill gap là BẮT BUỘC:** với PDF nhiều trang, `chunker.ts` join trang bằng `PAGE_SEP="\n\n"` và locator
  tính CẢ separator (base += 2/ranh giới), nhưng `chunk.text` KHÔNG chứa separator → nếu không fill gap,
  offset lệch 2 ký tự/ranh giới trang → highlight sai (vi phạm Constitution II). Đã VERIFY:
  `reconstruct(chunks) === joinPages(pages)` tuyệt đối + mọi `T.slice(charStart,charEnd) === chunk.text`.
  Overlap cắt bằng `pos - charStart`. Coverage `[0,len)` (trong từng trang) đảm bảo không hở ngoài separator.
- **Ưu điểm:** hoàn toàn local (Constitution I — URL không fetch lại); offset khớp `locator` 100% (cùng
  nguồn dữ liệu đã tạo locator); KHÔNG đụng schema/pipeline 011.

### 2. Highlight bằng OFFSET TOÀN CỤC (đồng nhất mọi loại nguồn)

- `Locator.charStart/charEnd` là offset TOÀN CỤC vào `T` (với PDF, `T` = các trang nối bằng `"\n\n"` —
  theo `chunker.ts` `PAGE_SEP`). ⇒ highlight = tô đoạn `T[charStart:charEnd)` TRỰC TIẾP, KHÔNG cần tính
  offset theo từng trang.
- Viewer render `T` dạng văn bản (text thuần, không canvas), bọc đoạn `[charStart,charEnd)` bằng thẻ
  highlight + nhãn "Trích dẫn [n]". Auto-scroll tới đầu đoạn khi mở.

### 3. Mốc trang (PDF) — pageBreaks

- Chỉ PDF có khái niệm trang. `pageBreaks = [{page, offset}]` suy từ chunk: với mỗi `page`, `offset` =
  `min(charStart)` của các chunk thuộc trang đó. Sắp theo `offset`.
- Viewer PDF: chèn mốc "Trang N" tại `offset`, pager "Trang N/M" cuộn tới `offset` tương ứng.
- Non-PDF (`page=null`): `pageBreaks=[]`, không pager — một trang dài cuộn tự do.

### 4. IPC + service

- Kênh `source:getContent(sourceId)` → `SourceContent { kind, title, pageCount, text, pageBreaks }` (null
  nếu nguồn đã xoá — A7).
- Logic tái dựng ở service mới `src/main/services/source-viewer/` (đọc `source-repo.listChunks/getById`),
  KHÔNG sửa `source-repo.ts` (011). Hàm thuần `reconstructText(chunks)` + `derivePageBreaks(chunks)` →
  unit-test tất định (không cần Electron).

## Lý do

- Tái dựng từ chunk là cách DUY NHẤT vừa local (URL không egress) vừa đảm bảo offset khớp locator tuyệt đối
  (re-parse/re-fetch có nguy cơ text lệch → highlight sai → vi phạm Constitution II).
- Offset toàn cục → highlight đồng nhất PDF/docx/txt/md/URL, không cần map offset-per-page phức tạp.
- Text-highlight (không canvas) đủ cho "kiểm chứng được" + khớp wireframe S4; canvas là polish sau.

## Phương án loại bỏ

- Re-parse file gốc / re-fetch URL — URL vi phạm Constitution I; file có nguy cơ lệch nếu đã sửa. Loại.
- Lưu `source.full_text` riêng lúc ingest — đụng ngược 011 (migration) + trùng lặp dung lượng với `chunk`.
  Loại (Constitution V: không phá pha trước khi không cần).
- Render canvas PDF + map offset↔bbox — phức tạp; để pha sau. Loại cho MVP.

## Hệ quả

- `src/main/services/source-viewer/`: `reconstruct.ts` (thuần: reconstructText + derivePageBreaks, test kỹ)
  - assembly đọc repo. Kênh `source:getContent`. Renderer `features/source-viewer/` (overlay panel +
    highlight). Nối `onCite` (013) + `onOpen` cột Nguồn (011).
- Feature sau (nếu cần hiển thị nguồn) tái dùng `getContent` + `reconstructText`.
