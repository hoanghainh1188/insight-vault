# Contract — báo cáo bộ đánh giá: phần PDF (177)

Bổ sung vào `report.json` / `report.md` hiện có (108/109). Phần cũ **không đổi** (cổng ĐẠT, nhóm dev / hold-out / en).

## report.json — trường mới

```json
{
  "pdfExtractionVersion": 3,
  "byFormat": {
    "md":  { "dev": EvalMetrics, "holdout": EvalMetrics },
    "pdf": { "dev": EvalMetrics, "holdout": EvalMetrics }
  },
  "pdfWarnings": [
    { "split": "holdout", "pdfRecallAt6": 0.6, "pdfUpper95": 0.83, "mdRecallAt6": 0.9, "nPdf": 5 }
  ]
}
```

`byFormat` tính trên **câu tiếng Việt** của cấu hình được báo cáo (cấu hình chọn / hiện hành; có bộ chấm 109 nếu bật).

## report.md — mục mới

```text
## Nhóm PDF (tham khảo — không vào tiêu chí ĐẠT)
Phiên bản trích xuất PDF: 3
| Tập | Định dạng | n có đáp án | R@1 | R@3 | R@6 (Wilson 95%) | MRR | n không đáp án | Từ chối đúng |
| dev | md | … |
| dev | pdf | … |
| hold-out | md | … |
| hold-out | pdf | … |
⚠️ Cảnh báo: hold-out — Recall@6 PDF 60% (cận trên 83%) thấp hơn Markdown 90%.   ← chỉ khi có cảnh báo
Cỡ mẫu PDF nhỏ — đọc kèm khoảng tin cậy.
```

Cảnh báo không đổi mã thoát của eval.

## report.json — `details` (tuỳ chọn, `EVAL_DETAILS=1`)

Kết quả TỪNG câu để điều tra hồi quy trước / sau (thêm sau T022): `details.relevance` (cấu hình 108 hiện hành, không bộ chấm — chế độ
`current`) và `details.production` (như app đang chạy, 108 + bộ chấm 109). Mỗi phần tử là `QuestionOutcome` kèm `topSources` (tiêu đề
nguồn của 6 đoạn đầu — tài liệu corpus công khai, không dữ liệu người dùng). Mặc định KHÔNG ghi (report.json gọn).
