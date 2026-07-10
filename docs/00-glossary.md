# Thuật ngữ dự án (日本語 / Tiếng Việt / English)

Mọi agent PHẢI tra bảng này trước khi đặt tên biến/field liên quan nghiệp vụ.
Bổ sung ngay khi gặp thuật ngữ mới — không tự dịch rồi bỏ qua.

> Dự án InsightVault **không có tài liệu nguồn tiếng Nhật** → cột 日本語 để `—`.
> Cột "English (dùng trong code)" là **tên chuẩn** cho biến/field/type/IPC channel.

| 日本語 | Tiếng Việt                                  | English (dùng trong code) | Ghi chú                                                                                |
| ------ | ------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------- |
| —      | Notebook (không gian nghiên cứu 1 chủ đề)   | notebook                  | Không dịch "sổ tay" trong code                                                         |
| —      | Nguồn (tài liệu nạp vào notebook)           | source                    | PDF/docx/txt/md/URL/audio/image                                                        |
| —      | Lập chỉ mục                                 | index / indexing          | parse→chunk→embed→lưu vector                                                           |
| —      | Đoạn                                        | chunk                     | Đơn vị chia nhỏ nguồn để embed/truy hồi                                                |
| —      | Vector nhúng                                | embedding                 |                                                                                        |
| —      | Vị trí gốc (của đoạn trong nguồn)           | locator                   | `{page,char_start,char_end}`｜`{timestamp}`｜`{bbox}`                                  |
| —      | Trích dẫn                                   | citation                  | Chip `[n]` → chunk → locator                                                           |
| —      | Truy hồi                                    | retrieval                 | Bước tìm chunk liên quan trong RAG                                                     |
| —      | Chế độ theo nguồn                           | grounded mode             | Mặc định; chỉ trả lời từ tài liệu                                                      |
| —      | Chế độ mở rộng                              | open mode                 | Cho dùng kiến thức chung                                                               |
| —      | Không dựa trên nguồn                        | ungrounded                | Nhãn cho phần trả lời ngoài tài liệu                                                   |
| —      | Nhà cung cấp AI                             | provider                  | local (Ollama) ｜ online (Anthropic/OpenAI/Gemini)                                     |
| —      | Chạy cục bộ                                 | local                     | Đối lập với "online"                                                                   |
| —      | Chỉ báo riêng tư                            | privacy indicator         | Badge local ↔ online; UI component `PrivacyBadge` (class `privacy-badge`) ở app header |
| —      | Rail điều hướng (thanh dọc, các mục chính)  | nav rail                  | Component `NavRail` (class `nav-rail`) — 001-app-shell                                 |
| —      | Khung chào mừng lần đầu mở app              | first-run onboarding      | `OnboardingState.completed`; cờ lưu ở OS settings store, key `onboardingComplete`      |
| —      | Workspace (khu vực 3 cột Nguồn/Chat/Studio) | workspace                 | Route `/workspace`; placeholder ở 001, màn thật ở feature sau                          |
| —      | Cài đặt                                     | settings                  | Route `/settings`; placeholder ở 001, chứa provider/model/lưu trữ ở feature sau        |
| —      | Studio                                      | studio                    | Tóm tắt/Ý chính/FAQ/Dàn ý                                                              |
| —      | Bóc băng (âm thanh→văn bản)                 | transcription             | Pha 2                                                                                  |
