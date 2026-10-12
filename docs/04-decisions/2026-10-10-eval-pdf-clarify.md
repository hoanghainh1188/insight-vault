# PDF vào bộ đánh giá truy xuất — clarify (177)

- Ngày: 2026-10-10
- Feature: `177-eval-pdf` (issue #177). Spec: `specs/20261010-114620-eval-pdf/spec.md`. Intake: `docs/intake/177-eval-pdf.md`.
- Hoàn thành mục "PDF vào eval" đã hoãn ở 112 (clarify #13) và 147 (clarify #20).

## Chốt ở `/speckit-specify` (chủ dự án)

1. **Hai PDF**: 1 PDF **sinh từ fixture** của dự án (chủ động có bảng số căn phải, trang khổ ngang, gạch nối) + 1 **PDF thật tiếng
   Việt**; tổng dung lượng thêm vào repo ≤ ~1 MB.
2. **Câu hỏi PDF chia dev / hold-out ~70/30** trong từng loại như câu hiện có; báo cáo nêu rõ cỡ mẫu nhỏ.
3. **Nhóm PDF chỉ để tham khảo** (không vào cổng ĐẠT 108–109), có cảnh báo (ngưỡng ở #4 dưới).

## Chốt ở `/speckit-clarify`

1. **PDF thật** = bản "Tải về dạng PDF" của **Wikipedia tiếng Việt** cho một bài **chưa có** trong bộ dữ liệu — CC BY-SA 4.0, có lớp
   chữ, ghi `revisionId`, ghi công + "thay đổi đã làm: xuất PDF", dọn metadata cá nhân.
2. **Nguồn chân lý của trích dẫn PDF** = bước kiểm dữ liệu chạy **chính `parsePdf` của app** (chuyển sang bất đồng bộ) và kiểm trên văn
   bản vừa trích; không dùng bản chụp. Cách trích đổi làm trích dẫn ngừng khớp ⇒ kiểm dữ liệu fail (nêu câu hỏi + tài liệu) — tín hiệu
   hồi quy mong muốn; xử lý bằng cập nhật trích dẫn + tăng `datasetVersion`.
3. **`RELEVANCE_CALIBRATION` đo lại trong cùng PR** (cấu hình 108 + bộ chấm 109), cập nhật số liệu + `datasetVersion` + `calibratedAt`;
   số liệu bộ dữ liệu v3 giữ trong ADR thực thi làm mốc trước / sau. Cấu hình hiện hành **không còn đạt** ⇒ dừng, báo lại, mở issue
   riêng; không đổi mục tiêu / cấu hình trong PR này (108 FR-011).
4. **Ngưỡng cảnh báo nhóm PDF**: cảnh báo khi **cận trên khoảng tin cậy Wilson 95%** của Recall@6 nhóm PDF **thấp hơn** Recall@6 nhóm
   Markdown, tính riêng dev và hold-out; cảnh báo không làm bộ đánh giá fail.
5. **Tất định**: không nới cấu hình trích PDF của app (giữ `LAYOUT_BUDGET_MS`); PDF đủ nhỏ + unit test trích mỗi PDF **hai lần**, văn
   bản giống hệt, thời gian trích **≤ 1000 ms** (vượt ⇒ test fail).

## Mặc định cho các điểm còn lại (đề xuất của điều phối viên — chủ dự án có thể đổi trước `/speckit-plan`)

- **A5 Đặc trưng PDF fixture**: bảng số căn phải, một trang khổ ngang, từ ghép có gạch nối cuối dòng (vi `hợp-đồng` + en `long-term`), một
  trang hai cột, một đáp án sát cuối trang; mỗi đặc trưng ≥ 1 câu có đáp án nằm đúng chỗ đặc trưng.
- **A6**: không PDF nào trùng nội dung với tài liệu `.md` đã có.
- **A10**: chỉ **ghi** `PDF_EXTRACTION_VERSION` vào `report.md` / `report.json`; không thêm canh giữ vào `RELEVANCE_CALIBRATION`.
- **A12**: thêm unit test nhanh trong `npm test` (không mô hình, không mạng): mọi trích dẫn PDF khớp + tất định + thời gian (gộp với #5).
- **A13**: `tests/fixtures/pdf/make-pdf.ts` chỉ **thêm** khả năng (dàn dòng, phân trang), không đổi hành vi cũ (test cũ giữ xanh); nội
  dung fixture là văn bản **tự soạn** (giấy phép "tự soạn / CC0"); **commit tệp PDF** + script tái tạo + `sha256` trong manifest.
- **A14**: không đo "đúng trang" trong issue này.
- **A15**: `EvalLicense` thêm giá trị cho văn bản tự soạn; manifest thêm `format`, `file`, `sha256` (tài liệu `.md` cũ mặc định `md`).
- **A16**: không thêm tài liệu nhiễu PDF; hai PDF là tài liệu thật; `MIN_CORPUS_DOCS` / `MIN_NOISE_DOCS` giữ nguyên.
- **A17**: câu hỏi PDF chỉ tiếng Việt.
- **A18**: ADR này + ADR thực thi sau review + dòng `INDEX.md`; thuật ngữ mới append glossary (sửa dòng cũ ⇒ PR glossary riêng).

## Bổ sung 2026-10-12 (sau T022 — chủ dự án chốt)

- T022 so mốc v3 với v4 theo từng câu: theo **đường app thật (cấu hình 108 + bộ chấm 109)** không câu cũ nào tụt (vi dev / hold-out,
  en: Recall@6, MRR, từ chối đúng giữ nguyên). Ở cấu hình 108 **không bộ chấm**, q-121 (en, "Who had The Huc Bridge built…") rơi từ
  hạng 5 ra ngoài top 6 vì 2 đoạn PDF chen vào ⇒ **quan sát**, không chặn.
- 2 câu không đáp án sát chủ đề PDF (q-176 "thang máy", q-179 "lương lái tàu" — Tuyến 2A) không bị bộ chấm 109 từ chối ⇒ từ chối đúng
  dev của cấu hình đã ghi 90,9% (v3) → 85,7% (v4); `gateVerdict` cho cấu hình đó vẫn **ĐẠT** (hold-out 100%, Wilson vi gộp 0,769 ≥
  0,75). Mở **issue riêng #187** cho giới hạn này; không đổi cấu hình trong #177.
- ⇒ FR-010 / SC-004 sửa: "không tụt" đo trên cấu hình như app đang chạy (108 + 109). T023 ghi số liệu v4 (chỉ số liệu).

