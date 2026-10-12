import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
  parseWorkerMessage,
  parseMainMessage,
  isInsideDir,
} from "../../src/main/services/meeting-capture/asr-protocol";

// 186 — giao thức main ↔ asr-worker (R5). Kiểm mọi tin như dữ liệu không tin cậy; hàm thuần.

const ROOT = join("/data", "meetings");
const SEG = join(ROOT, "s1", "seg-0001.wav");
const PREV = join(ROOT, "s1", "seg-0000.wav");

describe("isInsideDir", () => {
  it("chỉ nhận đường dẫn nằm TRONG thư mục gốc", () => {
    expect(isInsideDir(ROOT, SEG)).toBe(true);
    expect(isInsideDir(ROOT, ROOT)).toBe(false);
    expect(isInsideDir(ROOT, join(ROOT, "..", "secret.wav"))).toBe(false);
    expect(isInsideDir(ROOT, "/data/meetings-other/x.wav")).toBe(false);
    expect(isInsideDir(ROOT, "relative/seg.wav")).toBe(false);
  });
});

describe("parseMainMessage (worker nhận)", () => {
  it("init hợp lệ", () => {
    const m = {
      type: "init",
      cacheDir: "/data/models",
      finalModel: "Xenova/whisper-base",
      fake: false,
    };
    expect(parseMainMessage(m, ROOT)).toEqual(m);
  });

  it("final hợp lệ (có / không phân đoạn trước)", () => {
    const m = {
      type: "final",
      reqId: "r1",
      segmentPath: SEG,
      prevSegmentPath: PREV,
      overlapSec: 5,
      language: "vi",
    };
    expect(parseMainMessage(m, ROOT)).toEqual(m);
    const first = {
      type: "final",
      reqId: "r0",
      segmentPath: SEG,
      overlapSec: 0,
      language: null,
    };
    expect(parseMainMessage(first, ROOT)).toEqual(first);
  });

  it("cancel hợp lệ", () => {
    expect(parseMainMessage({ type: "cancel", reqId: "r1" }, ROOT)).toEqual({
      type: "cancel",
      reqId: "r1",
    });
  });

  it.each([
    ["không phải object", "final"],
    ["loại lạ", { type: "rm", reqId: "x" }],
    [
      "thiếu reqId",
      { type: "final", segmentPath: SEG, overlapSec: 0, language: null },
    ],
    ["reqId không phải chuỗi", { type: "cancel", reqId: 1 }],
    [
      "đường dẫn ngoài meetings/",
      {
        type: "final",
        reqId: "r",
        segmentPath: "/etc/passwd",
        overlapSec: 0,
        language: null,
      },
    ],
    [
      "prevSegmentPath ngoài meetings/",
      {
        type: "final",
        reqId: "r",
        segmentPath: SEG,
        prevSegmentPath: "/tmp/x.wav",
        overlapSec: 5,
        language: null,
      },
    ],
    [
      "overlap âm",
      {
        type: "final",
        reqId: "r",
        segmentPath: SEG,
        overlapSec: -1,
        language: null,
      },
    ],
    [
      "ngôn ngữ lạ",
      {
        type: "final",
        reqId: "r",
        segmentPath: SEG,
        overlapSec: 0,
        language: "fr",
      },
    ],
    ["init thiếu cacheDir", { type: "init", finalModel: "m", fake: false }],
  ])("%s ⇒ null", (_n, m) => {
    expect(parseMainMessage(m, ROOT)).toBeNull();
  });
});

describe("parseWorkerMessage (main nhận)", () => {
  it("ready / progress / modelDownload / error hợp lệ", () => {
    expect(parseWorkerMessage({ type: "ready" })).toEqual({ type: "ready" });
    expect(
      parseWorkerMessage({ type: "progress", reqId: "r", frac: 0.5 }),
    ).toEqual({
      type: "progress",
      reqId: "r",
      frac: 0.5,
    });
    expect(parseWorkerMessage({ type: "modelDownload", active: true })).toEqual(
      {
        type: "modelDownload",
        active: true,
      },
    );
    expect(
      parseWorkerMessage({ type: "error", reqId: "r", code: "modelMissing" }),
    ).toEqual({
      type: "error",
      reqId: "r",
      code: "modelMissing",
    });
  });

  it("result hợp lệ — segment kiểm từng trường", () => {
    const m = {
      type: "result",
      reqId: "r",
      segments: [{ text: "xin chào", tStart: 0, tEnd: 1.5 }],
    };
    expect(parseWorkerMessage(m)).toEqual(m);
  });

  it.each([
    ["progress ngoài 0..1", { type: "progress", reqId: "r", frac: 2 }],
    ["mã lỗi lạ", { type: "error", reqId: "r", code: "boom" }],
    ["segments không phải mảng", { type: "result", reqId: "r", segments: "x" }],
    [
      "segment thiếu text",
      { type: "result", reqId: "r", segments: [{ tStart: 0, tEnd: 1 }] },
    ],
    [
      "tEnd < tStart",
      {
        type: "result",
        reqId: "r",
        segments: [{ text: "a", tStart: 2, tEnd: 1 }],
      },
    ],
    [
      "thời gian NaN",
      {
        type: "result",
        reqId: "r",
        segments: [{ text: "a", tStart: Number.NaN, tEnd: 1 }],
      },
    ],
    ["null", null],
  ])("%s ⇒ null", (_n, m) => {
    expect(parseWorkerMessage(m)).toBeNull();
  });
});

describe("phát hiện ngôn ngữ (ADR spike S2)", () => {
  it("detect hợp lệ; đường dẫn ngoài meetings/ ⇒ null", () => {
    const m = { type: "detect", reqId: "d1", segmentPath: SEG };
    expect(parseMainMessage(m, ROOT)).toEqual(m);
    expect(
      parseMainMessage({ ...m, segmentPath: "/etc/passwd" }, ROOT),
    ).toBeNull();
    expect(parseMainMessage({ type: "detect", segmentPath: SEG }, ROOT)).toBe(
      null,
    );
  });

  it("language hợp lệ (vi/en, độ tin cậy 0..1)", () => {
    const m = {
      type: "language",
      reqId: "d1",
      language: "en",
      confidence: 0.9,
    };
    expect(parseWorkerMessage(m)).toEqual(m);
  });

  it.each([
    [
      "ngôn ngữ lạ",
      { type: "language", reqId: "d", language: "fr", confidence: 1 },
    ],
    ["null", { type: "language", reqId: "d", language: null, confidence: 1 }],
    [
      "tin cậy > 1",
      { type: "language", reqId: "d", language: "vi", confidence: 2 },
    ],
    ["thiếu reqId", { type: "language", language: "vi", confidence: 1 }],
  ])("language %s ⇒ null", (_n, m) => {
    expect(parseWorkerMessage(m)).toBeNull();
  });
});
