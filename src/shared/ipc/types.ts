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
