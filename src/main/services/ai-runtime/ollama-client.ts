import type {
  ChatRequest,
  ChatResult,
  EmbedRequest,
  EmbedResult,
  Model,
} from "@shared/ipc/types";
import { logEvent } from "../../logging";
import type { ChatStreamOpts } from "./provider";
import { streamLines } from "./online/online-http";
import { parseOllamaLine } from "./online/stream-parse";

// HTTP client tới Ollama (Constitution III: chỉ chạy ở main). Nhận `fetchFn` tiêm vào để unit-test
// không cần Ollama thật. baseUrl mặc định localhost:11434 (A7), override qua env OLLAMA_HOST.

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";

type FetchFn = typeof fetch;

/**
 * Chỉ chấp nhận Ollama host trỏ localhost/127.0.0.1 (Constitution I: local, không egress). Env OLLAMA_HOST
 * trỏ ra ngoài → bỏ qua + fallback default (không để hành vi thật lệch badge "Chạy cục bộ"). Trả về [url, warn?].
 */
export function resolveBaseUrl(
  envHost: string | undefined,
  explicit?: string,
): { url: string; warning: string | null } {
  const candidate = explicit ?? envHost;
  if (!candidate) return { url: DEFAULT_OLLAMA_URL, warning: null };
  try {
    const u = new URL(candidate);
    const isLocal =
      (u.protocol === "http:" || u.protocol === "https:") &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1");
    if (isLocal) return { url: candidate.replace(/\/$/, ""), warning: null };
  } catch {
    // URL không hợp lệ → fallback bên dưới.
  }
  return {
    url: DEFAULT_OLLAMA_URL,
    warning: `OLLAMA_HOST không phải localhost — bỏ qua, dùng ${DEFAULT_OLLAMA_URL}.`,
  };
}

export interface OllamaClientOptions {
  fetchFn?: FetchFn;
  baseUrl?: string;
  /** Timeout mặc định (ping/listModels — kiểm sẵn sàng, cần ngắn). */
  timeoutMs?: number;
  /** Timeout cho chat (LLM sinh câu trả lời — cần dài). */
  chatTimeoutMs?: number;
  /** Timeout cho embed. */
  embedTimeoutMs?: number;
}

// Sinh câu trả lời LLM có thể mất hàng chục giây (model local 7B+) → timeout dài hơn nhiều ping (issue #15).
const DEFAULT_CHAT_TIMEOUT_MS = 120_000;
const DEFAULT_EMBED_TIMEOUT_MS = 60_000;

export interface OllamaClient {
  /** GET /api/tags → Model[]. Lỗi/không kết nối → [] (không throw). */
  listModels(): Promise<Model[]>;
  /** true nếu Ollama phản hồi trong timeout. */
  ping(): Promise<boolean>;
  chat(req: ChatRequest, opts?: ChatStreamOpts): Promise<ChatResult>;
  embed(req: EmbedRequest): Promise<EmbedResult>;
}

/** Suy đoán loại model từ tên (v1 heuristic — Ollama /api/tags không trả kind rõ ràng). */
export function inferKind(name: string): Model["kind"] {
  return /embed/i.test(name) ? "embedding" : "chat";
}

interface RawTag {
  name: string;
  size?: number;
}

export function createOllamaClient(
  opts: OllamaClientOptions = {},
): OllamaClient {
  const fetchFn = opts.fetchFn ?? fetch;
  const { url: baseUrl, warning } = resolveBaseUrl(
    process.env["OLLAMA_HOST"],
    opts.baseUrl,
  );
  if (warning) logEvent("ai.ollamaHost.rejected", { warning });
  const timeoutMs = opts.timeoutMs ?? 5000;
  const chatTimeoutMs = opts.chatTimeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS;
  const embedTimeoutMs = opts.embedTimeoutMs ?? DEFAULT_EMBED_TIMEOUT_MS;

  async function call(
    path: string,
    init?: RequestInit,
    timeout: number = timeoutMs,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetchFn(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async listModels() {
      try {
        const res = await call("/api/tags");
        if (!res.ok) return [];
        const data = (await res.json()) as { models?: RawTag[] };
        return (data.models ?? []).map((m) => ({
          name: m.name,
          sizeBytes: typeof m.size === "number" ? m.size : null,
          kind: inferKind(m.name),
        }));
      } catch {
        return [];
      }
    },

    async ping() {
      try {
        const res = await call("/api/tags");
        return res.ok;
      } catch {
        return false;
      }
    },

    async chat(req: ChatRequest, opts?: ChatStreamOpts): Promise<ChatResult> {
      // Stream (039): NDJSON stream:true → nối delta qua onToken; giữ phần đã nhận khi huỷ (signal).
      if (opts?.onToken) {
        let acc = "";
        await streamLines(
          {
            url: `${baseUrl}/api/chat`,
            headers: {},
            body: { model: req.model, messages: req.messages, stream: true },
            fetchFn,
            signal: opts.signal,
            providerLabel: "Ollama",
          },
          (line) => {
            const delta = parseOllamaLine(line);
            if (delta) {
              acc += delta;
              opts.onToken!(delta);
            }
          },
        );
        return { content: acc };
      }
      const res = await call(
        "/api/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: req.model,
            messages: req.messages,
            stream: false,
          }),
        },
        chatTimeoutMs,
      );
      if (!res.ok) throw new Error(`Ollama chat lỗi: ${res.status}`);
      const data = (await res.json()) as { message?: { content?: string } };
      return { content: data.message?.content ?? "" };
    },

    async embed(req: EmbedRequest): Promise<EmbedResult> {
      const res = await call(
        "/api/embeddings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: req.model, prompt: req.text }),
        },
        embedTimeoutMs,
      );
      if (!res.ok) throw new Error(`Ollama embed lỗi: ${res.status}`);
      const data = (await res.json()) as { embedding?: number[] };
      return { vector: data.embedding ?? [] };
    },
  };
}
