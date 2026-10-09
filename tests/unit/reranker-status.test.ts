import { describe, it, expect } from "vitest";
import {
  canRetryDownload,
  nextRerankerState,
  RETRY_COOLDOWN_MS,
  type RerankerState,
} from "../../src/main/services/rerank/status";

// 109 (data-model RerankerStatus, T027): máy trạng thái thuần của bộ chấm độ liên quan.

describe("nextRerankerState", () => {
  it("idle → downloading → ready", () => {
    let s: RerankerState = "idle";
    s = nextRerankerState(s, "start");
    expect(s).toBe("downloading");
    s = nextRerankerState(s, "loaded");
    expect(s).toBe("ready");
  });

  it("downloading → error; error → downloading (thử lại)", () => {
    expect(nextRerankerState("downloading", "failed")).toBe("error");
    expect(nextRerankerState("error", "start")).toBe("downloading");
  });

  it("sự kiện lặp / không hợp lệ ⇒ giữ nguyên (idempotent)", () => {
    expect(nextRerankerState("ready", "start")).toBe("ready");
    expect(nextRerankerState("downloading", "start")).toBe("downloading");
    expect(nextRerankerState("ready", "failed")).toBe("ready");
    expect(nextRerankerState("idle", "loaded")).toBe("idle");
    expect(nextRerankerState("error", "loaded")).toBe("error");
  });
});

describe("nextRerankerState — nạp từ cache (153)", () => {
  it("đã có cache: idle → loading → ready (không phải downloading)", () => {
    let s: RerankerState = "idle";
    s = nextRerankerState(s, "start", { cached: true });
    expect(s).toBe("loading");
    s = nextRerankerState(s, "loaded");
    expect(s).toBe("ready");
  });

  it("chưa có cache vẫn là downloading; mặc định (không nói) = downloading", () => {
    expect(nextRerankerState("idle", "start", { cached: false })).toBe(
      "downloading",
    );
    expect(nextRerankerState("idle", "start")).toBe("downloading");
  });

  it("loading → error khi lỗi; error → loading khi thử lại mà cache vẫn còn", () => {
    expect(nextRerankerState("loading", "failed")).toBe("error");
    expect(nextRerankerState("error", "start", { cached: true })).toBe(
      "loading",
    );
  });

  it("đang loading thì start lặp giữ nguyên", () => {
    expect(nextRerankerState("loading", "start", { cached: false })).toBe(
      "loading",
    );
  });
});

describe("canRetryDownload (review 109: không thử tải lại ở mỗi câu hỏi)", () => {
  it("chưa lỗi lần nào ⇒ được thử", () => {
    expect(canRetryDownload(null, 1000)).toBe(true);
  });
  it("trong thời gian chờ sau lỗi ⇒ không; hết thời gian chờ ⇒ được", () => {
    expect(canRetryDownload(0, RETRY_COOLDOWN_MS - 1)).toBe(false);
    expect(canRetryDownload(0, RETRY_COOLDOWN_MS)).toBe(true);
  });
});
