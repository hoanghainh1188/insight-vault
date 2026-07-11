import type { Model, ModelSelection, RuntimeStatus } from "@shared/ipc/types";
import { createOllamaClient } from "./ollama-client";
import { OllamaProvider } from "./ollama-provider";
import { ProviderRegistry } from "./registry";
import {
  getSelectedModels,
  setSelectedModels,
  type StoreLike,
} from "./model-selection";
import { computeRuntimeStatus } from "./runtime-status";

// Ghép runtime AI ở main: Ollama client + registry(OllamaProvider) + model-selection.
// Đây là bề mặt mà IPC handler gọi (renderer chỉ chạm qua 5 kênh ai:* whitelisted).
export interface AiRuntime {
  listModels(): Promise<Model[]>;
  testConnection(): Promise<RuntimeStatus>;
  getSelectedModels(): ModelSelection;
  setSelectedModels(sel: ModelSelection): ModelSelection;
  getRuntimeStatus(): Promise<RuntimeStatus>;
  registry: ProviderRegistry;
}

export function createAiRuntime(store: StoreLike): AiRuntime {
  const client = createOllamaClient();
  const registry = new ProviderRegistry();
  registry.register(new OllamaProvider(client, () => getSelectedModels(store)));

  return {
    listModels: () => client.listModels(),
    testConnection: () =>
      computeRuntimeStatus(client, getSelectedModels(store)),
    getSelectedModels: () => getSelectedModels(store),
    setSelectedModels: (sel) => setSelectedModels(store, sel),
    getRuntimeStatus: () =>
      computeRuntimeStatus(client, getSelectedModels(store)),
    registry,
  };
}
