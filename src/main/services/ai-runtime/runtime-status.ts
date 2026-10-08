import type { ModelSelection, RuntimeStatus } from "@shared/ipc/types";
import type { OllamaClient } from "./ollama-client";

// Compose trạng thái runtime (check-on-demand — A2). Thuần + nhận client/selection tiêm vào → test được.
// ollamaReady = kết nối được AND mô hình TRẢ LỜI đã chọn có trên máy. #124: embedding chạy in-process từ 059
// (e5-small) ⇒ KHÔNG còn yêu cầu chọn/cài mô hình embedding của Ollama (trước đây chặn máy cài mới).

export async function computeRuntimeStatus(
  client: OllamaClient,
  selection: ModelSelection,
): Promise<RuntimeStatus> {
  const reachable = await client.ping();
  if (!reachable) {
    return {
      reachable: false,
      ollamaReady: false,
      reason:
        "Không kết nối được Ollama (kiểm tra Ollama đã cài và đang chạy).",
    };
  }

  if (!selection.chatModel) {
    return {
      reachable: true,
      ollamaReady: false,
      reason: "Chưa chọn mô hình trả lời.",
    };
  }

  const installed = new Set((await client.listModels()).map((m) => m.name));
  if (!installed.has(selection.chatModel)) {
    return {
      reachable: true,
      ollamaReady: false,
      reason: `Mô hình đã chọn không có trên máy: ${selection.chatModel}.`,
    };
  }

  return { reachable: true, ollamaReady: true, reason: null };
}
