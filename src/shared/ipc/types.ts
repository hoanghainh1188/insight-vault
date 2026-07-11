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
