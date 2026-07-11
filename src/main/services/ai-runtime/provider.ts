import type {
  ChatRequest,
  ChatResult,
  EmbedRequest,
  EmbedResult,
  RuntimeStatus,
} from "@shared/ipc/types";

// Giao diện chung cho "nhà cung cấp AI" (ADR D3). Mọi nơi gọi AI đi qua đây, không phụ thuộc Ollama.
// v1: OllamaProvider. Feature 008 thêm provider online qua CÙNG interface (SC-006).
export interface LLMProvider {
  readonly id: string;
  chat(req: ChatRequest): Promise<ChatResult>;
  embed(req: EmbedRequest): Promise<EmbedResult>;
  /** Tự kiểm tra sẵn sàng (kết nối + model đang dùng tồn tại). */
  test(): Promise<RuntimeStatus>;
}
