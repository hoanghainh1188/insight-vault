import { describe, it, expect } from "vitest";
import {
  SIZE_LIMITS,
  SizeLimitError,
  assertWithinLimit,
  isWithinLimit,
} from "../../src/main/services/ingestion/size-limits";

const MB = 1024 * 1024;

describe("size-limits", () => {
  it("giới hạn theo loại: PDF/docx 50MB, txt/md 25MB, url 10MB", () => {
    expect(SIZE_LIMITS.pdf).toBe(50 * MB);
    expect(SIZE_LIMITS.docx).toBe(50 * MB);
    expect(SIZE_LIMITS.txt).toBe(25 * MB);
    expect(SIZE_LIMITS.md).toBe(25 * MB);
    expect(SIZE_LIMITS.url).toBe(10 * MB);
  });

  it("045/051 media: audio (gồm m4a/aac) 200MB, video 1GB", () => {
    expect(SIZE_LIMITS.audio).toBe(200 * MB);
    expect(SIZE_LIMITS.video).toBe(1024 * MB);
    expect(isWithinLimit("video", 1024 * MB)).toBe(true);
    expect(isWithinLimit("video", 1024 * MB + 1)).toBe(false);
    expect(isWithinLimit("audio", 200 * MB + 1)).toBe(false);
  });

  it("053 image: 50MB", () => {
    expect(SIZE_LIMITS.image).toBe(50 * MB);
    expect(isWithinLimit("image", 50 * MB)).toBe(true);
    expect(isWithinLimit("image", 50 * MB + 1)).toBe(false);
  });

  it("trong giới hạn → không ném; vượt → ném SizeLimitError với nhãn 'Tệp quá lớn'", () => {
    expect(() => assertWithinLimit("txt", 10 * MB)).not.toThrow();
    expect(isWithinLimit("txt", 10 * MB)).toBe(true);
    try {
      assertWithinLimit("txt", 26 * MB);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(SizeLimitError);
      expect((e as SizeLimitError).label).toBe("Tệp quá lớn");
    }
    expect(isWithinLimit("txt", 26 * MB)).toBe(false);
  });

  it("đúng biên (= giới hạn) là hợp lệ", () => {
    expect(isWithinLimit("pdf", 50 * MB)).toBe(true);
    expect(isWithinLimit("pdf", 50 * MB + 1)).toBe(false);
  });
});
