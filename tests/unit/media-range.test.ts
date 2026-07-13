import { describe, it, expect } from "vitest";
import {
  extOf,
  mimeForAudioExt,
  parseRange,
} from "../../src/main/services/source-viewer/media-range";

describe("extOf (049)", () => {
  it("lấy đuôi chữ thường", () => {
    expect(extOf("/a/b/c.MP3")).toBe("mp3");
    expect(extOf("song.flac")).toBe("flac");
  });
  it("không có đuôi / dấu chấm cuối → rỗng", () => {
    expect(extOf("/a/b/noext")).toBe("");
    expect(extOf("trailing.")).toBe("");
  });
  it("chỉ lấy đuôi cuối khi nhiều dấu chấm", () => {
    expect(extOf("my.file.name.ogg")).toBe("ogg");
  });
});

describe("mimeForAudioExt (049)", () => {
  it("map đúng các định dạng hỗ trợ", () => {
    expect(mimeForAudioExt("mp3")).toBe("audio/mpeg");
    expect(mimeForAudioExt("wav")).toBe("audio/wav");
    expect(mimeForAudioExt("flac")).toBe("audio/flac");
    expect(mimeForAudioExt("ogg")).toBe("audio/ogg");
  });
  it("không phân biệt hoa thường", () => {
    expect(mimeForAudioExt("WAV")).toBe("audio/wav");
  });
  it("đuôi lạ → mặc định audio/mpeg", () => {
    expect(mimeForAudioExt("xyz")).toBe("audio/mpeg");
    expect(mimeForAudioExt("")).toBe("audio/mpeg");
  });
  it("051: m4a/aac audio container", () => {
    expect(mimeForAudioExt("m4a")).toBe("audio/mp4");
    expect(mimeForAudioExt("aac")).toBe("audio/aac");
  });
  it("051: video mp4/mov/webm/mkv", () => {
    expect(mimeForAudioExt("mp4")).toBe("video/mp4");
    expect(mimeForAudioExt("MOV")).toBe("video/quicktime");
    expect(mimeForAudioExt("webm")).toBe("video/webm");
    expect(mimeForAudioExt("mkv")).toBe("video/x-matroska");
  });
  it("053: image png/jpg/jpeg/webp/bmp/tiff", () => {
    expect(mimeForAudioExt("png")).toBe("image/png");
    expect(mimeForAudioExt("JPG")).toBe("image/jpeg");
    expect(mimeForAudioExt("jpeg")).toBe("image/jpeg");
    expect(mimeForAudioExt("webp")).toBe("image/webp");
    expect(mimeForAudioExt("bmp")).toBe("image/bmp");
    expect(mimeForAudioExt("tiff")).toBe("image/tiff");
  });
});

describe("parseRange (049)", () => {
  const SIZE = 1000;

  it("header null → null", () => {
    expect(parseRange(null, SIZE)).toBeNull();
  });
  it("size <= 0 → null", () => {
    expect(parseRange("bytes=0-99", 0)).toBeNull();
  });
  it("header không hợp lệ → null", () => {
    expect(parseRange("chunks=0-1", SIZE)).toBeNull();
    expect(parseRange("bytes=-", SIZE)).toBeNull();
  });
  it("bytes=start-end đầy đủ", () => {
    expect(parseRange("bytes=100-199", SIZE)).toEqual({ start: 100, end: 199 });
  });
  it("bytes=start- → tới hết file", () => {
    expect(parseRange("bytes=200-", SIZE)).toEqual({ start: 200, end: 999 });
  });
  it("suffix bytes=-N → N byte cuối", () => {
    expect(parseRange("bytes=-150", SIZE)).toEqual({ start: 850, end: 999 });
  });
  it("suffix vượt size → kẹp về 0", () => {
    expect(parseRange("bytes=-5000", SIZE)).toEqual({ start: 0, end: 999 });
  });
  it("end vượt size → kẹp về size-1", () => {
    expect(parseRange("bytes=900-5000", SIZE)).toEqual({
      start: 900,
      end: 999,
    });
  });
  it("start >= size → null", () => {
    expect(parseRange("bytes=1000-1100", SIZE)).toBeNull();
    expect(parseRange("bytes=2000-", SIZE)).toBeNull();
  });
  it("start > end → null", () => {
    expect(parseRange("bytes=300-200", SIZE)).toBeNull();
  });
});
