# Quickstart — kiểm chứng 149

```bash
npm run lint && npm test && npx electron-vite build && npx playwright test
```

Thủ công (Ollama cục bộ, vd qwen2.5:7b; notebook lớn nhiều phần):

1. Bấm "Tóm tắt tài liệu" ⇒ thấy nút **Huỷ** ngay (trước cả "Đang đọc phần 1/N…"). Ở "Đang đọc phần 2/N…" bấm Huỷ ⇒ "Đang huỷ…" rồi thẻ về nghỉ ≤ 2 s,
   không khối lỗi; `ollama ps` / hoạt động GPU giảm về nghỉ trong vài giây (nếu không ⇒ ghi giới hạn đã biết).
2. Đã có kết quả ⇒ "Tạo lại" ⇒ Huỷ ⇒ kết quả cũ nguyên vẹn, focus về "Tạo lại"; mở lại notebook vẫn thấy kết quả cũ.
3. Tạo Tóm tắt + FAQ cùng lúc, huỷ FAQ ⇒ Tóm tắt chạy tiếp tới xong.
4. Đang tạo ở notebook A ⇒ chuyển sang B ⇒ (trình đọc màn hình) "Đã huỷ tạo …"; quay lại A không còn "Đang tạo…"; không có kết quả mới được lưu.
5. AI online (khoá của bạn) ⇒ huỷ giữa lượt ⇒ chỉ báo "đang gửi dữ liệu" tắt, không hiện "hết thời gian" / "Tạo bằng AI cục bộ".
6. VoiceOver/NVDA: bấm Huỷ bằng bàn phím ⇒ nghe "Đã huỷ tạo {loại}."; giao diện English ⇒ "Cancelled creating {kind}."; cửa sổ 900 px không tràn.
