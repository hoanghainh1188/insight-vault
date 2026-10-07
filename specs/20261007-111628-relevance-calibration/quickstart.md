# Quickstart — kiểm chứng 108 relevance-calibration

## Điều kiện

- Node 24, `npm ci`. Lần đầu chạy công cụ đo cần Internet để tải mô hình e5 (~120MB) vào `tests/eval/.cache/models`.
- Bộ câu hỏi đã được duyệt (`tests/eval/questions.json` → `reviewed` khác `null`).

## 1. Đo hiện trạng (baseline)

```bash
EVAL_MODE=current npm run eval:retrieval
```

Kỳ vọng: báo cáo cấu hình cũ (0.5 / không chặn BM25) có tỉ lệ từ chối đúng thấp (gần 0) — làm mốc so sánh (SC-001).

## 2. Quét và chọn cấu hình

```bash
npm run eval:retrieval
```

Kỳ vọng: bảng so sánh theo `dev`/`holdout`/`en`; dòng được chọn đạt từ chối đúng ≥ 90% và Recall@6 ≥ 85% trên hold-out
(hoặc ≥ 75% theo sàn). Số liệu đưa vào `relevance-calibration.ts` + ADR.

## 3. Kiểm hồi quy cấu hình đã áp dụng

```bash
EVAL_MODE=current npm run eval:retrieval
```

Kỳ vọng: cấu hình hiện hành khớp số liệu ghi trong `RELEVANCE_CALIBRATION.metrics`.

## 4. Unit test + gate

```bash
npm run lint && npm test && npm run build
```

Kỳ vọng: xanh, coverage ≥ 80%; gồm test `selectRelevant`, chỉ số, khớp trích đoạn, test canh giữ phiên bản mô hình,
`rag-service` (không `[n]` ⇒ "Không tìm thấy" + gợi ý; Mở rộng không đổi).

## 5. Thử trên app

1. `npm run dev`, tạo notebook, nạp 2–3 tài liệu trong `tests/eval/corpus/`.
2. Hỏi một câu trong tài liệu ⇒ có câu trả lời + chip `[n]` mở đúng đoạn.
3. Hỏi câu không liên quan ⇒ "Không tìm thấy trong nguồn. Thử hỏi cụ thể hơn, hoặc chuyển sang chế độ Mở rộng…".
4. Chuyển chế độ Mở rộng, hỏi lại ⇒ mô hình vẫn trả lời, có nhãn "có thể ngoài nguồn".
5. Tìm toàn văn ở cột Nguồn với cùng từ khoá ⇒ kết quả như trước feature.

## 6. Job CI thủ công

GitHub → Actions → `eval-retrieval` → Run workflow ⇒ artifact `eval-report` chứa `report.md`/`report.json`.
