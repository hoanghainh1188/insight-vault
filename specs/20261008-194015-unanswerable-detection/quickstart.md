# Quickstart — kiểm chứng 109

## Điều kiện

- `npm install`; Internet lần đầu để tải model vào `tests/eval/.cache/models` (e5 ~120 MB; a1 ~119 MB; a2 ~341 MB).
- Phần LLM (hướng b / end-to-end): Ollama cục bộ với `qwen2.5:7b` (không dùng model `:cloud`).

## 1. Pha thí nghiệm (không đổi app)

```bash
EVAL_MODE=current npm run eval:retrieval      # mốc cấu hình hiện hành trên bộ đo v3 (sau khi duyệt)
EVAL_RERANK=cross-encoder/mmarco-mMiniLMv2-L12-H384-v1,onnx-community/gte-multilingual-reranker-base npm run eval:retrieval
EVAL_JUDGE=llm EVAL_LLM_MODEL=qwen2.5:7b npm run eval:retrieval   # chỉ khi a1, a2 không đạt
```

Kỳ vọng: báo cáo có bảng theo model + kết luận ĐẠT/ĐẠT SÀN/KHÔNG ĐẠT; mốc English cùng lượt. KHÔNG ĐẠT ở mọi hướng ⇒ dừng, ghi ADR (FR-005).

## 2. Sau tích hợp (chỉ khi ĐẠT)

```bash
npm run lint && npm test && npm run build && npx playwright test
EVAL_MODE=current npm run eval:retrieval      # cấu hình rerank đã ghi khớp số liệu (hồi quy OK)
EVAL_MODE=current EVAL_WITH_LLM=1 EVAL_LLM_MODEL=qwen2.5:7b npm run eval:retrieval   # end-to-end tham khảo
```

## 3. Thủ công trong app

1. Vault mới, notebook có nguồn tiếng Việt (vd `tests/eval/corpus/pho.md`, `ho-hoan-kiem.md`). Khi nguồn `ready`: chỉ báo riêng tư hiện tải model
   một lần, Cài đặt › AI hiện "Đang tải bộ chấm độ liên quan…" → "Sẵn sàng".
2. Theo nguồn: hỏi "Giá vé máy bay Hà Nội – Paris là bao nhiêu?" ⇒ "Không tìm thấy trong nguồn" ngay (không gọi model — log không có lượt chat).
   Hỏi lại 5 lần ⇒ như nhau.
3. Hỏi "Phở có nguồn gốc từ đâu?" và "Where did pho originate?" ⇒ trả lời có `[n]`, chip mở đúng đoạn.
4. Mở rộng: câu không có trong nguồn ⇒ trả lời với nhãn "ngoài nguồn".
5. Ngắt mạng + xoá model reranker khỏi `<data dir>/models` ⇒ hỏi đáp vẫn chạy như trước (fail-open), Cài đặt báo chưa sẵn sàng/lỗi; nhật ký có
   `rerank.skip` với `reason`, không nội dung.
