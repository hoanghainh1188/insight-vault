// Kiểu trao đổi qua IPC (main ↔ renderer). Nguồn: data-model.md.

/** Trạng thái riêng tư — nguồn sự thật cho privacy indicator badge. v1 luôn 'local'. */
export interface PrivacyState {
  mode: "local" | "online";
  /** Văn bản hiển thị badge, suy ra từ mode (không hard-code rời rạc ở renderer). */
  label: string;
}

/** Trạng thái onboarding lần đầu. Lưu bền ở OS settings store. */
export interface OnboardingState {
  completed: boolean;
}

/** Thông tin tĩnh của app cho header/titlebar. */
export interface AppInfo {
  name: string;
  version: string;
}

/** Kết quả đảm bảo thư mục dữ liệu cục bộ tồn tại. */
export interface DataDirInfo {
  path: string;
  ready: boolean;
}

/** Thông tin lưu trữ cục bộ (037) — hiển thị ở Cài đặt. Chỉ đọc metadata, không nội dung. */
export interface StorageInfo {
  /** Đường dẫn thư mục dữ liệu app. */
  path: string;
  /** Tổng dung lượng thư mục dữ liệu đang dùng (byte). */
  usedBytes: number;
  /** Dung lượng trống của ổ đĩa chứa thư mục (byte). */
  freeBytes: number;
}

// ===== ai-runtime (007) — nguồn: specs/.../ai-runtime/data-model.md =====

/** Một mô hình AI trên Ollama. `kind` suy đoán từ tên/metadata; UI lọc theo kind. */
export interface Model {
  name: string;
  sizeBytes: number | null;
  kind: "chat" | "embedding" | "unknown";
}

/** Lựa chọn mô hình của người dùng (lưu bền ở electron-store). null = chưa chọn. */
export interface ModelSelection {
  chatModel: string | null;
  embeddingModel: string | null;
}

/** Trạng thái runtime AI cục bộ — nguồn cho onboarding & Cài đặt. Tách khỏi OnboardingState. */
export interface RuntimeStatus {
  /** Ollama phản hồi ping trong timeout. */
  reachable: boolean;
  /** reachable AND chat+embedding model đã chọn tồn tại trên máy. */
  ollamaReady: boolean;
  /** Lý do khi chưa sẵn sàng (không kết nối / chưa chọn model / model thiếu). */
  reason: string | null;
}

/** Yêu cầu/kết quả chat & embedding (nội bộ main; KHÔNG log payload — Constitution III). */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
}
export interface ChatResult {
  content: string;
}
export interface EmbedRequest {
  text: string;
  model?: string;
}
export interface EmbedResult {
  vector: number[];
}

// ===== online-provider (031) — AI online tùy chọn (Claude/Gemini/OpenAI) =====

/** Định danh 3 nhà cung cấp AI online hỗ trợ. */
export type OnlineProviderId = "anthropic" | "gemini" | "openai";

/** View 1 provider online cho renderer — KHÔNG bao giờ chứa API key (chỉ hasKey). */
export interface OnlineProviderView {
  id: OnlineProviderId;
  /** Nhãn hiển thị (VD "Claude (Anthropic)"). */
  label: string;
  /** Đã lưu API key trong keychain chưa (suy từ keytar, không lộ key). */
  hasKey: boolean;
  /** Model đang chọn cho provider này (null = chưa chọn). */
  model: string | null;
  /** Danh sách model preset gợi ý cho provider này. */
  presets: string[];
  /** Provider này có đang là active (nguồn AI đang dùng) không. */
  active: boolean;
}

/** Trạng thái toàn bộ khu vực "AI online" cho renderer. */
export interface OnlineState {
  providers: OnlineProviderView[];
  /** Provider online đang active; null = đang dùng local Ollama. */
  activeOnlineId: OnlineProviderId | null;
}

/** Input đặt API key cho 1 provider (key CHỈ đi tới main, lưu keytar, không log). */
export interface SetProviderKeyInput {
  id: OnlineProviderId;
  apiKey: string;
}

/** Input đặt model đã chọn cho 1 provider. */
export interface SetProviderModelInput {
  id: OnlineProviderId;
  model: string | null;
}

// ===== notebooks (009) — nguồn: specs/.../notebooks/data-model.md =====

/** Màu notebook — hex thuộc palette cố định. */
export type NotebookColor = string;

/** Notebook (metadata). `sourceCount` = 0 ở feature này (source thuộc 004). */
export interface Notebook {
  id: string;
  name: string;
  color: NotebookColor;
  createdAt: number;
  updatedAt: number;
  sourceCount: number;
}

export interface CreateNotebookInput {
  name: string;
  color: NotebookColor;
}
export interface RenameNotebookInput {
  id: string;
  name: string;
}
export interface SetColorInput {
  id: string;
  color: NotebookColor;
}

// ===== ingestion (011) — nguồn: specs/.../ingestion/data-model.md =====

export type SourceKind = "pdf" | "docx" | "txt" | "md" | "url";

/** Trạng thái vòng đời nguồn. Ánh xạ UI: ready→.stat ready; queued/processing/awaiting_embedding→.stat proc; error→.stat err. */
export type SourceStatus =
  "queued" | "processing" | "awaiting_embedding" | "ready" | "error";

/** Vị trí gốc của một chunk trong nguồn — gắn NGAY lúc chunk (Constitution II). half-open [charStart, charEnd). */
export interface Locator {
  /** PDF: số trang 1-based; loại khác: null. */
  page: number | null;
  charStart: number;
  charEnd: number;
}

/** Nguồn (metadata) — KHÔNG expose origin/content_hash toàn văn ra renderer. */
export interface Source {
  id: string;
  notebookId: string;
  kind: SourceKind;
  title: string;
  status: SourceStatus;
  errorLabel: string | null;
  pageCount: number | null;
  createdAt: number;
  updatedAt: number;
}

/** Chunk (đoạn) — đơn vị embed & trích dẫn. */
export interface Chunk {
  id: string;
  sourceId: string;
  ordinal: number;
  text: string;
  locator: Locator;
}

export type AddSourceInput =
  | { notebookId: string; kind: "url"; url: string }
  | {
      notebookId: string;
      kind: Exclude<SourceKind, "url">;
      filePath: string;
    };

export interface AddSourceResult {
  source: Source;
  /** true nếu trùng content_hash/URL trong cùng notebook (renderer hỏi xác nhận). */
  duplicateWarning: boolean;
}

/** Bước xử lý hiện thời của pipeline (cho thanh tiến độ). */
export type IngestStep =
  "parse" | "clean" | "chunk" | "embed" | "store" | "done";

/** Event push main→renderer khi trạng thái/tiến độ một nguồn đổi (kênh source:progress). */
export interface SourceProgressEvent {
  sourceId: string;
  notebookId: string;
  status: SourceStatus;
  step: IngestStep;
  progress: number; // 0..1
  errorLabel?: string;
}

// ===== rag-qa (013) — nguồn: specs/.../rag-qa/data-model.md =====

/** Chế độ trả lời: theo nguồn (grounded, không bịa) / mở rộng (open, dùng thêm kiến thức chung). */
export type RagMode = "grounded" | "open";

/** Một lượt hội thoại (renderer giữ in-memory, gửi ~6 lượt gần nhất cho multi-turn). */
export interface RagTurn {
  role: "user" | "assistant";
  content: string;
}

export interface RagAskInput {
  notebookId: string;
  question: string;
  mode: RagMode;
  history: RagTurn[];
}

/** Trích dẫn: số [n] trong câu trả lời → chunk/nguồn/vị trí thật (dữ liệu cho source-viewer 006). */
export interface Citation {
  n: number;
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  locator: Locator;
}

/** Kết quả hỏi đáp — answer đã hậu kiểm (gỡ chip lỗi), citations chỉ gồm [n] hợp lệ & thực xuất hiện. */
export interface RagAnswer {
  answer: string;
  citations: Citation[];
  notFound: boolean; // true khi grounded không đủ căn cứ
  modeUsed: RagMode;
}

// ===== streaming (039) — Chat trả lời chạy dần =====

/** Input rag:askStream = RagAskInput + streamId (renderer sinh, để tương quan token + huỷ). */
export interface RagAskStreamInput extends RagAskInput {
  streamId: string;
}

/** Sự kiện token đẩy từ main → renderer trong lúc stream (push, không phải invoke/response). */
export interface RagStreamTokenEvent {
  streamId: string;
  delta: string;
}

/** Một tin trong lịch sử hội thoại đã lưu bền theo notebook (027-chat-history). */
export interface StoredChatMessage {
  role: "user" | "assistant";
  content: string;
  citations: Citation[]; // assistant; user = []
  notFound: boolean;
  createdAt: number;
}

// ===== source-viewer (019) — nguồn: specs/.../source-viewer/data-model.md =====

/** Mốc trang PDF: offset ký tự toàn cục nơi mỗi trang bắt đầu trong `SourceContent.text`. */
export interface PageBreak {
  page: number; // 1-based
  offset: number; // charStart của trang trong text
}

/** Nội dung nguồn để hiển thị ở viewer — tái dựng runtime từ chunk, không lưu bền. */
export interface SourceContent {
  kind: SourceKind;
  title: string;
  pageCount: number | null; // PDF: số trang; khác: null
  text: string; // toàn văn đã-làm-sạch tái dựng (== T gốc lúc chunk)
  pageBreaks: PageBreak[]; // chỉ PDF; non-PDF: []
}

// ===== studio (021) — nguồn: specs/.../studio/data-model.md =====

/** 4 loại bản tổng hợp Studio (khác nhau ở system prompt). */
export type StudioKind = "summary" | "keyPoints" | "faq" | "outline";

/** Kết quả tổng hợp Studio — content dạng text kèm chip [n]; citations đã hậu kiểm (Constitution II). */
export interface StudioResult {
  id: string;
  notebookId: string;
  kind: StudioKind;
  content: string; // text kèm token [n]
  citations: Citation[]; // đã hậu kiểm; rỗng chỉ khi content rỗng (không lưu bản rỗng)
  createdAt: number;
  truncated?: boolean; // true khi số chunk đưa vào context < tổng chunk notebook (chỉ tổng hợp phần đầu)
}

/** Input sinh 1 bản tổng hợp cho notebook theo loại. */
export interface StudioGenerateInput {
  notebookId: string;
  kind: StudioKind;
  sourceId?: string; // 025: lọc theo 1 nguồn; bỏ trống = toàn bộ nguồn ready
}

/** Input xuất kết quả Studio ra tệp .md (025). */
export interface StudioExportInput {
  content: string;
  suggestedName: string;
}

/** Kết quả xuất tệp: saved=false khi người dùng huỷ hộp thoại. */
export interface StudioExportResult {
  saved: boolean;
  path?: string;
}
