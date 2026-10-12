# Quickstart — kiểm chứng PDF trong bộ đánh giá (177)

## Điều kiện

- Đã `npm ci`; lần chạy eval đầu cần mạng để tải cache mô hình e5 + bộ chấm 109 (như hiện nay); các lần sau offline.

## 1. Kiểm nhanh (không mô hình, không mạng) — `npm test`

```bash
npx vitest run tests/unit/eval-dataset.test.ts tests/unit/eval-pdf-corpus.test.ts tests/unit/eval-pdf-fixture.test.ts tests/unit/eval-metrics.test.ts
```

Kỳ vọng: xanh. `eval-pdf-corpus` xác nhận: mỗi PDF trích 2 lần giống hệt, ≤ 1000 ms; sha256 khớp manifest; mọi trích dẫn PDF có nguyên
văn trong văn bản `parsePdf`; metadata PDF không có trường cá nhân. Sửa 1 chữ trong một trích dẫn PDF ⇒ test đỏ, nêu id câu + tài liệu.

## 2. Tái tạo PDF fixture

```bash
UPDATE_EVAL_FIXTURE=1 npx vitest run tests/unit/eval-pdf-fixture.test.ts
```

Kỳ vọng: tệp ghi lại giống hệt từng byte (sha256 không đổi). Nếu cố ý đổi nội dung ⇒ cập nhật sha256 + trích dẫn + `datasetVersion`.

## 3. Chạy bộ đánh giá đầy đủ

```bash
EVAL_MODE=current npm run eval:retrieval
```

Kỳ vọng: `report.md` có mục "Nhóm PDF (tham khảo)", dòng "Phiên bản trích xuất PDF: 3", bảng md / pdf × dev / hold-out; cảnh báo chỉ khi
cận trên Wilson PDF < Markdown. Chạy lại lần 2 ⇒ số liệu nhóm PDF giống hệt.

## 4. Trước / sau

Chạy bước 3 trên `main` (dataset v3) và trên branch (v4); so Recall@6 / MRR của **các câu cũ** (lọc theo id) — không giảm. Ghi bảng vào PR
và ADR thực thi. Cổng 108 / 109 không còn đạt ⇒ dừng, mở issue.

## 5. Không đóng gói

```bash
npm run build
```

Kỳ vọng: không tệp nào của `tests/eval/corpus/` trong `out/**` / bản cài.
