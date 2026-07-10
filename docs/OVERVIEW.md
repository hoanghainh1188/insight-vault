# InsightVault — Overview & Requirements Brief

> **Mục đích file này:** để Claude Code đọc cùng `prototype.html`, **tự phân tích và đề xuất phương án kỹ thuật**.
> File này mô tả **CÁI GÌ** cần xây và các ràng buộc bất biến; phần **CÁCH LÀM** (stack, kiến trúc, data model) để bạn phân tích rồi đề xuất cho tôi duyệt.

---

## 1. Sản phẩm là gì
Ứng dụng desktop tổng hợp tri thức bằng AI **chạy cục bộ** (kiểu NotebookLM nhưng offline). Người dùng nạp tài liệu vào các "notebook", app xử lý & lập chỉ mục **ngay trên máy**, rồi cho phép hỏi đáp / tóm tắt bằng LLM chạy local, với **trích dẫn nguồn kiểm chứng được**. Có tùy chọn dùng AI online bằng API key của chính người dùng.

## 2. Người dùng mục tiêu
Người xử lý nhiều tài liệu và **coi trọng quyền riêng tư**: nhà nghiên cứu, luật sư, nhà báo, sinh viên, kỹ sư — đặc biệt với dữ liệu nhạy cảm không muốn tải lên máy chủ bên thứ ba.

## 3. Điểm khác biệt cốt lõi (không được đánh mất)
- **Local-first:** dữ liệu không rời máy ở chế độ mặc định — đây là lý do sản phẩm tồn tại.
- **Kiểm chứng được:** mọi câu trả lời trích dẫn về đúng đoạn nguồn gốc.
- **Offline & tự chủ:** chạy được không cần Internet; người dùng kiểm soát mô hình và chi phí.

## 4. Nền tảng (đã chốt)
Ứng dụng **desktop Electron**, chạy **macOS + Windows**. Hướng tới cộng đồng trước (miễn phí), freemium sau — nên kiến trúc cần "sẵn sàng thu phí" (tách tầng license/đồng bộ) nhưng **chưa xây** phần trả phí ở v1.

---

## 5. Yêu cầu chức năng

### MVP (Pha 1)
- **Quản lý notebook:** tạo/đổi tên/xóa, đặt màu, tìm kiếm.
- **Nạp nguồn văn bản & web:** PDF, Word (.docx), .txt, .md, và URL trang web. Hiển thị trạng thái xử lý từng nguồn.
- **Chỉ mục hóa tự động:** nạp xong là sẵn sàng hỏi đáp (chunk + embedding + lưu vector).
- **Hỏi đáp có trích dẫn:** ô chat tự do trong phạm vi 1 notebook; câu trả lời chèn chip `[n]`, bấm vào mở nguồn & cuộn tới **đúng đoạn được highlight**.
- **Hai chế độ trả lời (công tắc):**
  - *Theo nguồn* (mặc định): chỉ trả lời từ tài liệu, luôn kèm trích dẫn; không có thì báo "không tìm thấy trong nguồn".
  - *Mở rộng*: được dùng thêm kiến thức chung, phần đó gắn nhãn "không dựa trên nguồn".
- **Trình xem nguồn:** xem PDF/markdown, highlight đoạn được trích dẫn.
- **Studio:** tạo nhanh Tóm tắt / Ý chính / Câu hỏi thường gặp / Dàn ý.
- **Chọn mô hình:** LLM chạy local (mặc định) hoặc bật provider online + nhập API key; kiểm tra kết nối.
- **Chỉ báo riêng tư:** luôn cho người dùng biết đang chạy local hay đang gửi dữ liệu ra ngoài.
- **Onboarding lần đầu:** đảm bảo runtime AI local sẵn sàng.

### Pha 2 (sau khi Pha 1 chạy ổn)
- **Audio/Video:** nạp file, tự bóc băng (transcription) kèm timestamp; player nhảy tới timestamp được trích dẫn.
- **Hình ảnh:** OCR + mô tả nội dung; đưa vào cùng pipeline chỉ mục.

## 6. Ràng buộc bất biến (non-negotiables)
1. Dữ liệu không rời máy ở chế độ mặc định. Không telemetry/analytics gửi nội dung người dùng ra ngoài nếu không được yêu cầu tường minh.
2. AI online là tùy chọn, dùng API key của người dùng; key lưu an toàn (không plaintext).
3. Trích dẫn phải map được về vị trí chính xác trong nguồn (trang / timestamp / đoạn).
4. Xây theo pha — không làm Pha 2 trước khi lõi hỏi đáp + trích dẫn (Pha 1) chạy ổn.
5. Bảo mật desktop đúng chuẩn (cách ly renderer, không lộ Node cho web content).

## 7. Ngoài phạm vi v1
Đồng bộ đám mây, tài khoản/thanh toán, cộng tác nhiều người, bản mobile/web, fine-tune mô hình, sinh "audio overview" kiểu podcast.

---

## 8. Phương án kỹ thuật — HÃY PHÂN TÍCH & ĐỀ XUẤT
Đây là phần tôi muốn bạn (Claude Code) **tự phân tích từ yêu cầu ở trên + prototype, rồi đề xuất cho tôi duyệt**, gồm: lựa chọn stack, kiến trúc tổng thể (đặc biệt ranh giới main/renderer của Electron), data model, cách làm RAG + map trích dẫn, cấu trúc thư mục, và **thứ tự build theo pha**.

**Gợi ý (không bắt buộc — bạn có thể theo hoặc đề xuất tốt hơn kèm lý do):** Electron + React/TypeScript; Ollama cho LLM & embedding local; một vector store nhúng (không cần server) như LanceDB; whisper.cpp cho transcription; Tesseract + mô hình vision cho ảnh; SQLite cho metadata. Nếu bạn thấy lựa chọn khác phù hợp hơn, cứ nêu.

## 9. Tham chiếu giao diện
`prototype.html` (mở bằng trình duyệt) thể hiện: màn Notebooks, Workspace 3 cột (Nguồn / Chat + trích dẫn / Studio), modal Thêm nguồn (4 loại), Xem nguồn có highlight, và Cài đặt (mô hình local + provider online). Dùng nó làm chuẩn cho bố cục, luồng và văn phong UI (tiếng Việt; sẽ i18n sau).

## 10. Những điều prototype KHÔNG thể hiện (cần bạn suy luận & đề xuất)
- Pipeline nạp nguồn: parse → làm sạch → chunk → embed → lưu vector, kèm hàng đợi & trạng thái.
- Cơ chế RAG: truy hồi, ghép ngữ cảnh, và **map chip `[n]` ngược về chunk/nguồn/vị trí**.
- Lớp trừu tượng provider để local/online hoán đổi sau một interface chung.
- Lưu trữ cục bộ, quản lý mô hình (kích thước lớn), tải theo yêu cầu.
- Bảo mật: lưu API key, cách ly tiến trình, không log nội dung tài liệu.
- Đóng gói & ký app cho macOS + Windows, tự động cập nhật.

---

*Hãy bắt đầu bằng việc phân tích và trình bày phương án cho tôi duyệt, trước khi viết code.*
