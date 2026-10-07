# PDF giữ bố cục — dòng, thứ tự đọc nhiều cột, bảng; "Xử lý lại" nguyên tử (112)

- Ngày: 2026-10-07
- Feature liên quan: `112-pdf-layout` (issue #112) — spec `specs/20261007-180934-pdf-layout/`
- Câu hỏi gốc: `parsers/pdf.ts` nối mọi mẩu chữ của trang bằng dấu cách ⇒ mất xuống dòng, chữ hai cột đan xen, bảng bị
  dẹt. Cần cách trích giữ bố cục mà không phá trích dẫn kiểm chứng được (Constitution II) và không đụng dữ liệu cũ.
- Người quyết định: Hải (2026-10-07) — xem `2026-10-07-pdf-layout-clarify.md` (15 câu + 3 quyết định trong issue).
- Liên quan: `2026-07-11-chunking-strategy.md` (chunk không vắt trang, locator gắn lúc chunk),
  `2026-07-11-ingestion-clarify.md` (pdf.js, giới hạn 50 MB, retry), `2026-07-11-source-viewer-strategy.md` (viewer dựng
  lại từ chunk), relink 101.

## Quyết định

### 1. Trích có bố cục (hàm thuần `src/main/services/ingestion/pdf-layout/`)

`parsers/pdf.ts` chỉ còn là adapter: item pdf.js (`str`, `transform`, `width`, `height`) ⇒ `LayoutItem` (toạ độ gốc
trên-trái theo `page.view`, `rotated` khi ma trận có thành phần xoay) ⇒ `layoutPage`:

| Bước                   | Quy tắc (ngưỡng theo cỡ chữ `h`)                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dòng (`lines.ts`)      | Gom item chồng lấn dọc ≥ 50%; sắp theo x; khe > 0,15·h ⇒ một dấu cách; khe > 1·h ⇒ segment riêng (ô/cột). Item xoay tách riêng, nối cuối trang.                                                                                                                                                                                                                      |
| Cột (`columns.ts`)     | XY-cut theo khe dọc giữa các segment hẹp (< 50% vùng), khe ≥ 2% bề rộng trang, ở 70% giữa vùng; chỉ tách khi cả hai bên là cột chữ "dày" (trung vị bề rộng segment ≥ 25% bề rộng trang — để không xé bảng) và dòng cắt ngang trong thân ≤ 10%. Tiêu đề/chân trang cắt ngang ở trên/dưới giữ vị trí. Tối đa 2 lần tách (≤ 4 cột). Không nhận ra cột ⇒ đọc trên→xuống. |
| Đoạn (`paragraphs.ts`) | Baseline cách > 1,5·h ⇒ đoạn mới (`\n\n`), còn lại nối bằng dấu cách. Gạch nối cuối dòng (sau chữ cái) + chữ thường đầu dòng sau ⇒ nối liền bỏ gạch; + chữ hoa ⇒ giữ gạch, nối liền; U+00AD ⇒ bỏ, nối liền. Không nhận diện heading.                                                                                                                                 |
| Bảng (`tables.ts`)     | ≥ 3 hàng × ≥ 2 cột, mép trái ô thẳng hàng (≤ 0,5·h); ≥ 80% hàng có ≥ 2 ô có chữ; loại mục lục (`.{4,}`), danh sách đầu dòng, ô dài như văn xuôi (trung vị ≥ 25% bề rộng trang). Dòng sát hơn 1,25·h và ít ô hơn ⇒ phần tiếp của ô nhiều dòng; hàng cách > 2,5·h ⇒ hết bảng.                                                                                          |
| Markdown               | `\| a \| b \|`, ô rỗng `\| \|`, `\|` trong ô ⇒ `\\\|`, hàng phân cách `\|---\|` sau hàng đầu, bảng cách văn bản `\n\n` — đúng dạng cố định của `cleanText` (không sửa `cleanText`).                                                                                                                                                                                  |
| Dự phòng               | > 5000 item/trang hoặc bất kỳ lỗi nào ⇒ trang đó dùng cách nối cũ.                                                                                                                                                                                                                                                                                                   |

Không xoá gì khỏi trang (đầu/chân trang, số trang giữ nguyên — ưu tiên kiểm chứng được).

### 2. Chia đoạn tôn trọng bảng

`PageText.blocks` (khoảng ký tự của bảng, parser PDF điền). `chunkPages`: bảng ≤ `CHUNK_SIZE` không bị cắt ngang (cắt
trước bảng nếu vẫn tiến được, không thì hết bảng); bảng dài chỉ cắt sau `\n` giữa hai hàng; điểm bắt đầu sau overlap rơi
giữa hàng ⇒ dời về đầu hàng. Pipeline chỉ giữ `blocks` khi `cleanText` không đổi văn bản trang. Không có `blocks` ⇒ hành vi
y hệt cũ — snapshot txt/md/docx + văn bản dài chụp từ `main` trước khi sửa (`tests/unit/ingestion-other-kinds-unchanged`).

### 3. Phiên bản trích + "Xử lý lại"

- Migration #9: `source.extraction_version INTEGER NOT NULL DEFAULT 1`; `PDF_EXTRACTION_VERSION = 2`. PDF nạp mới ghi 2;
  nguồn cũ giữ 1 ⇒ cột Nguồn hiện gợi ý thụ động "Xử lý lại để giữ bố cục". Không tự chạy nền.
- `source:reprocess` (chỉ nhận `sourceId`): khoá kho (085) → quy tắc (`reprocess-guard.ts`: phải là PDF `ready|error`,
  không trong hàng đợi) → tệp gốc còn? (không ⇒ `missing`, UI mở "Chọn lại tệp gốc…" 101 rồi chạy tiếp) → SHA-256 =
  `content_hash`? (khác ⇒ `mismatch`, chặn) → xếp hàng. `source:reprocessCancel` huỷ.
- Nguồn `ready`: giữ `ready` suốt quá trình (vẫn hỏi đáp/tìm/xem bằng dữ liệu cũ); parse → chunk → embed TRONG RAM →
  `vectorStore.add(mới)` → `replaceChunks` (MỘT transaction SQLite: xoá chunk cũ + FTS, chèn chunk mới với id định trước,
  version + page_count) → `deleteByIds(cũ)`. Lỗi/huỷ trước hoán đổi ⇒ không đổi gì (vector mới đã thêm bị xoá); khoá kho
  lúc hoán đổi ⇒ huỷ + báo. Lỗi xoá vector cũ ⇒ vector mồ côi vô hại (chunk không còn ⇒ `getChunksByIds` bỏ qua), ghi sự
  kiện `ingest.reprocess.orphanVectors`. Kiểm khoá kho thêm lần nữa NGAY TRƯỚC `replaceChunks` (sau khi ghi vector); lần xử lý lại đang chờ/chạy được tính là "bận" với sao lưu (`pipeline.isReprocessing()`). Nội dung tệp được băm lại lúc đọc — khác `content_hash` (tệp bị sửa khi đang chờ) ⇒ huỷ, giữ bản cũ. Huỷ việc còn trong hàng đợi ⇒ kết thúc ngay (`SerialQueue.cancel` trả `dropped`). Nguồn `error` ⇒ như "Thử lại" bằng cách trích mới. App đóng giữa chừng ⇒ nguồn
  ready giữ dữ liệu cũ; nguồn đang thử lại về `error` (như cũ).
- UI: nút "Xử lý lại" cạnh "Thử lại"/"Xoá" (cột Nguồn dùng nút, không có menu), hộp xác nhận nội tuyến
  (`role="alertdialog"`) nêu hệ quả với trích dẫn cũ, thanh tiến độ theo trang + Huỷ, thông báo cho trình đọc màn hình.

### 4. Trích dẫn cũ

Nhận diện bằng `chunkId` KHÔNG còn thuộc nguồn (xử lý lại luôn sinh id chunk mới) thay vì so thời điểm — tất định, đúng
cả với chip trong phiên và Studio, không cần migration cho chat/Studio. `source:getContent` nhận thêm
`{sourceId, chunkId}` và trả `citationValid`; `false` ⇒ viewer mở nguồn, không tô sáng, ghi chú "Nguồn đã được xử lý lại —
vị trí trích dẫn cũ không còn chính xác". Input sai kiểu ⇒ `null` (giữ hành vi cũ của kênh).

### 5. Kiểm thử

PDF mẫu tự sinh (`tests/fixtures/pdf/make-pdf.ts`): Helvetica + `/Differences` + `/ToUnicode` + `/Widths` cố định —
không nhúng font nào (đơn giản hơn kế hoạch nhúng LiberationSans; pdf.js trích đúng tiếng Việt cả NFC lẫn NFD).

## Số liệu

- SC-006: PDF tự sinh 50 trang (2 cột + bảng) — cách mới ≈ 0,9–1,4× cách cũ tuỳ tải máy (≤ 2×). Thời gian chủ yếu ở pdf.js.
- Bộ đánh giá 108 (`EVAL_MODE=current`): "hồi quy OK" (toàn Markdown — không đổi).

## Giới hạn

- Từ ghép có gạch nối rơi đúng cuối dòng ("long-" / "term") bị nối thành "longterm" (đúng FR-002, chấp nhận; văn bản
  vẫn là chính tắc nên trích dẫn không lệch).
- Bảng neo theo mép TRÁI ô ⇒ cột số căn phải (bảng tài chính) thường không được nhận là bảng — giữ văn bản dòng (thà bỏ
  sót).
- Chữ xoay chỉ khi góc ≳ 17° (sin > 0,3); chữ nghiêng (shear) và lệch nhỏ là chữ thường. Trang có `/Rotate` chưa được
  xoay toạ độ riêng (toạ độ theo hệ của nội dung).

- Best-effort: bảng không căn thẳng cột, ô gộp, bảng xoay, trang > 4 cột, chữ bao quanh hình có thể đọc chưa đúng; nhận
  diện bảng ưu tiên bỏ sót hơn nhận nhầm. PDF quét (OCR) ngoài phạm vi.
- pdf.js tự gộp các mẩu chữ sát nhau thành ít item hơn ⇒ ngưỡng 5000 item/trang hiếm khi chạm ở PDF thật.
- Trình xem nguồn hiển thị bảng dạng văn bản `| a | b |`; hiển thị dạng lưới để feature sau.
