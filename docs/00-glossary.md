# Thuật ngữ dự án (日本語 / Tiếng Việt / English)

Mọi agent PHẢI tra bảng này trước khi đặt tên biến/field liên quan nghiệp vụ.
Bổ sung ngay khi gặp thuật ngữ mới — không tự dịch rồi bỏ qua.

> Dự án InsightVault **không có tài liệu nguồn tiếng Nhật** → cột 日本語 để `—`.
> Cột "English (dùng trong code)" là **tên chuẩn** cho biến/field/type/IPC channel.

| 日本語 | Tiếng Việt                                                   | English (dùng trong code)          | Ghi chú                                                                                       |
| ------ | ------------------------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| —      | Notebook (không gian nghiên cứu 1 chủ đề)                    | notebook                           | Không dịch "sổ tay" trong code                                                                |
| —      | Nguồn (tài liệu nạp vào notebook)                            | source                             | PDF/docx/txt/md/URL/audio/image                                                               |
| —      | Lập chỉ mục                                                  | index / indexing                   | parse→chunk→embed→lưu vector                                                                  |
| —      | Đoạn                                                         | chunk                              | Đơn vị chia nhỏ nguồn để embed/truy hồi                                                       |
| —      | Vector nhúng                                                 | embedding                          |                                                                                               |
| —      | Vị trí gốc (của đoạn trong nguồn)                            | locator                            | `{page,char_start,char_end}`｜`{timestamp}`｜`{bbox}`                                         |
| —      | Trích dẫn                                                    | citation                           | Chip `[n]` → chunk → locator                                                                  |
| —      | Truy hồi                                                     | retrieval                          | Bước tìm chunk liên quan trong RAG                                                            |
| —      | Chế độ theo nguồn                                            | grounded mode                      | Mặc định; chỉ trả lời từ tài liệu                                                             |
| —      | Chế độ mở rộng                                               | open mode                          | Cho dùng kiến thức chung                                                                      |
| —      | Không dựa trên nguồn                                         | ungrounded                         | Nhãn cho phần trả lời ngoài tài liệu                                                          |
| —      | Nhà cung cấp AI                                              | provider                           | local (Ollama) ｜ online (Anthropic/OpenAI/Gemini)                                            |
| —      | Chạy cục bộ                                                  | local                              | Đối lập với "online"                                                                          |
| —      | Chỉ báo riêng tư                                             | privacy indicator                  | Badge local ↔ online; UI component `PrivacyBadge` (class `privacy-badge`) ở app header        |
| —      | Rail điều hướng (thanh dọc, các mục chính)                   | nav rail                           | Component `NavRail` (class `nav-rail`) — 001-app-shell                                        |
| —      | Khung chào mừng lần đầu mở app                               | first-run onboarding               | `OnboardingState.completed`; cờ lưu ở OS settings store, key `onboardingComplete`             |
| —      | Workspace (khu vực 3 cột Nguồn/Chat/Studio)                  | workspace                          | Route `/workspace`; placeholder ở 001, màn thật ở feature sau                                 |
| —      | Cài đặt                                                      | settings                           | Route `/settings`; placeholder ở 001, chứa provider/model/lưu trữ ở feature sau               |
| —      | Studio                                                       | studio                             | Tóm tắt/Ý chính/FAQ/Dàn ý                                                                     |
| —      | Runtime AI cục bộ (lớp chạy Ollama phục vụ chat + embedding) | AI runtime                         | Slug `ai-runtime`; assembly `AiRuntime` — 007                                                 |
| —      | Nhà cung cấp AI (giao diện chung)                            | LLMProvider                        | Interface `{ chat, embed, test }`; v1 `OllamaProvider`                                        |
| —      | Registry quản lý provider                                    | ProviderRegistry                   | `register`/`getActive`/`setActive` — cắm provider online (008) qua cùng interface             |
| —      | Mô hình (AI)                                                 | model                              | Type `Model { name, sizeBytes, kind }`; phân biệt với `embedding` (vector)                    |
| —      | Mô hình trả lời                                              | chat model (`chatModel`)           | Field `ModelSelection.chatModel`                                                              |
| —      | Mô hình embedding                                            | embedding model (`embeddingModel`) | Field `ModelSelection.embeddingModel`                                                         |
| —      | Lựa chọn mô hình (lưu bền)                                   | ModelSelection                     | electron-store key `ai.modelSelection`                                                        |
| —      | Trạng thái runtime AI                                        | RuntimeStatus                      | `{ reachable, ollamaReady, reason }`; `ollamaReady` tách khỏi `OnboardingState.completed`     |
| —      | Kiểm tra kết nối                                             | connection test                    | `LLMProvider.test()` · kênh `ai:testConnection` · nút "Kiểm tra kết nối"                      |
| —      | Onboarding runtime AI (banner khi Ollama chưa sẵn sàng)      | runtime onboarding                 | Component `RuntimeOnboarding`; KHÁC `first-run onboarding` (màn chào 001)                     |
| —      | Màu notebook                                                 | notebook color (field `color`)     | Hex thuộc palette cố định — 009                                                               |
| —      | Bảng màu cố định (chọn màu notebook)                         | color palette                      | `src/shared/notebook-palette.ts` (`PALETTE`) — nguồn validate `color`                         |
| —      | Siêu dữ liệu notebook (bản ghi SQLite)                       | notebook metadata                  | Bảng `notebook(id,name,color,created_at,updated_at)` — schema SQLite đầu tiên                 |
| —      | Tìm kiếm notebook theo tên                                   | notebook search                    | Lọc client-side từ `notebook:list` (không kênh riêng)                                         |
| —      | Runner nâng cấp schema SQLite                                | migration (schema)                 | `PRAGMA user_version`, append-only (ADR 2026-07-11-sqlite-migrations)                         |
| —      | Bóc băng (âm thanh→văn bản)                                  | transcription                      | Pha 2                                                                                         |
| —      | Pipeline nạp nguồn (parse→làm sạch→chunk→embed→lưu)          | ingestion pipeline                 | `src/main/services/ingestion/pipeline.ts` — 011                                               |
| —      | Phân đoạn (bước tạo chunk)                                   | chunking                           | `chunker.ts`; ~1000 ký tự + overlap 150, không vắt trang PDF (ADR chunking-strategy)          |
| —      | Kho vector (LanceDB)                                         | vector store                       | `vector-store.ts`; bảng `chunks(id,notebook_id,source_id,vector,dim)` tại `userData/vectors/` |
| —      | Trạng thái xử lý nguồn                                       | source status                      | Enum `queued\|processing\|awaiting_embedding\|ready\|error`; ánh xạ `.stat ready\|proc\|err`  |
| —      | Hàng đợi nạp nguồn (tuần tự 1 nguồn/lần)                     | ingestion queue                    | `queue.ts` (SerialQueue, FIFO)                                                                |
| —      | Làm sạch văn bản (giữa parse và chunk)                       | text cleaning                      | `cleaning.ts`                                                                                 |
| —      | Trích nội dung chính (URL→văn bản)                           | content extraction                 | `parsers/url.ts` (readability + turndown); phân biệt với `parse` chung                        |
| —      | Truy hồi top-k (số chunk lấy ra mỗi câu hỏi)                 | top-k retrieval                    | `RETRIEVAL_TOP_K=6` + ngưỡng `RELEVANCE_MAX_DISTANCE` — 013 (ADR rag-retrieval-strategy)      |
| —      | Ngữ cảnh (ghép các chunk trúng tuyển gửi cho LLM)            | context                            | `context-builder.ts`; ~6000 ký tự, đánh số [n], bỏ nguyên chunk — phân biệt context window    |
| —      | Chỉ dẫn hệ thống (định hướng hành vi LLM theo chế độ)        | system prompt                      | `prompt.ts` (grounded/open); nội bộ main, không log                                           |
| —      | Câu hỏi (người dùng nhập ở cột Chat)                        | question                           | `RagAskInput.question`; validate boundary ≤2000 ký tự — 013 |
| —      | Câu trả lời (AI sinh, đã hậu kiểm chip)                     | answer                             | `RagAnswer.answer`; đã gỡ chip [n] lỗi (citation postprocess) |
| —      | Cờ "không tìm thấy trong nguồn"                             | notFound                           | `RagAnswer.notFound`; true khi grounded thiếu căn cứ |
| —      | Lượt hội thoại (in-memory phiên, multi-turn)                | turn (`RagTurn`)                   | `RagTurn{role,content}`; gửi tối đa MAX_HISTORY_TURNS gần nhất — không persist |
