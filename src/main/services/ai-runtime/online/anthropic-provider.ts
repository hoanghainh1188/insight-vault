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
import { sseData, sseDeltaAnthropic } from "./stream-parse";
import type { OnlineProviderDeps } from "./provider-deps";

// Provider Claude (Anthropic) — Messages API. system tách khỏi messages (khác OpenAI). Embedding KHÔNG hỗ
// trợ (Anthropic không có API embedding) → luôn dùng Ollama local (quyết định #1).

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;
const LABEL = PROVIDER_LABELS.anthropic;

export interface AnthropicRequestBody {
  model: string;
  max_tokens: number;
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

/** THUẦN: ChatMessage[] → body Anthropic. Gộp mọi 'system' thành field `system`; còn lại user/assistant. */
export function toAnthropicRequest(
  messages: ChatMessage[],
  model: string,
  maxTokens: number = DEFAULT_MAX_TOKENS,
): AnthropicRequestBody {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));
  const body: AnthropicRequestBody = {
    model,
    max_tokens: maxTokens,
    messages: turns,
  };
  if (system) body.system = system;
  return body;
}

/** THUẦN: parse response Anthropic → chuỗi text (nối các block type=text). */
export function parseAnthropicResponse(json: unknown): string {
  const content = (json as { content?: unknown })?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (b): b is { type: string; text: string } =>
        !!b &&
        typeof b === "object" &&
        (b as { type?: unknown }).type === "text" &&
        typeof (b as { text?: unknown }).text === "string",
    )
    .map((b) => b.text)
    .join("");
}

export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic";
  constructor(private readonly deps: OnlineProviderDeps) {}

  async chat(req: ChatRequest, opts?: ChatStreamOpts): Promise<ChatResult> {
    const key = await this.deps.getKey();
    if (!key)
      throw new OnlineProviderError(`${LABEL}: chưa nhập khóa API.`, "auth");
    const model = req.model ?? this.deps.getModel();
    if (!model) throw new Error(`${LABEL}: chưa chọn mô hình.`);
    const headers = {
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
    };
    if (opts?.onToken) {
      let acc = "";
      await streamLines(
        {
          url: ENDPOINT,
          headers,
          body: { ...toAnthropicRequest(req.messages, model), stream: true },
          fetchFn: this.deps.fetchFn,
          signal: opts.signal,
          providerLabel: LABEL,
        },
        (line) => {
          const payload = sseData(line);
          if (payload === null) return;
          const d = sseDeltaAnthropic(payload);
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
      body: toAnthropicRequest(req.messages, model),
      fetchFn: this.deps.fetchFn,
      timeoutMs: this.deps.timeoutMs,
      providerLabel: LABEL,
    });
    return { content: parseAnthropicResponse(json) };
  }

  async embed(): Promise<EmbedResult> {
    throw new Error(
      `${LABEL} không hỗ trợ embedding — embedding luôn dùng Ollama local.`,
    );
  }

  async test(): Promise<RuntimeStatus> {
    return testOnlineChat(this, this.deps, LABEL);
  }
}

/** Chung cho 3 provider: test = gọi chat "ping" tối thiểu; báo reason rõ khi thiếu key/model/lỗi. */
export async function testOnlineChat(
  provider: LLMProvider,
  deps: OnlineProviderDeps,
  label: string,
): Promise<RuntimeStatus> {
  const key = await deps.getKey();
  if (!key)
    return {
      reachable: false,
      ollamaReady: false,
      reason: `${label}: chưa nhập khóa API.`,
    };
  if (!deps.getModel())
    return {
      reachable: false,
      ollamaReady: false,
      reason: `${label}: chưa chọn mô hình.`,
    };
  try {
    await provider.chat({ messages: [{ role: "user", content: "ping" }] });
    return { reachable: true, ollamaReady: true, reason: null };
  } catch (e) {
    return {
      reachable: false,
      ollamaReady: false,
      reason:
        e instanceof Error ? e.message : `${label}: kiểm tra kết nối thất bại.`,
    };
  }
}
