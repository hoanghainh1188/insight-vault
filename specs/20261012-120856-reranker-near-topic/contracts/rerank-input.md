# Contract — Trình bày đoạn cho bộ chấm (187, PR 2 — CHỈ khi chẩn đoán xác nhận `cutOff` là nguyên nhân chính)

`rerankInput(chunkText: string, query: string, budgetChars: number): string` — thuần, tất định, không mutate.

- Đoạn KHÔNG phải bảng Markdown ⇒ trả nguyên văn.
- Đoạn có bảng ⇒ giữ dòng tiêu đề + dòng phân cách, rồi ưu tiên các dòng có trùng từ (sau chuẩn hoá NFC, không dấu câu) với câu hỏi, sau đó
  các dòng còn lại theo thứ tự gốc, tới khi chạm `budgetChars`; văn bản ngoài bảng giữ ở đầu (cắt nếu cần).
- Chỉ dùng cho chuỗi gửi `deps.rerank`; `ScoredChunk.chunk` / locator / chip `[n]` / văn bản hiển thị KHÔNG đổi.
- Hành vi fail-open của 109 giữ nguyên.
