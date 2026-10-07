# Research — 112 pdf-layout

Mọi quyết định nghiệp vụ đã chốt ở `docs/04-decisions/2026-10-07-pdf-layout-clarify.md`. Tài liệu này chốt CÁCH làm.

## R1. Dữ liệu đầu vào từ pdf.js

- **Decision:** dùng `page.getTextContent()` (đã dùng) — mỗi `TextItem` có `str`, `transform [a,b,c,d,e,f]` (e,f = gốc
  x,y theo điểm PDF, gốc toạ độ ở đáy trang), `width`, `height`, `dir`, `hasEOL`. Lấy thêm `page.getViewport({scale:1})`
  (rộng/cao trang) để chuẩn hoá. Một adapter mỏng chuyển item → `LayoutItem {text, x, y, w, h, rotated}` (y đổi về
  gốc trên-trái, `rotated` khi `b≠0 || c≠0`); mọi logic bố cục nằm ở hàm thuần nhận `LayoutItem[]`.
- **Rationale:** không cần render canvas / đọc operator list (giữ chi phí thấp, chạy ở main không worker); tách I/O khỏi
  logic ⇒ test tất định bằng item tổng hợp (Constitution IV).
- **Alternatives:** đọc đường kẻ ô qua `getOperatorList` (phát hiện bảng có viền chính xác hơn) — loại ở v1: phức tạp,
  chậm, và bảng không viền vẫn cần căn cột; có thể bổ sung sau.

## R2. Dựng dòng (lines)

- **Decision:** bỏ item rỗng/toàn khoảng trắng; item `rotated` tách nhóm riêng (giữ thứ tự gốc, nối cuối vùng chứa — FR
  edge case). Gom item vào dòng khi chồng lấn theo trục dọc ≥ 50% chiều cao nhỏ hơn; trong dòng sắp theo x; chèn dấu
  cách khi khe hở ngang > 0,15 × chiều cao chữ (item pdf.js thường đã có dấu cách riêng — không chèn trùng).
- **Rationale:** ngưỡng tương đối theo cỡ chữ ổn định giữa các PDF khác cỡ.

## R3. Thứ tự đọc nhiều cột

- **Decision:** trên mỗi trang, tính "khe cột": dải dọc x rộng ≥ 2% bề rộng trang mà ≤ 10% số dòng cắt ngang (bỏ qua
  dòng dài trải toàn trang như tiêu đề/chân trang). Có khe ⇒ chia trang thành vùng: phần trải toàn trang ở trên, các
  cột (trái→phải, mỗi cột trên→dưới), phần trải toàn trang ở dưới. Hỗ trợ 2–3 cột; không tìm được khe tin cậy ⇒ một vùng,
  đọc trên→xuống (FR-003).
- **Rationale:** thuật toán XY-cut đơn giản, đủ cho bài báo 2 cột/báo cáo; "best-effort" theo clarify #9.

## R4. Đoạn văn + gạch nối

- **Decision:** trong một vùng, dòng kế tiếp cách dòng trước > 1,5 × chiều cao dòng (khoảng cách baseline) ⇒ đoạn mới
  (`\n\n`); ngược lại nối bằng một dấu cách. Dòng kết thúc bằng `-` (hoặc U+00AD) và dòng sau bắt đầu bằng chữ thường
  ⇒ bỏ gạch, nối liền không dấu cách (FR-002). Không nhận diện heading.
- **Rationale:** đúng clarify #7; nối dòng làm chunk/embedding sạch, BM25 không bị cắt từ.

## R5. Nhận diện bảng (căn cột)

- **Decision:** trong một vùng, xét chuỗi ≥ 3 dòng liên tiếp mà mỗi dòng tách được thành ≥ 2 "ô" (cụm item cách nhau bởi
  khe ngang > 1 × chiều cao chữ) và mép trái các ô thẳng hàng giữa các dòng (sai lệch ≤ 0,5 × chiều cao chữ, cùng số
  cột trên ≥ 80% số dòng). Loại trừ: mẫu dấu chấm dẫn mục lục (`\.{4,}`), dòng mà ô cuối chỉ là số trang của mục lục,
  danh sách đánh dấu đầu dòng. Không đạt ⇒ giữ văn bản dòng (FR-005). Ô nhiều dòng: dòng kế tiếp chỉ có chữ ở một số cột
  và không có khe mới ⇒ nối vào ô phía trên bằng dấu cách.
- **Rationale:** "thà bỏ sót còn hơn nhận nhầm"; ngưỡng tương đối theo cỡ chữ; SC-002 đo cả mẫu "không phải bảng".
- **Alternatives:** ML/heuristic phức tạp (Camelot/Tabula kiểu stream) — quá nặng cho v1.

## R6. Định dạng Markdown + `cleanText`

- **Decision:** `| a | b |` — mỗi ô bọc bởi đúng một dấu cách; ô rỗng ghi `| |` (một dấu cách, ổn định qua `cleanText`
  vốn gộp khoảng trắng); `|` trong ô ⇒ `\|`; xuống dòng trong ô ⇒ dấu cách; hàng phân cách `|---|---|` sau hàng đầu;
  bảng cách văn bản xung quanh bằng `\n\n`. `cleanText` KHÔNG đổi (kết quả trên đã là dạng cố định của nó) ⇒ nguồn khác
  loại không bị ảnh hưởng (FR-009, FR-023). Test: `cleanText(render(table)) === render(table)`.
- **Rationale:** tránh sửa hàm dùng chung; biểu diễn "đã chuẩn hoá sẵn".

## R7. Chia đoạn không cắt bảng

- **Decision:** `PageText` thêm trường tuỳ chọn `blocks?: {start,end}[]` (khoảng ký tự của bảng trong trang, do parser
  PDF trả). `chunkPages` khi có `blocks`: (a) điểm cắt rơi trong một bảng có độ dài ≤ `CHUNK_SIZE` ⇒ lùi về ngay trước
  bảng (nếu vẫn tiến được), không thì tiến tới hết bảng; (b) bảng dài hơn ⇒ chỉ cắt tại `\n` giữa hai hàng; (c) điểm bắt
  đầu chunk kế (sau overlap) rơi giữa một hàng ⇒ dời về đầu hàng đó. Không có `blocks` ⇒ hành vi y như cũ (các loại
  nguồn khác). `chunk.text === T.slice(charStart,charEnd)` giữ nguyên (FR-008, FR-019).
- **Rationale:** thay đổi cục bộ, tương thích ngược; `cleanText` không đổi độ dài phần bảng ⇒ `blocks` vẫn đúng sau làm
  sạch — parser phát `blocks` theo văn bản đã ở dạng cố định của `cleanText`; pipeline xác minh `blocks` sau clean (lệch
  ⇒ bỏ `blocks` cho trang đó, an toàn).

## R8. Dự phòng theo trang + hiệu năng

- **Decision:** mỗi trang: số item > `MAX_LAYOUT_ITEMS_PER_PAGE` (= 5000) hoặc hàm bố cục ném lỗi ⇒ dùng cách nối cũ
  (`items.map(str).join(" ")`) cho trang đó (FR-007). Độ phức tạp O(n log n) mỗi trang (sắp xếp). Đo: PDF tự sinh 50 trang
  2 cột + bảng, so thời gian `parsePdf` cũ/mới (≤ 2× — SC-006) trong một test hiệu năng (bỏ qua trên CI chậm bằng
  ngưỡng rộng hơn, log số đo).
- **Rationale:** không để một trang bất thường làm hỏng cả tài liệu.

## R9. Phiên bản trích xuất (FR-011)

- **Decision:** migration #9: `ALTER TABLE source ADD COLUMN extraction_version INTEGER NOT NULL DEFAULT 1`. Hằng
  `PDF_EXTRACTION_VERSION = 2` (bố cục); PDF thêm mới/xử lý lại ghi 2; nguồn cũ giữ 1 (mọi loại). `Source` thêm
  `extractionVersion`. Gợi ý "Xử lý lại để giữ bố cục" khi `kind==="pdf" && extractionVersion < PDF_EXTRACTION_VERSION`.
- **Rationale:** append-only như #6/#8; số nguyên cho các lần nâng thuật toán sau.

## R10. Xử lý lại nguyên tử (FR-015)

- **Decision:** `pipeline.reprocess(id)` xếp vào hàng đợi tuần tự hiện có; nguồn GIỮ trạng thái `ready` (vẫn hỏi đáp/tìm
  kiếm/xem bằng dữ liệu cũ) — tiến độ báo qua `source:progress` với cờ `reprocess: true`. Các bước:
  1. parse (theo trang, tiến độ) → clean → chunk (trong RAM) → sinh trước id cho chunk mới (uuid);
  2. embed (trong RAM);
  3. kiểm `signal.cancelled` / nguồn còn tồn tại / kho không bị khoá sao lưu;
  4. `vectorStore.add(new)` (id mới, chưa ai trỏ tới);
  5. SQLite MỘT transaction: xoá chunk cũ (trigger xoá FTS) + chèn chunk mới với id định trước (trigger/insert FTS như
     `insertChunks`) + `extraction_version` + `page_count` + `updated_at`;
  6. `vectorStore.deleteByIds(oldIds)`.
     Lỗi/huỷ ở 1–4 ⇒ không đổi gì (bước 4 lỗi ⇒ xoá các id mới đã thêm). Lỗi ở 5 ⇒ rollback + xoá vector mới. Lỗi ở 6 ⇒ vector
     mồ côi (chunk không còn) — vô hại cho đúng đắn (`getChunksByIds` bỏ id thiếu) + ghi log sự kiện (không nội dung); dọn ở
     lần xử lý lại/xoá nguồn sau (`deleteBySource`). Thất bại ⇒ phát sự kiện lỗi (thông báo), trạng thái nguồn vẫn `ready`.
     Nguồn `error` (chưa từng ready): "Xử lý lại" = `retry` theo cách mới.
- **Rationale:** dữ liệu cũ dùng được tới phút chót; không cần bảng tạm.
- **Alternatives:** dựng vào source tạm rồi đổi id — phức tạp với FK/notebook; bỏ.

## R11. Điều kiện chặn (FR-014)

- **Decision:** kênh `source:reprocess` (main) kiểm theo thứ tự: vault lock (`assertVaultWritable`) → nguồn tồn tại, là
  PDF, trạng thái `ready|error` và không đang trong hàng đợi → tệp gốc tồn tại (không ⇒ `{status:"missing"}`, renderer mở
  luồng "Chọn lại tệp gốc…" 101) → SHA-256 tệp = `content_hash` (khác ⇒ `{status:"mismatch"}`, chặn) → xếp hàng
  (`{status:"queued"}`). Tái dùng `hashFileStreaming` + logic so khớp của `relink`. Trước bước swap (R10.3) kiểm lại vault
  lock: đang khoá ⇒ huỷ lần xử lý lại, giữ dữ liệu cũ, báo lỗi "đang sao lưu".
- **Rationale:** cùng nguyên tắc relink (101): chỉ chấp nhận nội dung giống lúc nạp.

## R12. Trích dẫn cũ (FR-017/018)

- **Decision:** nhận diện trích dẫn cũ bằng **sự tồn tại của `chunkId`**: xử lý lại sinh id chunk mới ⇒ mọi trích dẫn
  tạo trước đó trỏ id không còn trong nguồn. `source:getContent` nhận thêm `chunkId` tuỳ chọn và trả
  `citationValid: boolean` (id thuộc nguồn hay không). Viewer: `citationValid === false` ⇒ mở nguồn, cuộn tới trang
  `locator.page` (nếu còn trong phạm vi), KHÔNG highlight, hiện ghi chú "Nguồn đã được xử lý lại — vị trí trích dẫn cũ
  không còn chính xác".
- **Rationale:** tất định, không cần lưu thời điểm; đúng cả với câu trả lời đang hiển thị trong phiên (chưa có
  `createdAt`), Studio, lịch sử; không cần migration cho chat/Studio. Prompt gợi ý "so thời điểm" — thay bằng cách này vì
  chính xác hơn (không phụ thuộc đồng hồ, không cần cột mới).
- **Alternatives:** lưu `reprocessed_at` và so với `created_at` của tin nhắn/Studio — phải truyền thời điểm theo từng
  chip, sai với kết quả trong phiên; bỏ.

## R13. Fixture PDF tự sinh (FR-022)

- **Decision:** `tests/fixtures/pdf/make-pdf.ts` — trình sinh PDF tối giản (thuần TS, không thêm dependency) viết đối
  tượng PDF + content stream `BT … Tf … Td (…) Tj ET` ở toạ độ chỉ định, đường kẻ `re S` cho bảng có viền, trang xoay
  (`/Rotate 90` và chữ có ma trận xoay). Chữ Latin: font chuẩn Helvetica. Tiếng Việt: nhúng `LiberationSans-Regular.ttf`
  có sẵn trong `pdfjs-dist/standard_fonts` (giấy phép SIL OFL — `LICENSE_LIBERATION`) dạng TrueType + `/Encoding
/Differences` (tên glyph `uniXXXX`) + `ToUnicode` CMap. Các PDF sinh trong thư mục tạm lúc chạy test (không commit nhị
  phân). Test thuần dùng `LayoutItem[]` tổng hợp; test tích hợp chạy `parsePdf` thật trên PDF sinh.
- **Rationale:** không vướng bản quyền, tất định, không phình repo.
- **Alternatives:** thêm `pdf-lib` + `fontkit` (devDependency) — dùng nếu trình sinh tay không ổn với font nhúng
  (ghi ADR khi đổi).

## R14. Bộ đánh giá 108

- **Decision:** chạy `EVAL_MODE=current npm run eval:retrieval` trước/sau ⇒ phải báo "hồi quy OK" (bộ đánh giá toàn
  Markdown; `cleanText`/chunker không đổi khi không có `blocks`). Thêm PDF vào bộ đánh giá để sau (clarify #13).
