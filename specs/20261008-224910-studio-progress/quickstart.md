# Quickstart — kiểm chứng 146

```bash
npm run lint && npm test && npx electron-vite build && npx playwright test
```

Thủ công (Ollama cục bộ, vd qwen2.5:7b):

1. Notebook nhỏ (1–2 tệp ngắn) ⇒ bấm "Tóm tắt tài liệu" ⇒ thẻ hiện "Đang viết…" (thanh bất định) rồi kết quả.
2. Notebook lớn (nhiều tài liệu dài, vượt ngân sách một lượt) ⇒ "Đang đọc phần 1/N…" … N/N (thanh tăng), "Đang rút gọn ghi chú…" (nếu có), "Đang viết…",
   rồi kết quả kèm "xử lý theo N phần".
3. Đã có kết quả ⇒ "Tạo lại" ⇒ tiến độ hiện trên kết quả cũ.
4. Chạy Tóm tắt + FAQ cùng lúc ⇒ mỗi thẻ đúng tiến độ của mình. Đổi notebook giữa chừng ⇒ notebook mới không có tiến độ lạ.
5. VoiceOver/NVDA ⇒ ≤ 6 thông báo/lượt; giao diện English ⇒ câu English. Bật giảm chuyển động ⇒ thanh không chạy hiệu ứng.
