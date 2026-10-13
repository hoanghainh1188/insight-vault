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
      fallbackModel: "Xenova/whisper-tiny",
      fake: false,
    };
    expect(parseMainMessage(m, ROOT)).toEqual(m);
    expect(parseMainMessage({ ...m, fallbackModel: "" }, ROOT)).toBeNull();
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

describe("nháp khi đang ghi (PR B)", () => {
  const pcm = (bytes: number): ArrayBuffer => new ArrayBuffer(bytes);

  it("draft hợp lệ: PCM ArrayBuffer chẵn byte, ≤ 30 s; ngôn ngữ vi/en/perWindow; tier", () => {
    const m = {
      type: "draft",
      reqId: "d1",
      pcm: pcm(320_000),
      language: "perWindow",
      tier: "primary",
    };
    expect(parseMainMessage(m, ROOT)).toEqual(m);
    expect(
      parseMainMessage({ ...m, language: "vi", tier: "fallback" }, ROOT),
    ).toMatchObject({ language: "vi", tier: "fallback" });
  });

  it("draft sai ⇒ null (PCM lẻ byte / rỗng / quá 30 s / không phải ArrayBuffer / ngôn ngữ, tier lạ)", () => {
    const ok = {
      type: "draft",
      reqId: "d1",
      pcm: pcm(32_000),
      language: "vi",
      tier: "primary",
    };
    for (const bad of [
      { ...ok, pcm: pcm(31_999) },
      { ...ok, pcm: pcm(0) },
      { ...ok, pcm: pcm(30 * 16_000 * 2 + 2) },
      { ...ok, pcm: new Uint8Array(32_000) },
      { ...ok, pcm: "AAAA" },
      { ...ok, language: null },
      { ...ok, language: "fr" },
      { ...ok, tier: "huge" },
      { ...ok, reqId: "" },
    ]) {
      expect(parseMainMessage(bad, ROOT)).toBeNull();
    }
  });

  it("detectPcm hợp lệ / sai", () => {
    const m = { type: "detectPcm", reqId: "x", pcm: pcm(960_000) };
    expect(parseMainMessage(m, ROOT)).toEqual(m);
    expect(parseMainMessage({ ...m, pcm: pcm(3) }, ROOT)).toBeNull();
  });

  it("final chấp nhận language = perWindow (chế độ Đa ngôn ngữ)", () => {
    expect(
      parseMainMessage(
        {
          type: "final",
          reqId: "f",
          segmentPath: SEG,
          overlapSec: 0,
          language: "perWindow",
        },
        ROOT,
      ),
    ).toMatchObject({ language: "perWindow" });
  });

  it("draftResult hợp lệ; ngôn ngữ/độ tin cậy/thời gian sai ⇒ null", () => {
    const m = {
      type: "draftResult",
      reqId: "d1",
      segments: [{ text: "xin chào", tStart: 0, tEnd: 2 }],
      language: "vi",
      confidence: 0.9,
      elapsedMs: 400,
    };
    expect(parseWorkerMessage(m)).toEqual(m);
    expect(
      parseWorkerMessage({ ...m, language: null, confidence: undefined }),
    ).toEqual({ ...m, language: null, confidence: undefined });
    for (const bad of [
      { ...m, language: "fr" },
      { ...m, confidence: 2 },
      { ...m, elapsedMs: -1 },
      { ...m, elapsedMs: Number.NaN },
      { ...m, segments: [{ text: 1, tStart: 0, tEnd: 1 }] },
    ]) {
      expect(parseWorkerMessage(bad)).toBeNull();
    }
  });
});

describe("nạp model theo yêu cầu (PR B review)", () => {
  it("load hợp lệ / tier lạ ⇒ null; loaded hợp lệ", () => {
    expect(
      parseMainMessage({ type: "load", reqId: "l1", tier: "fallback" }, ROOT),
    ).toEqual({ type: "load", reqId: "l1", tier: "fallback" });
    expect(
      parseMainMessage({ type: "load", reqId: "l1", tier: "x" }, ROOT),
    ).toBeNull();
    expect(parseWorkerMessage({ type: "loaded", reqId: "l1" })).toEqual({
      type: "loaded",
      reqId: "l1",
    });
    expect(parseWorkerMessage({ type: "loaded" })).toBeNull();
  });
});
