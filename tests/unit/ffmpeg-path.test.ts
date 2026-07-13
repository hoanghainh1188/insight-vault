import { describe, it, expect } from "vitest";
import { resolveFfmpegPathFrom } from "../../src/main/services/ingestion/video/ffmpeg-path";

describe("resolveFfmpegPathFrom (051)", () => {
  it("dev (không đóng gói) → giữ nguyên path", () => {
    expect(
      resolveFfmpegPathFrom("/proj/node_modules/ffmpeg-static/ffmpeg", false),
    ).toBe("/proj/node_modules/ffmpeg-static/ffmpeg");
  });

  it("đóng gói → thay app.asar → app.asar.unpacked", () => {
    expect(
      resolveFfmpegPathFrom(
        "/App/Contents/Resources/app.asar/node_modules/ffmpeg-static/ffmpeg",
        true,
      ),
    ).toBe(
      "/App/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg",
    );
  });

  it("path null (nền tảng không hỗ trợ) → ném", () => {
    expect(() => resolveFfmpegPathFrom(null, false)).toThrow();
  });
});
