import { describe, it, expect } from "vitest";
import {
  isValidGenerationId,
  STUDIO_PROGRESS_PHASES,
} from "../../src/shared/studio-progress";

// 146 (contract, data-model): generationId do renderer sinh — main chỉ phát tiến độ khi id hợp lệ `/^[A-Za-z0-9_-]{1,64}$/`.

describe("isValidGenerationId", () => {
  it("UUID / chuỗi chữ-số-gạch ≤ 64 ký tự ⇒ hợp lệ", () => {
    expect(isValidGenerationId("3f2b9c1e-8a4d-4f6b-9e2a-1c5d7e9f0a1b")).toBe(
      true,
    );
    expect(isValidGenerationId("a")).toBe(true);
    expect(isValidGenerationId("A_b-9".padEnd(64, "x"))).toBe(true);
  });

  it("rỗng / > 64 ký tự / ký tự lạ ⇒ không hợp lệ", () => {
    expect(isValidGenerationId("")).toBe(false);
    expect(isValidGenerationId("x".repeat(65))).toBe(false);
    expect(isValidGenerationId("abc def")).toBe(false);
    expect(isValidGenerationId("abc/../x")).toBe(false);
    expect(isValidGenerationId("phở")).toBe(false);
  });

  it("không phải chuỗi ⇒ không hợp lệ", () => {
    expect(isValidGenerationId(undefined)).toBe(false);
    expect(isValidGenerationId(null)).toBe(false);
    expect(isValidGenerationId(42)).toBe(false);
    expect(isValidGenerationId({ id: "a" })).toBe(false);
  });
});

describe("STUDIO_PROGRESS_PHASES", () => {
  it("thứ tự tăng dần reading → condensing → writing", () => {
    expect(STUDIO_PROGRESS_PHASES).toEqual([
      "reading",
      "condensing",
      "writing",
    ]);
  });
});
