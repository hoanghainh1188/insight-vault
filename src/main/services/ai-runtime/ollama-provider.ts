import type {
  ChatRequest,
  ChatResult,
  EmbedRequest,
  EmbedResult,
  ModelSelection,
  RuntimeStatus,
} from "@shared/ipc/types";
import type { ChatStreamOpts, LLMProvider } from "./provider";
import type { OllamaClient } from "./ollama-client";
import { computeRuntimeStatus } from "./runtime-status";

// Provider Ollama cục bộ. Nhận client + hàm đọc selection (tách khỏi service model-selection → test được).
// Model dùng: req.model nếu có, nếu không lấy từ selection đã chọn.

export class OllamaProvider implements LLMProvider {
  readonly id = "ollama";

  constructor(
    private readonly client: OllamaClient,
    private readonly getSelection: () => ModelSelection,
  ) {}

  async chat(req: ChatRequest, opts?: ChatStreamOpts): Promise<ChatResult> {
    const model = req.model ?? this.getSelection().chatModel;
    if (!model) throw new Error("Chưa chọn mô hình trả lời (chat model).");
    return this.client.chat({ ...req, model }, opts);
  }

  async embed(req: EmbedRequest): Promise<EmbedResult> {
    const model = req.model ?? this.getSelection().embeddingModel;
    if (!model) throw new Error("Chưa chọn mô hình embedding.");
    return this.client.embed({ ...req, model });
  }

  async test(): Promise<RuntimeStatus> {
    return computeRuntimeStatus(this.client, this.getSelection());
  }
}
