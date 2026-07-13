# embed-in-process clarify (059)

- Ngày: 2026-07-13
- Feature: `059-embed-in-process` (issue #59)
- Nguồn: thảo luận UX Windows/máy yếu sau khi merge 055/057; người dùng chốt kỹ thuật.
- Tiếp nối: 031 (ProviderRegistry + Ollama local + badge egress), 045 (Whisper — đã bundle
  transformers.js/onnxruntime + cơ chế tải model lần đầu), 055 (retrieval hybrid RRF/MMR).
- **Đảo một phần 031:** 031 chốt "embedding LUÔN chạy qua Ollama local". Feature này **thay engine
  embedding sang in-process** (onnxruntime). Chat generation vẫn qua Ollama như 031.

## Bối cảnh

Ollama chạy **native trên Windows** (cùng API `localhost:11434`) → kiến trúc không đổi theo OS. Vấn đề
thực là **phần cứng**: máy Windows phổ thông (không GPU rời, RAM ít) cài Ollama + pull model GB là ma sát
lớn và suy luận chậm. Giảm phụ thuộc Ollama ở khâu embed + gợi ý model đúng cỡ máy → cải thiện UX máy yếu.

## Quyết định (đã thảo luận, KHÔNG NEEDS CLARIFICATION)

**C1. Embedding chạy in-process.** Dùng `@huggingface/transformers` (đã có từ 045) + onnxruntime để nhúng
văn bản ngay trong main process, **bỏ nhu cầu Ollama cho khâu embed**. Chat vẫn qua Ollama (ProviderRegistry
031).

- _Đã VERIFY:_ `pipeline("feature-extraction", "Xenova/multilingual-e5-small")` chạy in-process,
  **384 chiều**, sim(query ↔ đoạn liên quan)=0.862 > sim(↔ khác chủ đề)=0.799 (thứ tự đúng).
- _Đánh đổi:_ khoảng cách cosine hẹp (đặc tính e5) → **phải chỉnh lại `RELEVANCE_MAX_DISTANCE`** (013) cho
  ngưỡng "không tìm thấy trong nguồn". RRF+MMR (055) đứng sau bù chất lượng.

**C2. Model embedding = `Xenova/multilingual-e5-small` (384d).** Nhẹ (~120MB tải lần đầu), đa ngôn ngữ tốt
cho tiếng Việt, hợp máy yếu. (Loại bge-m3 1024d ~2GB — nặng, mâu thuẫn mục tiêu; loại
paraphrase-MiniLM — chất lượng nhỉnh kém trên đoạn dài.)

- _Tiền tố e5 bắt buộc:_ `query: <câu hỏi>` khi embed truy vấn, `passage: <đoạn>` khi embed chunk. Hàm thuần
  gắn tiền tố → test.
- _Tải model lần đầu:_ giống Whisper 045 — badge egress một lần (dùng chung cơ chế 031/045), cache vào
  data dir, offline sau đó.

**C3. Migration re-embed nền.** Đổi model → vector cũ (768d Ollama, khác không gian) **không tương thích**
→ phải nhúng lại. Cách chốt: lưu **`embedding_model_version`** (định danh model + dim) ở metadata; khi mở
app phát hiện version lệch → **job nền nhúng lại toàn bộ chunk** (đọc `chunk.text` theo lô → embed
in-process → ghi đè vector LanceDB), hiện tiến độ, **không chặn UI**. Notebook chưa nhúng lại xong → báo
"đang tái lập chỉ mục" thay vì trả kết quả sai.

- LanceDB đổi dim (768→384) → **tạo lại bảng vector** (schema theo dim mới) rồi backfill.
- Idempotent + resume được (nhúng lại theo lô, đánh dấu chunk đã xong) → app tắt giữa chừng không hỏng.

**C4. Gợi ý chat model theo RAM + health-check Ollama (Settings).** Phát hiện RAM tổng (`os.totalmem()` ở
main) → gợi ý cỡ model chat: `< 8GB → 3B` (vd qwen2.5:3b), `8–16GB → 7–8B`, `> 16GB → lớn hơn`. Health-check:
Ollama đã cài/đang chạy? model đang chọn đã pull chưa? → hướng dẫn khắc phục. **Chỉ gợi ý, không tự tải.**

## Kiểm chứng được (Constitution II) — bất biến

Đổi engine embedding **CHỈ đổi vector** dùng để xếp hạng; **KHÔNG đổi locator**. Mỗi chunk giữ locator gốc
(page/char/tStart/bbox) → chip `[n]` map chính xác về nguồn + vị trí. Hành vi "không tìm thấy" giữ nguyên.

## Local-first / Offline (Constitution I, III)

- Embed + FTS + retrieval ở **main process**; renderer không chạm model/mạng.
- **Không egress ngầm:** chỉ lần tải model đầu tiên rời máy → badge egress dùng chung 031/045. Sau đó offline.
- Không log nội dung câu hỏi/chunk/đường dẫn (Constitution III).

## Test-first (Constitution IV, ≥80% business logic)

Hàm thuần: gắn tiền tố e5 (query/passage), chuẩn hoá vector, so khớp `embedding_model_version`, chọn tier
model theo RAM, chia lô re-embed. I/O (gọi onnxruntime, LanceDB, Ollama health HTTP) → DI mock, exclude
coverage phần I/O thuần.

## Ngoài phạm vi

- Bundle engine chat (node-llama-cpp) — chat vẫn qua Ollama.
- Tự tải/tự chọn chat model (chỉ gợi ý).
- Cho người dùng đổi model embedding qua Settings (cố định e5-small ở v1).
- Đa model embedding song song / migrate tăng dần theo notebook (đã chọn re-embed nền toàn bộ).
