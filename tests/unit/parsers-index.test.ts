import { describe, it, expect } from "vitest";
import {
  detectKindFromPath,
  titleFromPath,
} from "../../src/main/services/ingestion/parsers/index";
import { parseText } from "../../src/main/services/ingestion/parsers/text";

describe("parsers/index", () => {
  it("detectKindFromPath theo đuôi tệp", () => {
    expect(detectKindFromPath("/a/tai-lieu.pdf")).toBe("pdf");
    expect(detectKindFromPath("b.DOCX")).toBe("docx");
    expect(detectKindFromPath("c.txt")).toBe("txt");
    expect(detectKindFromPath("d.md")).toBe("md");
    expect(detectKindFromPath("e.markdown")).toBe("md");
    // 045: audio; 051: m4a/aac
    expect(detectKindFromPath("r.mp3")).toBe("audio");
    expect(detectKindFromPath("s.WAV")).toBe("audio");
    expect(detectKindFromPath("t.flac")).toBe("audio");
    expect(detectKindFromPath("u.m4a")).toBe("audio");
    expect(detectKindFromPath("w.AAC")).toBe("audio");
    // 051: video
    expect(detectKindFromPath("v.mp4")).toBe("video");
    expect(detectKindFromPath("v.MOV")).toBe("video");
    expect(detectKindFromPath("v.webm")).toBe("video");
    expect(detectKindFromPath("v.mkv")).toBe("video");
    // 053: image
    expect(detectKindFromPath("i.png")).toBe("image");
    expect(detectKindFromPath("i.JPG")).toBe("image");
    expect(detectKindFromPath("i.jpeg")).toBe("image");
    expect(detectKindFromPath("i.webp")).toBe("image");
    expect(detectKindFromPath("i.bmp")).toBe("image");
    expect(detectKindFromPath("i.tiff")).toBe("image");
  });

  it("đuôi không hỗ trợ → ném", () => {
    expect(() => detectKindFromPath("x.heic")).toThrow(/không hỗ trợ/); // heic ngoài phạm vi
    expect(() => detectKindFromPath("y.avi")).toThrow(/không hỗ trợ/); // avi chưa hỗ trợ
    expect(() => detectKindFromPath("noext")).toThrow();
  });

  it("titleFromPath lấy basename", () => {
    expect(titleFromPath("/home/user/Báo cáo.pdf")).toBe("Báo cáo.pdf");
    expect(titleFromPath("C:\\docs\\a.docx")).toBe("a.docx");
  });
});

describe("parsers/text", () => {
  it("parseText → 1 trang page=null giữ nguyên nội dung", () => {
    const r = parseText("noi dung txt");
    expect(r.pageCount).toBeNull();
    expect(r.pages).toEqual([{ page: null, text: "noi dung txt" }]);
  });
});
