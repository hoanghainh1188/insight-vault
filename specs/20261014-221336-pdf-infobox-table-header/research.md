# Research: Trích PDF giữ nguyên hộp thông tin và tiêu đề cột bảng

Khảo sát bằng cách chạy `parsePdf` + `buildLines` trên `tests/eval/corpus/tuyen-2a-ha-noi.pdf` (595,9 × 841,9 pt) ngày 2026-10-14. Toạ độ x theo điểm PDF.

## Hiện trạng đo được

### Trang 2 — hộp thông tin (q-185)

- Cột thân bài: mọi segment trong x∈[43,190], cỡ chữ 12, canh trái, rộng ≤ 147 pt (24,7% trang).
- Hộp "Thông tin kỹ thuật": nhãn x≈206–260 (cỡ 10,6), giá trị x≈265–500. Khe giữa thân bài và hộp = 16 pt (2,7% trang ≥ ngưỡng 2%).
- `findGutter` tìm đúng khe này, nhưng `splitAt` loại vì `dense()` đòi trung vị bề rộng segment ≥ 25% trang cho CẢ HAI phía (cột thân bài 24,7%) ⇒ một vùng ⇒ `detectTables` thấy 3 cột (thân bài | nhãn | giá trị) ⇒ bảng sai: `| năm 2021, Tuyến 2A chính | Khổ | 1.435 mm … |`, `| … | đường sắt | |`, `| … | Điện khí | Ray thứ ba 750V DC |`.
- Nhãn và giá trị bị xuống dòng không đồng bộ ("Khổ" y=176 / "đường sắt" y=192; "Điện khí" y=208 / "hóa" y=224; "Số đường" y=144 / "ray" y=160).
- Dưới hộp là danh sách tuyến "Bản đồ hành trình" (x≈290–544) cũng nằm vùng phải.

### Trang 5 — bảng danh sách nhà ga (q-162)

- Cột dữ liệu (mép trái): 57–59 (ký hiệu), 95 (tên Việt), 147 (tên Anh), 201–216 (tuyến trung chuyển), 333 (xe buýt), 415 (km trước), 457 (km từ Cát Linh), 495 (phường).
- Tiêu đề (y 49–103) trải 8 dòng, CANH GIỮA ô, nằm trên hàng dữ liệu đầu (y 124): "Khoảng cách (km)" phủ 2 cột km; "Ga trước" / "Ga Cát Linh" xuống dòng ("Ga" / "Cát" / "Linh"); "Ký hiệu [a]"; "Tên ga" phủ 2 cột tên, "Tiếng Việt", "Tiếng Anh".
- Văn bản hiện tại: tiêu đề thành một đoạn rời ("Khoảng cách Tên ga (km) Ký [a] Tuyến trung chuyển …") nằm TRƯỚC bảng; hàng dữ liệu đầu gộp vào dòng "BRT01, 23, T2 Cat 25, 38, …" ngoài bảng.
- Hàng dữ liệu canh giữa dọc, nhiều dòng; hàng 02/03 bị gộp sai (R5).
- Quote q-162 `| T2A 04 | Láng | Lang | | 9B, 16, 24, 27, 161, 88 | 1,0 | 2,8 | Đống Đa |` đã nằm trong bảng hiện tại ⇒ đoạn chứa đáp án CÓ sẵn, bộ chấm chấm thấp vì thiếu ngữ cảnh tiêu đề (đúng như chẩn đoán #187: cutOff = 0, không phải cắt cửa sổ).

## Quyết định

### D0 — Cổng khả thi trước khi viết mã

- **Quyết định**: chấm thử văn bản lý tưởng viết tay (tiêu đề đầy đủ + dòng Láng; hộp "Điện khí hóa | Ray thứ ba 750V DC") bằng bộ chấm hiện hành.
- **Lý do**: #187 đã thử "trình bày lại" ở bước chấm với tiêu đề lấy từ văn bản trộn (0,12 → 0,15) — chưa chứng minh tiêu đề SẠCH có đủ cứu hay không. Kiểm rẻ hơn nhiều so với cả pipeline.
- **Phương án loại**: viết thẳng mã rồi mới đo — rủi ro làm xong mà không câu nào cứu.

### D1 — Tách hộp bằng "cột thân bài hẹp" thay vì hạ ngưỡng `DENSE_COLUMN_RATIO`

- **Quyết định**: giữ ngưỡng cũ cho mọi trường hợp; thêm nhánh nhận cột hẹp khi: mọi segment cùng một phía khe có mép trái trong sai số `CELL_ALIGN_RATIO`, có ≥ N dòng (N dự kiến 6), và phía kia có ≥ 2 dòng nhiều segment hoặc cỡ chữ khác. Hằng số đặt tên trong `types.ts`, chốt N và sai số bằng đo trên toàn corpus.
- **Lý do**: hạ ngưỡng toàn cục (25% → 20%) sẽ ảnh hưởng mọi PDF, kể cả bảng có ô rộng ⇒ rủi ro hồi quy cao; nhánh hẹp chỉ kích hoạt với dạng "cột canh trái + vùng bên cạnh".
- **Phương án loại**: (a) hạ `DENSE_COLUMN_RATIO` — rủi ro R3; (b) dò hộp bằng cỡ chữ nhỏ hơn — mong manh (hộp không luôn nhỏ hơn); (c) dùng đường kẻ / hình vẽ của PDF — cần đọc operator list, nặng và không có trong text layer.

### D2 — Hộp = bảng 2 cột có gộp dòng nối tiếp

- **Quyết định**: vùng tách ra đi qua `detectTables` hiện có; thêm bước gộp "dòng nối tiếp": hàng có ô giá trị rỗng và ô nhãn nằm ngay dưới hàng trước (khoảng cách dòng ≤ `PARAGRAPH_GAP_RATIO`) được nối vào nhãn hàng trước; hàng mà ô nhãn rỗng và giá trị dưới hàng trước nối vào giá trị.
- **Lý do**: dùng lại bảng Markdown của 112 ⇒ trình xem lưới (147 e), `blocks`, chunker "không cắt bảng" đều chạy nguyên.
- **Phương án loại**: định dạng riêng "Nhãn: giá trị" — cần đổi chunker / viewer.

### D3 — Ghép tiêu đề theo cột dữ liệu

- **Quyết định**: sau khi `detectTables` có tập mép trái cột từ các hàng dữ liệu, lấy các dòng NGAY TRÊN hàng đầu (cho tới khi gặp khoảng trống dọc > `HEADER_GAP_MAX`, hoặc chạm đoạn văn) làm dải tiêu đề; gán mỗi segment vào cột có chồng lấn x lớn nhất; segment phủ ≥ 2 cột (không thuộc cột nào trọn vẹn) thành tiền tố cho từng cột nó phủ ("Khoảng cách (km) · Ga trước"); nối các mẩu trong cùng cột từ trên xuống bằng dấu cách; chèn một dòng tiêu đề + dòng phân cách `|---|` như định dạng hiện tại.
- **Lý do**: dùng đúng thông tin hình học đã có; tất định; không đoán ngữ nghĩa.
- **Không chắc ⇒ giữ nguyên** (FR-003): dải tiêu đề chứa segment không chồng lấn cột nào, hoặc > `HEADER_MAX_LINES` dòng, hoặc cột trùng nhãn mơ hồ.
- **Phương án loại**: dùng mô hình học / LLM đọc tiêu đề — vi phạm tính tất định và local-first nhẹ.

### D4 — Phiên bản trích xuất 3 → 4

- **Quyết định**: tăng một lần ở `PDF_EXTRACTION_VERSION`; gợi ý "Xử lý lại" (112 / 147) dùng nguyên. Chip cũ: xử lý như 112 (chunkId không còn ⇒ mở nguồn không highlight + ghi chú).
- **Lý do**: cơ chế đã có và được test; không migration.

### D5 — Đổi quote bộ đo (nếu cần)

- **Quyết định**: chỉ đổi chuỗi quote khớp văn bản mới cho câu bị ảnh hưởng; liệt kê trong PR để chủ dự án duyệt; không đổi câu hỏi / loại / tách dev–hold-out. Kiểm bằng `eval:retrieval` + so từng câu trước / sau.
- **Lý do**: quote là chứng cứ khớp văn bản trích; trích đổi thì quote đổi theo là hệ quả, không phải chỉnh số liệu.

## Kết quả cổng khả thi (D0, 2026-10-14) — KHÔNG ĐẠT

Chấm bằng bộ chấm hiện hành (`mmarco-mMiniLMv2`, 256 token, `minScore` 0,6; model có sẵn trong cache eval, không tải gì) văn bản viết tay cho đoạn đáp án. Điểm ∈ [0,1]:

| Câu   | Văn bản chấm                                                      | Điểm      |
| ----- | ----------------------------------------------------------------- | --------- |
| q-162 | hiện tại (tiêu đề trộn + hàng)                                    | 0,133     |
| q-162 | LÝ TƯỞNG: tiêu đề sạch + 4 hàng                                   | **0,300** |
| q-162 | LÝ TƯỞNG: tiêu đề sạch + đúng hàng Láng                           | **0,465** |
| q-162 | một câu văn thường "Ga Láng (T2A 04, Lang) nằm ở phường Đống Đa." | 0,988     |
| q-185 | hiện tại                                                          | 0,177     |
| q-185 | LÝ TƯỞNG: hộp sạch 5 hàng                                         | **0,007** |
| q-185 | chỉ hàng `\| Điện khí hóa \| Ray thứ ba 750V DC \|`               | 0,064     |
| q-185 | hàng + hàng khổ                                                   | 0,034     |
| q-185 | câu văn thường "Điện khí hóa: Ray thứ ba 750V DC."                | 0,108     |

Kết luận: ngay cả khi trích HOÀN HẢO, không đoạn nào của q-162 / q-185 vượt 0,6 (trừ khi viết lại thành câu văn thường, nằm ngoài phạm vi trích). q-185 thậm chí tệ hơn khi hộp sạch (0,007), và vẫn 0,108 khi là câu văn — bộ chấm không nối "điện khí hóa" với "ray thứ ba 750V DC" (giới hạn ngữ nghĩa của model, không phải lỗi bố cục). q-162 cải thiện (0,13 → 0,30–0,47) nhưng chưa tới ngưỡng, và FR-003 của #187 cấm hạ `minScore`.

Hệ quả theo T003: DỪNG; không viết mã trích.
