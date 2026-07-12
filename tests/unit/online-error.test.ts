import { describe, it, expect } from "vitest";
import {
  errorForStatus,
  errorForCause,
  OnlineProviderError,
} from "../../src/main/services/ai-runtime/online/online-error";

describe("online-error (031)", () => {
  it("map HTTP status → kind + thông báo", () => {
    expect(errorForStatus(401).kind).toBe("auth");
    expect(errorForStatus(403).kind).toBe("auth");
    expect(errorForStatus(429).kind).toBe("rate-limit");
    expect(errorForStatus(500).kind).toBe("server");
    expect(errorForStatus(503).kind).toBe("server");
    expect(errorForStatus(418).kind).toBe("unknown");
    expect(errorForStatus(401).message).toMatch(/Khóa API/);
    expect(errorForStatus(429).message).toMatch(/giới hạn/);
  });

  it("map cause fetch → timeout (AbortError) hoặc network", () => {
    expect(errorForCause({ name: "AbortError" }).kind).toBe("timeout");
    expect(errorForCause(new Error("boom")).kind).toBe("network");
    expect(errorForCause(null).kind).toBe("network");
  });

  it("providerLabel được thêm tiền tố", () => {
    const e = errorForStatus(401, "Claude (Anthropic)");
    expect(e).toBeInstanceOf(OnlineProviderError);
    expect(e.message).toMatch(/^Claude \(Anthropic\):/);
  });
});
