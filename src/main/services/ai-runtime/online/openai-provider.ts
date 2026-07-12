import type {
  ChatMessage,
  ChatRequest,
  ChatResult,
  EmbedResult,
  RuntimeStatus,
} from "@shared/ipc/types";
import type { ChatStreamOpts, LLMProvider } from "../provider";
import { callJson, streamLines } from "./online-http";
import { OnlineProviderError } from "./online-error";
import { PROVIDER_LABELS } from "./presets";
import { sseData, sseDeltaOpenAI } from "./stream-parse";
import type { OnlineProviderDeps } from "./provider-deps";
import { testOnlineChat } from "./anthropic-provider";

// Provider OpenAI — Chat Completions API. messages giữ nguyên dạng {role, content} (kể cả system).
// Embedding KHÔNG dùng ở đây (luôn Ollama local — quyết định #1).

const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const LABEL = PROVIDER_LABELS.openai;

export interface OpenAIRequestBody {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
}

/** THUẦN: ChatMessage[] → body OpenAI (messages nguyên dạng). */
export function toOpenAIRequest(
  messages: ChatMessage[],
  model: string,
): OpenAIRequestBody {
  return {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
}

/** THUẦN: parse response OpenAI → chuỗi content của choice đầu. */
export function parseOpenAIResponse(json: unknown): string {
  const choices = (json as { choices?: unknown })?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const content = (choices[0] as { message?: { content?: unknown } })?.message
    ?.content;
  return typeof content === "string" ? content : "";
}

export class OpenAIProvider implements LLMProvider {
  readonly id = "openai";
  constructor(private readonly deps: OnlineProviderDeps) {}

  async chat(req: ChatRequest, opts?: ChatStreamOpts): Promise<ChatResult> {
    const key = await this.deps.getKey();
    if (!key)
      throw new OnlineProviderError(`${LABEL}: chưa nhập khóa API.`, "auth");
    const model = req.model ?? this.deps.getModel();
    if (!model) throw new Error(`${LABEL}: chưa chọn mô hình.`);
    const headers = { Authorization: `Bearer ${key}` };
    if (opts?.onToken) {
      let acc = "";
      await streamLines(
        {
          url: ENDPOINT,
          headers,
          body: { ...toOpenAIRequest(req.messages, model), stream: true },
          fetchFn: this.deps.fetchFn,
          signal: opts.signal,
          providerLabel: LABEL,
        },
        (line) => {
          const payload = sseData(line);
          if (payload === null) return;
          const d = sseDeltaOpenAI(payload);
          if (d) {
            acc += d;
            opts.onToken!(d);
          }
        },
      );
      return { content: acc };
    }
    const json = await callJson({
      url: ENDPOINT,
      headers,
      body: toOpenAIRequest(req.messages, model),
      fetchFn: this.deps.fetchFn,
      timeoutMs: this.deps.timeoutMs,
      providerLabel: LABEL,
    });
    return { content: parseOpenAIResponse(json) };
  }

  async embed(): Promise<EmbedResult> {
    throw new Error(
      `${LABEL} embedding không dùng ở đây — embedding luôn dùng Ollama local.`,
    );
  }

  async test(): Promise<RuntimeStatus> {
    return testOnlineChat(this, this.deps, LABEL);
  }
}
