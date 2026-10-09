import { describe, it, expect } from "vitest";
import {
  cancelFocusTarget,
  isCurrentGeneration,
  outcomeOf,
} from "../../src/renderer/features/studio/studio-generation";
import type { ParsedIpcError } from "@shared/online-error-tag";

// 149 (research R5/R6): hàm thuần ở renderer — lượt hiện hành (theo generationId), phân loại kết cục, đích focus sau huỷ.

describe("isCurrentGeneration", () => {
  it("khớp id đang chạy của loại ⇒ true; khác id / loại không chạy ⇒ false", () => {
    const active = { summary: "g2", faq: "g9" };
    expect(isCurrentGeneration(active, "summary", "g2")).toBe(true);
    expect(isCurrentGeneration(active, "summary", "g1")).toBe(false);
    expect(isCurrentGeneration(active, "outline", "g2")).toBe(false);
    expect(isCurrentGeneration({}, "summary", "g2")).toBe(false);
  });
});

describe("outcomeOf", () => {
  const err = (over: Partial<ParsedIpcError>): ParsedIpcError => ({
    message: "x",
    onlineKind: null,
    ...over,
  });
  it("mã studioCancelled ⇒ cancelled; lỗi khác / lỗi online ⇒ failed", () => {
    expect(outcomeOf(err({ code: "studioCancelled" }))).toBe("cancelled");
    expect(outcomeOf(err({ code: "studioNoNotes" }))).toBe("failed");
    expect(outcomeOf(err({ onlineKind: "timeout" }))).toBe("failed");
    expect(outcomeOf(err({}))).toBe("failed");
  });
});

describe("cancelFocusTarget", () => {
  it("có kết quả cũ ⇒ 'regenerate'; không ⇒ 'kind'", () => {
    expect(cancelFocusTarget(true)).toBe("regenerate");
    expect(cancelFocusTarget(false)).toBe("kind");
  });
});
