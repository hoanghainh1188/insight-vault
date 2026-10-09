import { describe, it, expect, vi } from "vitest";
import { callJson } from "../../src/main/services/ai-runtime/online/online-http";
import { OnlineProviderError } from "../../src/main/services/ai-runtime/online/online-error";
import { ChatAbortedError } from "../../src/main/services/ai-runtime/abort";
import { getPrivacyState } from "../../src/main/services/app-shell/privacy-state";

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
