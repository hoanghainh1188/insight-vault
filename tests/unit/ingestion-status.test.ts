import { describe, it, expect } from "vitest";
import {
  SOURCE_STATUSES,
  canTransition,
  errorCodeForStep,
} from "../../src/main/services/ingestion/status";
import {
  hashBytes,
  hashString,
  normalizeUrl,
  urlContentHash,
} from "../../src/main/services/ingestion/dedup";

describe("status transitions", () => {
  it("có đủ 5 trạng thái", () => {
    expect(SOURCE_STATUSES).toEqual([
      "queued",
      "processing",
      "awaiting_embedding",
      "ready",
      "error",
    ]);
  });

  it("chuyển hợp lệ theo state machine", () => {
    expect(canTransition("queued", "processing")).toBe(true);
    expect(canTransition("processing", "awaiting_embedding")).toBe(true);
    expect(canTransition("awaiting_embedding", "ready")).toBe(true);
    expect(canTransition("error", "queued")).toBe(true); // retry
    expect(canTransition("ready", "processing")).toBe(false); // ready là cuối
    expect(canTransition("queued", "ready")).toBe(false); // phải qua processing
  });

  it("mã lỗi theo bước; url→'fetch' (123: lưu mã)", () => {
    expect(errorCodeForStep("parse")).toBe("extract");
    expect(errorCodeForStep("parse", "url")).toBe("fetch");
    expect(errorCodeForStep("embed")).toBe("embed");
    expect(errorCodeForStep("store")).toBe("store");
    expect(errorCodeForStep("done")).toBe("generic");
  });
});

describe("dedup", () => {
  it("hashBytes / hashString tất định", () => {
    expect(hashBytes(new Uint8Array([1, 2, 3]))).toBe(
      hashBytes(new Uint8Array([1, 2, 3])),
    );
    expect(hashString("abc")).toHaveLength(64);
  });

  it("normalizeUrl bỏ fragment, hạ host, bỏ '/' cuối", () => {
    expect(normalizeUrl("HTTPS://Example.com/bai-viet/#muc-2")).toBe(
      "https://example.com/bai-viet",
    );
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("URL khác nhau về fragment → cùng content_hash (coi là trùng)", () => {
    expect(urlContentHash("https://a.com/x#p1")).toBe(
      urlContentHash("https://a.com/x#p2"),
    );
  });
});
