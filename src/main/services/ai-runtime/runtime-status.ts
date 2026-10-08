import type { ModelSelection, RuntimeStatus } from "@shared/ipc/types";
import type { OllamaClient } from "./ollama-client";

// Compose trạng thái runtime (check-on-demand — A2). Thuần + nhận client/selection tiêm vào → test được.
// ollamaReady = kết nối được AND chat+embedding model đã chọn tồn tại trên máy.

export async function computeRuntimeStatus(
  client: OllamaClient,
  selection: ModelSelection,
): Promise<RuntimeStatus> {
  const reachable = await client.ping();
  if (!reachable) {
    return {
      reachable: false,
      ollamaReady: false,
      reason: "Ollama unreachable.",
      reasonCode: "ollamaUnreachable",
    };
  }

  if (!selection.chatModel || !selection.embeddingModel) {
    return {
      reachable: true,
      ollamaReady: false,
      reason: "Chat and embedding models not selected.",
      reasonCode: "modelsNotSelected",
    };
  }

  const installed = new Set((await client.listModels()).map((m) => m.name));
  const missing = [selection.chatModel, selection.embeddingModel].filter(
    (m) => !installed.has(m),
  );
  if (missing.length > 0) {
    return {
      reachable: true,
      ollamaReady: false,
      reason: `Selected models not installed: ${missing.join(", ")}.`,
      reasonCode: "modelsMissing",
      reasonParams: { models: missing.join(", ") },
    };
  }

  return { reachable: true, ollamaReady: true, reason: null };
}
