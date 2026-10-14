import { describe, it, expect } from "vitest";
import {
  serializeCheckpoint,
  parseCheckpoint,
  CHECKPOINT_VERSION,
  type MeetingCheckpoint,
} from "../../src/main/services/meeting-capture/checkpoint";
import {
  initialLanguageState,
  languagePolicy,
} from "../../src/main/services/meeting-capture/language-policy";

// 186 PR C1 (R12) — checkpoint `session.json` mỗi 30 s + khi đóng phân đoạn. THUẦN; tệp trên đĩa là dữ liệu KHÔNG tin cậy:
// hỏng / thiếu trường / phiên bản lạ ⇒ null, không ném.

const sample = (): MeetingCheckpoint => ({
  version: CHECKPOINT_VERSION,
  sessionId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  sourceId: "src-1",
  phase: "paused",
  endedByUser: false,
  segments: [
    { index: 0, file: "seg-0000.wav", samples: 4_800_000, closed: true },
    { index: 1, file: "seg-0001.wav", samples: 160_000, closed: false },
  ],
  pauseGaps: [{ atSec: 300, wallSeconds: 42, reason: "user" }],
  language: languagePolicy(initialLanguageState("auto"), {
    type: "detected",
    lang: "vi",
    confidence: 0.95,
    atSec: 31,
  }),
  markers: [
    { id: "m1", kind: "decision", tStart: 12, tEnd: 12 },
    { id: "m2", kind: "actionItem", tStart: 40, tEnd: 55 },
  ],
  draftOffset: 2048,
  savedAt: 1_791_000_000_000,
});

describe("checkpoint — khứ hồi", () => {
  it("serialize ⇒ parse ra đúng đủ trường", () => {
    const c = sample();
    expect(parseCheckpoint(serializeCheckpoint(c))).toEqual(c);
  });

  it("phiên khoá tay, không phân đoạn/đánh dấu/khoảng ngừng", () => {
    const c: MeetingCheckpoint = {
      ...sample(),
      phase: "recording",
      endedByUser: true,
      segments: [],
      pauseGaps: [],
      markers: [],
      language: initialLanguageState("en"),
      draftOffset: 0,
    };
    expect(parseCheckpoint(serializeCheckpoint(c))).toEqual(c);
  });
});

describe("checkpoint — dữ liệu không tin cậy ⇒ null", () => {
  const good = (): Record<string, unknown> =>
    JSON.parse(serializeCheckpoint(sample())) as Record<string, unknown>;
  const withField = (k: string, v: unknown): string =>
    JSON.stringify({ ...good(), [k]: v });

  it.each([
    ["JSON hỏng", "{not json"],
    ["rỗng", ""],
    ["không phải object", "[1,2]"],
    ["phiên bản lạ", withField("version", 99)],
    ["thiếu sessionId", withField("sessionId", undefined)],
    ["phase lạ", withField("phase", "exploded")],
    ["endedByUser không phải boolean", withField("endedByUser", "yes")],
    ["segments không phải mảng", withField("segments", {})],
    [
      "phân đoạn sai kiểu",
      withField("segments", [
        { index: "0", file: "x", samples: 1, closed: true },
      ]),
    ],
    [
      "tên tệp phân đoạn lạ (chặn path traversal)",
      withField("segments", [
        { index: 0, file: "../../etc/passwd", samples: 1, closed: true },
      ]),
    ],
    [
      "khoảng ngừng lý do lạ",
      withField("pauseGaps", [{ atSec: 1, wallSeconds: 1, reason: "x" }]),
    ],
    [
      "đánh dấu loại lạ",
      withField("markers", [{ id: "m", kind: "todo", tStart: 1, tEnd: 1 }]),
    ],
    [
      "đánh dấu tEnd < tStart",
      withField("markers", [{ id: "m", kind: "question", tStart: 5, tEnd: 1 }]),
    ],
    ["draftOffset âm", withField("draftOffset", -1)],
    ["language thiếu", withField("language", null)],
    [
      "language mode lạ",
      withField("language", { ...sample().language, mode: "fr" }),
    ],
  ])("%s", (_n, raw) => {
    expect(parseCheckpoint(raw)).toBeNull();
  });
});
