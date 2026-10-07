import { describe, it, expect } from "vitest";
import {
  callJson,
  streamLines,
} from "../../src/main/services/ai-runtime/online/online-http";
import { getPrivacyState } from "../../src/main/services/app-shell/privacy-state";

// 103 — mọi request AI online được tính là egress: badge 'sending' từ lúc gửi tới khi đọc xong (stream: hết body).

const mode = (): string => getPrivacyState().mode;

describe("online-http — egress", () => {
  it("callJson: sending trong lúc request + đọc JSON, xong thì về", async () => {
    let seen = "";
    const fetchFn = (async () => {
      seen = mode();
      return new Response(JSON.stringify({ ok: 1 }), { status: 200 });
    }) as unknown as typeof fetch;
    await callJson({ url: "https://api.x", headers: {}, body: {}, fetchFn });
    expect(seen).toBe("sending");
    expect(mode()).toBe("local");
  });

  it("callJson lỗi HTTP ⇒ vẫn trả badge về", async () => {
    const fetchFn = (async () =>
      new Response("", { status: 429 })) as unknown as typeof fetch;
    await expect(
      callJson({ url: "https://api.x", headers: {}, body: {}, fetchFn }),
    ).rejects.toThrow();
    expect(mode()).toBe("local");
  });

  it("streamLines: GIỮ sending tới khi đọc hết body (fetch trả về sớm khi có header)", async () => {
    const seenWhileReading: string[] = [];
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode("a\n"));
        c.enqueue(new TextEncoder().encode("b\n"));
        c.close();
      },
    });
    const fetchFn = (async () =>
      new Response(body, { status: 200 })) as unknown as typeof fetch;
    await streamLines(
      { url: "https://api.x", headers: {}, body: {}, fetchFn },
      () => seenWhileReading.push(mode()),
    );
    expect(seenWhileReading).toEqual(["sending", "sending"]);
    expect(mode()).toBe("local");
  });

  it("egress:false (Ollama localhost) ⇒ KHÔNG tính là gửi ra ngoài", async () => {
    const seen: string[] = [];
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode("x\n"));
        c.close();
      },
    });
    const fetchFn = (async () =>
      new Response(body, { status: 200 })) as unknown as typeof fetch;
    await streamLines(
      {
        url: "http://127.0.0.1:11434/api/chat",
        headers: {},
        body: {},
        fetchFn,
        egress: false,
      },
      () => seen.push(mode()),
    );
    expect(seen).toEqual(["local"]);
  });

  it("streamLines bị huỷ ⇒ badge về", async () => {
    const ac = new AbortController();
    const fetchFn = (async () => {
      ac.abort();
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    }) as unknown as typeof fetch;
    await streamLines(
      {
        url: "https://api.x",
        headers: {},
        body: {},
        fetchFn,
        signal: ac.signal,
      },
      () => undefined,
    );
    expect(mode()).toBe("local");
  });
});
