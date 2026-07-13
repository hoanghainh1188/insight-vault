// Health-check Ollama (059, US3) — CHỈ phục vụ chat (embedding đã in-process). Tái dùng ollama-client
// (007): ping (đang chạy?) + listModels (/api/tags → model đã pull). I/O mỏng — loại khỏi ngưỡng coverage.

export interface OllamaHealth {
  /** Ollama đang phục vụ (ping localhost:11434 ok). false = chưa cài/chưa chạy. */
  running: boolean;
  /** Tên các model đã pull (rỗng khi không chạy). */
  models: string[];
  /** Model chat đang chọn đã được pull chưa. */
  modelPulled: boolean;
}

export interface OllamaHealthDeps {
  ping(): Promise<boolean>;
  listModels(): Promise<{ name: string }[]>;
  selectedChatModel(): string | undefined;
}

export async function checkOllama(
  deps: OllamaHealthDeps,
): Promise<OllamaHealth> {
  const running = await deps.ping();
  const models = running ? (await deps.listModels()).map((m) => m.name) : [];
  const sel = deps.selectedChatModel();
  const modelPulled = sel != null && sel !== "" && models.includes(sel);
  return { running, models, modelPulled };
}
