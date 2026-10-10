import { describe, it, expect } from "vitest";
import {
  applyStreamToken,
  STUDIO_STREAM_TEXT_MAX,
} from "../../src/renderer/features/studio/studio-stream";

// 178 (PR 4, security L2): chữ tạm có trần — mô hình sinh vô hạn không làm phình buffer renderer.

describe("applyStreamToken — trần chữ tạm", () => {
  it("không vượt STUDIO_STREAM_TEXT_MAX; tới trần ⇒ trả nguyên map (không cấp phát mới)", () => {
    const active = { summary: "g1" };
    const big = "x".repeat(STUDIO_STREAM_TEXT_MAX - 3);
    const m1 = applyStreamToken({ summary: big }, active, {
      generationId: "g1",
      delta: "abcdef",
    });
    expect(m1.summary).toHaveLength(STUDIO_STREAM_TEXT_MAX);
    const m2 = applyStreamToken(m1, active, { generationId: "g1", delta: "z" });
    expect(m2).toBe(m1);
  });

  it("dưới trần ⇒ nối bình thường", () => {
    expect(
      applyStreamToken({}, { faq: "g" }, { generationId: "g", delta: "ab" }),
    ).toEqual({ faq: "ab" });
  });
});
