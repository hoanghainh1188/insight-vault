import type { Widen } from "../translate";

// 123 — khoá dịch domain "ai" (Cài đặt › AI cục bộ / AI online, gợi ý model, onboarding runtime, dải tái lập chỉ mục).
// Chuỗi từ main (RuntimeStatus.reason, ModelRecommendation.label, nhãn provider) dịch ở pha sau — không nằm ở đây.

export const aiVi = {
  testConnection: "Kiểm tra kết nối",
  // Tên giữ chỗ trong lệnh "ollama pull <…>" (dấu <> ghép ở code — tệp dịch không chứa '<').
  modelNameToken: "tên-model",
  modelSelect: {
    noModels: "Chưa có mô hình nào đã cài.",
    sizeGb: "{size} GB",
  },
  runtime: {
    statusUnreadable: "Không đọc được trạng thái runtime.",
  },
  local: {
    title: "AI cục bộ (Ollama)",
    connected: "Đã kết nối",
    notConnected: "Chưa kết nối",
    notReady: "Ollama chưa sẵn sàng.",
    chatModel: "Mô hình trả lời",
    chatModelEmpty: "Chưa có mô hình trả lời. Cài bằng: ollama pull qwen2.5:7b",
    embedNoteBefore:
      "Embedding (lập chỉ mục & tìm kiếm) chạy sẵn trong ứng dụng —",
    embedNoteStrong: "không cần Ollama",
    embedNoteAfter:
      ". Mô hình nhúng tải một lần khi dùng lần đầu rồi hoạt động ngoại tuyến.",
    moreModelsBefore: "Tải thêm mô hình: chạy",
    moreModelsAfter: "trong terminal, xem thư viện tại ollama.com/library",
  },
  advice: {
    ramBefore: "Máy bạn có",
    ramAmount: "{gb} GB",
    ramAfter: "RAM — {label}.",
    suggestions: "Gợi ý:",
    ollamaNotRunning:
      "Ollama chưa chạy — cài/mở Ollama (ollama.com) rồi thử lại để dùng chat cục bộ.",
    ollamaReady: "Ollama đang chạy và mô hình chat đã sẵn sàng.",
    ollamaModelMissing:
      "Ollama đang chạy nhưng mô hình chat đang chọn chưa được tải — chạy {command}.",
  },
  onboarding: {
    title: "Runtime AI cục bộ chưa sẵn sàng.",
    hintBefore: "Cài Ollama tại",
    hintAfter: ', chạy nó, rồi bấm "Kiểm tra lại".',
    recheck: "Kiểm tra lại",
    skip: "Cài sau",
  },
  reindex: {
    running: "Đang tái lập chỉ mục nguồn (cập nhật công cụ tìm kiếm cục bộ)…",
    runningProgress:
      "Đang tái lập chỉ mục nguồn (cập nhật công cụ tìm kiếm cục bộ) — {done}/{total} ({pct}%)…",
  },
  online: {
    title: "AI online (tùy chọn)",
    activeTag: "Đang gửi dữ liệu ra ngoài",
    egressNote:
      "Khi bật, câu hỏi và đoạn nguồn liên quan sẽ được gửi tới máy chủ nhà cung cấp. Dùng khóa API của chính bạn. Mặc định app chạy cục bộ, không gửi gì ra ngoài.",
    confirmBefore: "Bật",
    confirmAfter:
      "? Câu hỏi và đoạn nguồn liên quan sẽ được gửi tới máy chủ của nhà cung cấp này.",
    confirmOk: "Bật",
    keySaved: "Đã lưu khóa ••••",
    keyMissing: "Chưa nhập khóa API",
    use: "Dùng",
    keyPlaceholderReplace: "Nhập khóa mới để thay",
    keyPlaceholder: "Dán API key",
    modelPlaceholder: "— Chọn mô hình —",
    modelCustom: "Khác (nhập tay)…",
    modelNamePlaceholder: "Tên mô hình",
    testing: "Đang kiểm tra…",
    testOk: "Kết nối OK ✓",
    testFailed: "Lỗi kết nối",
  },
} as const;

export const aiEn: Widen<typeof aiVi> = {
  testConnection: "Test connection",
  modelNameToken: "model-name",
  modelSelect: {
    noModels: "No models installed yet.",
    sizeGb: "{size} GB",
  },
  runtime: {
    statusUnreadable: "Couldn't read the AI runtime status.",
  },
  local: {
    title: "Local AI (Ollama)",
    connected: "Connected",
    notConnected: "Not connected",
    notReady: "Ollama isn't ready.",
    chatModel: "Answer model",
    chatModelEmpty:
      "No answer model yet. Install one with: ollama pull qwen2.5:7b",
    embedNoteBefore: "Embedding (indexing & search) runs inside the app —",
    embedNoteStrong: "no Ollama needed",
    embedNoteAfter:
      ". The embedding model downloads once on first use, then works offline.",
    moreModelsBefore: "Get more models: run",
    moreModelsAfter:
      "in a terminal, and browse the library at ollama.com/library",
  },
  advice: {
    ramBefore: "Your computer has",
    ramAmount: "{gb} GB",
    ramAfter: "of RAM — {label}.",
    suggestions: "Suggestions:",
    ollamaNotRunning:
      "Ollama isn't running — install/open Ollama (ollama.com), then try again to use local chat.",
    ollamaReady: "Ollama is running and the chat model is ready.",
    ollamaModelMissing:
      "Ollama is running, but the selected chat model hasn't been downloaded — run {command}.",
  },
  onboarding: {
    title: "The local AI runtime isn't ready.",
    hintBefore: "Install Ollama from",
    hintAfter: ', run it, then click "Check again".',
    recheck: "Check again",
    skip: "Set up later",
  },
  reindex: {
    running: "Reindexing sources (updating the local search engine)…",
    runningProgress:
      "Reindexing sources (updating the local search engine) — {done}/{total} ({pct}%)…",
  },
  online: {
    title: "Online AI (optional)",
    activeTag: "Sending data externally",
    egressNote:
      "When turned on, your questions and related source passages are sent to the provider's servers. Uses your own API key. By default the app runs locally and sends nothing externally.",
    confirmBefore: "Turn on",
    confirmAfter:
      "? Your questions and related source passages will be sent to this provider's servers.",
    confirmOk: "Turn on",
    keySaved: "API key saved ••••",
    keyMissing: "No API key entered",
    use: "Use",
    keyPlaceholderReplace: "Enter a new key to replace it",
    keyPlaceholder: "Paste API key",
    modelPlaceholder: "— Choose a model —",
    modelCustom: "Other (type it in)…",
    modelNamePlaceholder: "Model name",
    testing: "Testing…",
    testOk: "Connection OK ✓",
    testFailed: "Connection failed",
  },
};
