# Công cụ đo truy xuất (108)

Đo chất lượng bước **chọn đoạn** của hỏi đáp có trích dẫn trên một bộ đánh giá công khai. Dev-only: không đóng gói
vào bản cài, không đọc/ghi dữ liệu người dùng. Quyết định và số liệu: `docs/04-decisions/2026-10-07-relevance-calibration.md`.

## Chạy

```bash
npm run eval:retrieval                    # quét lưới cấu hình (chọn trên dev, xác nhận trên hold-out)
EVAL_MODE=current npm run eval:retrieval  # chỉ đo cấu hình đang dùng + baseline, so với số liệu đã ghi
```

| Biến môi trường  | Mặc định                   | Ý nghĩa                                                                  |
| ---------------- | -------------------------- | ------------------------------------------------------------------------ |
| `EVAL_MODE`      | `sweep`                    | `sweep` quét lưới · `current` đo cấu hình hiện hành (kiểm hồi quy)        |
| `EVAL_CONFIG`    | —                          | JSON một `RelevanceConfig` để đo riêng (ghi đè `EVAL_MODE`)               |
| `EVAL_WITH_LLM`  | `0`                        | `1` = thêm phần end-to-end qua Ollama cục bộ (tham khảo, không xét ĐẠT)   |
| `EVAL_LLM_MODEL` | model chat đầu tiên        | model Ollama cho phần LLM                                                |
| `EVAL_CACHE_DIR` | `tests/eval/.cache/models` | nơi tải mô hình e5 (~120MB, lần đầu cần Internet)                        |

Báo cáo: `tests/eval/reports/<thời điểm>/report.{md,json}` (gitignore). Trên GitHub: Actions → `eval-retrieval` →
Run workflow ⇒ artifact `eval-report`. Job không chặn PR.

## Cách hoạt động

1. Kiểm dữ liệu: `corpus/manifest.json`, mọi trích đoạn đáp án phải có **nguyên văn** trong tài liệu (`lib/dataset.ts`).
2. Dựng SQLite + FTS5 + LanceDB thật trên thư mục tạm, nạp mọi tài liệu (kể cả nhiễu) vào một notebook qua pipeline
   thật với mô hình e5 thật (`lib/harness.ts`).
3. Gọi đúng `retrieve()` của app với từng cấu hình; embed/tìm kiếm của mỗi câu chỉ chạy một lần (cache).
4. Tính Recall@1/3/6, MRR, từ chối đúng/nhầm (+ khoảng tin cậy Wilson 95%), phân bố khoảng cách (`lib/metrics.ts`).

## Thêm câu hỏi / tài liệu

- Câu có đáp án: `type: "answerable"`, `quotes` = 1 câu ngắn (≤ 200 ký tự) chép **nguyên văn** từ tài liệu, `docIds`.
- Câu không có đáp án: `type: "unanswerable"`, `quotes: []`, `docIds: []` — kiểm (grep) chắc tài liệu không có đáp án.
- Chia `split` ~70% `dev` / 30% `holdout` trong từng loại. Đổi bộ dữ liệu ⇒ tăng `datasetVersion`, đặt
  `reviewed: null` và nhờ chủ dự án duyệt lại (FR-003).
- Tài liệu mới: chỉ nguồn được phép tái phân phối; ghi nguồn + giấy phép vào `corpus/manifest.json` và
  `corpus/README.md`.

## Khi đổi mô hình embedding hoặc cách chia đoạn

`tests/unit/relevance-calibration.test.ts` sẽ fail khi `EMBEDDING_MODEL_VERSION` khác phiên bản trong
`RELEVANCE_CALIBRATION`. Khi đó: chạy `npm run eval:retrieval`, chọn lại cấu hình, cập nhật
`src/main/services/rag/relevance-calibration.ts` (cấu hình + số liệu dev/hold-out) và ADR.
