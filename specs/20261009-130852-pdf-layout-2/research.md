# Research — 147 Bố cục PDF đợt 2

## R1 — Lưới bảng: dữ liệu từ văn bản (e)

- **Decision**: hàm thuần `parsePdfTables(text, pageBreaks) ⇒ PdfTable[]` ở `src/shared/pdf-tables.ts`. Khối hợp lệ: ≥ 3 dòng liên tiếp, mỗi dòng bắt đầu và kết
  thúc bằng `|`; dòng 2 khớp hàng phân cách `^\|(\s*-{3,}\s*\|)+$`; số ô mọi dòng bằng nhau (tách theo `|` không thoát — `\|` là ký tự trong ô); khối không vắt
  `pageBreaks`. Mỗi ô trả `{start, end}` (vị trí ký tự **trong văn bản gốc**, không tính dấu `|` và khoảng trắng đệm hai bên) + `text` (đã bỏ thoát `\|`).
  Chỉ gọi khi `kind === "pdf"`.
- **Rationale**: `blocks` không được lưu (intake #7); `renderTable` của 112 là định dạng tất định ⇒ phân tích lại an toàn; không IPC / migration; chạy với PDF v2.
- **Alternatives**: main trả `tables` trong `SourceContent` (đổi IPC, cần dựng lại từ chunk vẫn phải phân tích văn bản); lưu `blocks` (migration).

## R2 — Tô sáng trong lưới (e)

- **Decision**: `buildSegments(text, highlight, pageBreaks, tables?)` trả danh sách khối `{kind:"text", segments}` | `{kind:"table", rows:[{cells:[{segments}]}]}`;
  segments của ô = `buildSegments` cục bộ trên `[cell.start, cell.end)` với cùng `hl` đã chỉnh (trimRange / alignStart của 157/159 áp trên văn bản đầy đủ TRƯỚC). Ký
  tự khung (`|`, hàng phân cách, khoảng trắng đệm) không hiển thị nên không cần tô. Nhãn `[n]` + `ref` cuộn tới đoạn tô đầu tiên (có thể trong ô). Test thuộc tính:
  với `[a,b)` ngẫu nhiên, hợp các ký tự được tô (gồm cả ngoài bảng) == `text.slice(a,b)` sau khi bỏ ký tự khung.
- **Rationale**: chính xác theo ký tự (clarify #8); tái dùng logic hiện có; không mất tính năng 157/159.

## R3 — Trang xoay qua viewport pdf.js (c)

- **Decision**: trong `parsePdf`: `const vp = page.getViewport({ scale: 1 })`; với mỗi item, điểm gốc chữ `[e, f]` ⇒ `vp.convertToViewportPoint(e, f)` (hệ hiển thị,
  gốc trên-trái, đã xoay + trừ gốc CropBox); hướng chữ = ma trận item nhân phần xoay của `vp.transform` ⇒ `rotated` tính trên hướng hiển thị; `PageGeometry =
{width: vp.width, height: vp.height}`. Hàm thuần `toDisplayItem(item, vpTransform)` (ma trận tiêm vào) để test 0 / 90 / 180 / 270 không cần pdf.js. Thí nghiệm
  xác nhận với fixture thật (pdf.js) — nếu `convertToViewportPoint` khác kỳ vọng thì dùng ma trận `vp.transform` trực tiếp.
- **Rationale**: pdf.js đã chuẩn hoá `/Rotate` thừa kế, CropBox, `userUnit`; `pdf-layout/` giữ thuần; sửa luôn lệch gốc CropBox (intake #13).
- **Alternatives**: tự tính ma trận từ `page.rotate` + `view` (dễ sai); xoay trong `layoutPage` (lộ khái niệm trang vào tầng bố cục).

## R4 — Phiên bản + gợi ý "Xử lý lại"

- **Decision**: `PDF_EXTRACTION_VERSION = 3` ở PR2 (đợt trích xuất đầu tiên); PR3 / PR4 cùng đợt phát hành dùng lại 3 (không phát hành giữa chừng; nếu buộc phải phát hành
  sau PR2 thì PR sau tăng tiếp — ghi ADR). Hàm thuần `reprocessHintKey(version) ⇒ "reprocessHint" | "reprocessHintV2" | null`: v1 ⇒ câu cũ "giữ bố cục"; v2 ⇒ "cải thiện
  bảng, trang xoay và gạch nối"; ≥ hiện hành ⇒ null. Không xử lý lại hàng loạt.
- **Rationale**: tránh câu sai nghĩa cho PDF v2 (intake #23); không thêm cột DB.

## R5 — Bảng số căn phải (b)

- **Decision**: trong `detectTables`, khi `startRun/extendRun` không tạo được run ≥ `TABLE_MIN_ROWS`, thử `detectRightAlignedTable(lines)` trên cụm dòng liên tiếp
  ≥ 2 segment: (1) `looksNumeric(s)` = regex `^[(−\-+]?[$€£¥₫]?\s?\d{1,3}([.,\s]\d{3})*([.,]\d+)?\s?%?[)]?(\s?(đ|₫|VND|USD))?$` (và số trơn); (2) cột = cụm mép phải
  `x + w` trong 0,5·h (hoặc `decimalAnchor` = x + tỉ lệ ký tự trước dấu thập phân × w khi mép phải lệch); (3) ô không phải số gán cột theo chồng lấn khoảng x;
  (4) ngưỡng: ≥ 3 hàng dữ liệu, ≥ 2 cột, (≥ 2 cột số HOẶC 1 cột số có ≥ 4 hàng), mép phải khớp ≥ 90% ô số, và KHÔNG phải cột số nguyên tăng đơn điệu đơn lẻ (mục lục);
  giữ loại trừ chấm dẫn / bullet / ô dài. Kết quả đưa vào `renderTable` như bảng căn trái. Bảng căn trái hiện có đi đường cũ ⇒ không đổi.
- **Rationale**: thà bỏ sót (112 #5); test cũ nguyên.

## R6 — Gạch nối (a)

- **Decision**: `decideHyphen(prevWord, nextWord, lexicon) ⇒ "keep" | "join" | "default"`, thứ tự: (1) U+00AD ⇒ join; (2) token có chữ tiếng Việt đặc trưng (ă â ê ô ơ ư
  đ hoặc dấu thanh tổ hợp) ở một phía ⇒ keep (nối liền, không dấu cách); (3) `nextWord` chữ hoa / số, hoặc `prevWord` có số ⇒ keep (như cũ); (4) gạch treo — `next`
  là `and|or|und|oder|et|ou|và|hoặc` ⇒ keep + dấu cách; (5) bằng chứng tài liệu: `lexicon.hyphenated.has(prev-next)` và KHÔNG `lexicon.plain.has(prevnext)` ⇒ keep;
  `lexicon.plain.has(prevnext)` và không dạng gạch ⇒ join; (6) còn lại ⇒ hành vi cũ (chữ thường ⇒ join). Nhận `-`, U+2010, U+2011 (không en dash). Áp cả cho phần tiếp ô
  bảng. `buildLexicon` từ văn bản các dòng (không lưu item): `\p{L}+(?:-\p{L}+)+` và từ trơn. Tiền quét: lượt 1 đếm ngắt dòng bằng gạch; nếu > 0 ⇒ tập từ từ văn bản
  đã dựng của tài liệu (đệm theo trang) rồi dựng lại đoạn của các trang có ngắt gạch (hoặc lexicon trượt nếu vượt 2×).
- **Rationale**: không từ điển (clarify #16); tiếng Việt giữ gạch (#18); bảo thủ.

## R7 — Bộ mẫu + đo

- **Decision**: `make-pdf.ts` thêm `rotate: 180 | 270` + tuỳ chọn vẽ nội dung ngược hướng để hiển thị thẳng, `cropBox` lệch gốc; `samples.ts`: `financialTable`,
  `decimalTable`, `rotated90/180/270` (cùng nội dung với `twoColumns`/`borderlessTable`), `hyphenCompounds` (Anh + Việt), mẫu âm `tocNoLeader`, `keyValueList`,
  `justifiedParagraph`, `signatureBlock`. Tập cặp từ gắn nhãn `tests/fixtures/pdf/hyphen-pairs.ts` (≥ 40 cặp: ngắt thật / ghép thật / treo / tiếng Việt). Perf: mẫu 50 trang
  xen kẽ thêm bảng số + trang xoay + gạch nối; ≤ 2× (local chặt, CI log).

## R8 — Dự phòng theo hạng mục

- **Decision**: `try/catch` cục bộ: đường phụ bảng số lỗi ⇒ bỏ đường phụ (kết quả căn trái + văn bản như trước); `decideHyphen` / lexicon lỗi ⇒ hành vi cũ; `toDisplayItem` /
  viewport lỗi ⇒ toạ độ chưa xoay như 112; `parsePdfTables` lỗi ở renderer ⇒ hiển thị văn bản. `logEvent("pdf.layout.fallback", { feature })` (mã, không nội dung) ở main.
