# embedding (059) — ghi chú đóng gói

Embedding chạy **in-process** bằng `@huggingface/transformers` (feature-extraction) + onnxruntime — **tái
dùng đúng hạ tầng đã đóng gói cho Whisper (045)**, không thêm dependency mới:

- **onnxruntime native** đã nằm ngoài asar qua `electron-builder.yml` → `asarUnpack: **/*.node` (dùng chung
  với Whisper 045). `@huggingface/transformers` là `dependencies` → gộp vào bản build.
- **Model cache**: `env.cacheDir = <dataDir>/models` (giống Whisper). Model `Xenova/multilingual-e5-small`
  tải một lần từ HF Hub (badge egress `setOnline` — Constitution I), sau đó offline.
- **Badge egress**: chỉ bật lúc TẢI model lần đầu (dùng chung cơ chế 031/045), KHÔNG bật lúc nhúng thường.

## Seam test

`IV_EMBED_FAKE=1` (env, do harness E2E đặt) → `createEmbedder` trả embedder **tất định** (hash text → vector
384d), KHÔNG tải model. Chỉ dùng cho E2E (offline, nhanh, ổn định) — không bao giờ bật ở production.

## Bất biến

- Đổi engine embedding CHỈ đổi **vector**; **locator KHÔNG đổi** (Constitution II) → chip `[n]` map chính xác.
- Chat vẫn qua Ollama (ProviderRegistry 031). Đây đảo một phần 031 ("embedding LUÔN Ollama") — xem ADR 059.
