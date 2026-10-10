import { describe, it, expect, vi } from "vitest";
import { OnlineProviderError } from "../../src/main/services/ai-runtime/online/online-error";
import { ChatAbortedError } from "../../src/main/services/ai-runtime/abort";
import { getPrivacyState } from "../../src/main/services/app-shell/privacy-state";
import {
  callJson,
  streamLines,
} from "../../src/main/services/ai-runtime/online/online-http";
import { OpenAIProvider } from "../../src/main/services/ai-runtime/online/openai-provider";
import { AnthropicProvider } from "../../src/main/services/ai-runtime/online/anthropic-provider";
import { GeminiProvider } from "../../src/main/services/ai-runtime/online/gemini-provider";
import { createOllamaClient } from "../../src/main/services/ai-runtime/ollama-client";

// 149 (research R4): callJson tôn trọng signal ngoài — huỷ ⇒ ChatAbortedError (KHÔNG OnlineProviderError kind "timeout" — vốn bật
// nút "Tạo bằng AI cục bộ"); badge egress về nghỉ; timeout thật giữ nguyên.

const abortErr = (): Error =>
  Object.assign(new Error("aborted"), { name: "AbortError" });

const hanging = (hangBody = false) =>
  vi.fn(
    (_u: string, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const sig = init!.signal!;
        if (!hangBody) {
          sig.addEventListener("abort", () => reject(abortErr()));
          return;
        }
        resolve({
          ok: true,
          status: 200,
          json: () =>
            new Promise((_r, rej) =>
              sig.addEventListener("abort", () => rej(abortErr())),
            ),
        } as unknown as Response);
      }),
  ) as unknown as typeof fetch;

describe("callJson — huỷ (149)", () => {
  it("abort khi đang chờ ⇒ ChatAbortedError, badge về local", async () => {
    const outer = new AbortController();
    const p = callJson({
      url: "https://api.x",
      headers: {},
      body: {},
      fetchFn: hanging(),
      signal: outer.signal,
    });
    expect(getPrivacyState().mode).toBe("sending");
    outer.abort();
    const err = await p.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ChatAbortedError);
    expect(err).not.toBeInstanceOf(OnlineProviderError);
    expect(getPrivacyState().mode).toBe("local");
  });

  it("abort khi đang đọc body ⇒ ChatAbortedError", async () => {
    const outer = new AbortController();
    const p = callJson({
      url: "https://api.x",
      headers: {},
      body: {},
      fetchFn: hanging(true),
      signal: outer.signal,
    });
    await new Promise((r) => setTimeout(r, 0));
    outer.abort();
    await expect(p).rejects.toBeInstanceOf(ChatAbortedError);
    expect(getPrivacyState().mode).toBe("local");
  });

  it("đã abort trước ⇒ ChatAbortedError, không gọi fetch", async () => {
    const outer = new AbortController();
    outer.abort();
    const fetchFn = hanging();
    await expect(
      callJson({
        url: "https://api.x",
        headers: {},
        body: {},
        fetchFn,
        signal: outer.signal,
      }),
    ).rejects.toBeInstanceOf(ChatAbortedError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("timeout thật (không huỷ) ⇒ OnlineProviderError kind timeout như cũ", async () => {
    const err = await callJson({
      url: "https://api.x",
      headers: {},
      body: {},
      fetchFn: hanging(),
      timeoutMs: 10,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OnlineProviderError);
    expect((err as OnlineProviderError).kind).toBe("timeout");
  });
});

describe("callJson — timeout khi đang đọc body (149)", () => {
  it("hết thời gian lúc đọc body ⇒ OnlineProviderError kind timeout", async () => {
    const err = await callJson({
      url: "https://api.x",
      headers: {},
      body: {},
      fetchFn: hanging(true),
      timeoutMs: 10,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OnlineProviderError);
    expect((err as OnlineProviderError).kind).toBe("timeout");
  });
});

// 178 (PR 4, T062, research R7): KHOÁ hợp đồng mà Studio stream dựa vào — nhánh stream (có onToken) khi huỷ TRẢ phần đã nhận,
// KHÔNG ném (Ollama + 3 provider online dùng streamLines). Vì vậy studio-service phải assertNotAborted ngay sau lượt stream.
// Privacy (Constitution I, FR-051): stream online ⇒ egress "sending" khi đang đọc, về nghỉ khi xong VÀ khi huỷ.

/** fetch giả: gửi `lines` (mỗi dòng 1 chunk) rồi TREO; signal abort ⇒ stream lỗi AbortError (như fetch thật). */
function streamingFetch(lines: string[]) {
  const state = { closed: false };
  const fetchFn = vi.fn(async (_u: string, init?: RequestInit) => {
    const sig = init!.signal!;
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (const l of lines) c.enqueue(enc.encode(`${l}\n`));
        sig.addEventListener("abort", () => {
          state.closed = true;
          c.error(abortErr());
        });
      },
    });
    return new Response(body, { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchFn, state };
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("streamLines — huỷ giữa stream (178 PR 4)", () => {
  it("abort ⇒ resolve (không ném), giữ các dòng đã nhận; egress sending khi đọc → local khi huỷ", async () => {
    const { fetchFn, state } = streamingFetch(["a", "b"]);
    const outer = new AbortController();
    const got: string[] = [];
    const modes: string[] = [];
    const p = streamLines(
      {
        url: "https://api.x",
        headers: {},
        body: {},
        fetchFn,
        signal: outer.signal,
      },
      (l) => {
        got.push(l);
        modes.push(getPrivacyState().mode);
      },
    );
    await tick();
    expect(getPrivacyState().mode).toBe("sending");
    outer.abort();
    await expect(p).resolves.toBeUndefined();
    expect(got).toEqual(["a", "b"]);
    expect(modes.every((m) => m === "sending")).toBe(true);
    expect(state.closed).toBe(true);
    expect(getPrivacyState().mode).not.toBe("sending");
  });

  it("đọc hết bình thường ⇒ egress về nghỉ", async () => {
    const enc = new TextEncoder();
    const fetchFn = (async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(enc.encode("x\n"));
            c.close();
          },
        }),
        { status: 200 },
      )) as unknown as typeof fetch;
    await streamLines(
      { url: "https://api.x", headers: {}, body: {}, fetchFn },
      () => {
        expect(getPrivacyState().mode).toBe("sending");
      },
    );
    expect(getPrivacyState().mode).not.toBe("sending");
  });
});

const ONLINE = [
  [
    "openai",
    (fetchFn: typeof fetch) =>
      new OpenAIProvider({
        getKey: async () => "k",
        getModel: () => "m",
        fetchFn,
      }),
    [
      'data: {"choices":[{"delta":{"content":"Xin "}}]}',
      'data: {"choices":[{"delta":{"content":"chào"}}]}',
    ],
  ],
  [
    "anthropic",
    (fetchFn: typeof fetch) =>
      new AnthropicProvider({
        getKey: async () => "k",
        getModel: () => "m",
        fetchFn,
      }),
    [
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Xin "}}',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"chào"}}',
    ],
  ],
  [
    "gemini",
    (fetchFn: typeof fetch) =>
      new GeminiProvider({
        getKey: async () => "k",
        getModel: () => "m",
        fetchFn,
      }),
    [
      'data: {"candidates":[{"content":{"parts":[{"text":"Xin "}]}}]}',
      'data: {"candidates":[{"content":{"parts":[{"text":"chào"}]}}]}',
    ],
  ],
] as const;

describe.each(ONLINE)(
  "%s — chat stream bị huỷ (178 PR 4)",
  (_name, make, lines) => {
    it("trả {content: phần đã nhận}, KHÔNG ném; egress về nghỉ", async () => {
      const { fetchFn } = streamingFetch([...lines]);
      const outer = new AbortController();
      const deltas: string[] = [];
      const p = make(fetchFn).chat(
        { messages: [{ role: "user", content: "hi" }] },
        { signal: outer.signal, onToken: (d) => deltas.push(d) },
      );
      await tick();
      await tick();
      expect(getPrivacyState().mode).toBe("sending");
      outer.abort();
      await expect(p).resolves.toEqual({ content: "Xin chào" });
      expect(deltas).toEqual(["Xin ", "chào"]);
      expect(getPrivacyState().mode).not.toBe("sending");
    });
  },
);

describe("Ollama — chat stream bị huỷ (178 PR 4)", () => {
  it("trả {content: phần đã nhận}, KHÔNG ném; không bật egress (localhost)", async () => {
    const { fetchFn } = streamingFetch([
      JSON.stringify({ message: { content: "Xin " }, done: false }),
      JSON.stringify({ message: { content: "chào" }, done: false }),
    ]);
    const outer = new AbortController();
    const modes: string[] = [];
    const p = createOllamaClient({ fetchFn }).chat(
      { messages: [{ role: "user", content: "hi" }] },
      {
        signal: outer.signal,
        onToken: () => modes.push(getPrivacyState().mode),
      },
    );
    await tick();
    outer.abort();
    await expect(p).resolves.toEqual({ content: "Xin chào" });
    expect(modes).toHaveLength(2);
    expect(modes.every((m) => m !== "sending")).toBe(true);
  });
});
