import { describe, it, expect } from "vitest";
import {
  ffmpegBinaryName,
  resolveFfmpegPathFrom,
} from "../../src/main/services/ingestion/video/ffmpeg-path";

describe("resolveFfmpegPathFrom (051)", () => {
  const base = {
    resourcesPath: "/App/Contents/Resources",
    projectRoot: "/proj",
  };

  it("dev (không đóng gói) → build/ffmpeg trong repo", () => {
    expect(
      resolveFfmpegPathFrom({ ...base, isPackaged: false, platform: "darwin" }),
    ).toBe("/proj/build/ffmpeg/ffmpeg");
  });

  it("đóng gói → <Resources>/ffmpeg/", () => {
    expect(
      resolveFfmpegPathFrom({ ...base, isPackaged: true, platform: "darwin" }),
    ).toBe("/App/Contents/Resources/ffmpeg/ffmpeg");
  });

  it("Windows → thêm .exe", () => {
    expect(ffmpegBinaryName("win32")).toBe("ffmpeg.exe");
    expect(ffmpegBinaryName("linux")).toBe("ffmpeg");
  });
});
