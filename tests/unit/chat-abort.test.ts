import { describe, it, expect } from "vitest";
import {
  ChatAbortedError,
  assertNotAborted,
  isChatAborted,
  linkAbort,
} from "../../src/main/services/ai-runtime/abort";

// 149 (research R3/R4): lỗi huỷ chuyên dụng (≠ timeout) + nối signal ngoài vào controller nội bộ (gỡ được listener).

describe("ChatAbortedError / isChatAborted", () => {
  it("nhận diện lỗi huỷ; lỗi khác / AbortError thô ⇒ false", () => {
    const e = new ChatAbortedError();
    expect(e.name).toBe("ChatAbortedError");
    expect(isChatAborted(e)).toBe(true);
    expect(isChatAborted(new Error("x"))).toBe(false);
    expect(
      isChatAborted(Object.assign(new Error("a"), { name: "AbortError" })),
    ).toBe(false);
    expect(isChatAborted(null)).toBe(false);
  });
});

describe("assertNotAborted", () => {
  it("không signal / chưa abort ⇒ không ném; đã abort ⇒ ChatAbortedError", () => {
    expect(() => assertNotAborted(undefined)).not.toThrow();
    const c = new AbortController();
    expect(() => assertNotAborted(c.signal)).not.toThrow();
    c.abort();
    expect(() => assertNotAborted(c.signal)).toThrow(ChatAbortedError);
  });
});

describe("linkAbort", () => {
  it("outer đã abort ⇒ controller abort ngay", () => {
    const outer = new AbortController();
    outer.abort();
    const inner = new AbortController();
    linkAbort(outer.signal, inner);
    expect(inner.signal.aborted).toBe(true);
  });

  it("outer abort sau ⇒ controller abort", () => {
    const outer = new AbortController();
    const inner = new AbortController();
    linkAbort(outer.signal, inner);
    expect(inner.signal.aborted).toBe(false);
    outer.abort();
    expect(inner.signal.aborted).toBe(true);
  });

  it("unlink() gỡ listener — abort sau đó không ảnh hưởng", () => {
    const outer = new AbortController();
    const inner = new AbortController();
    const unlink = linkAbort(outer.signal, inner);
    unlink();
    outer.abort();
    expect(inner.signal.aborted).toBe(false);
  });

  it("outer undefined ⇒ no-op", () => {
    const inner = new AbortController();
    const unlink = linkAbort(undefined, inner);
    expect(() => unlink()).not.toThrow();
    expect(inner.signal.aborted).toBe(false);
  });
});
