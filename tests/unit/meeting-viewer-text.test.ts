import { describe, it, expect } from "vitest";
import {
  gapsBefore,
  plainTranscript,
  spanOfMatch,
  splitSpan,
} from "../../src/renderer/features/meeting-capture/viewer/viewer-text";

// 186 PR C2 — tô kết quả tìm theo câu, cuộn tới câu chứa kết quả, khoảng ngừng, văn bản sao chép có timestamp.

const TEXT = "Chào mọi người. Hôm nay chốt ngân sách.";
const SPANS = [
  { charStart: 0, charEnd: 15, tStart: 0, tEnd: 5 },
  { charStart: 16, charEnd: 39, tStart: 65, tEnd: 70 },
];

describe("splitSpan", () => {
  it("không có kết quả ⇒ một đoạn thường", () => {
    expect(splitSpan(TEXT, SPANS[0]!, [])).toEqual([
      { text: "Chào mọi người.", match: null },
    ]);
  });
  it("kết quả trong câu ⇒ đoạn trùng có chỉ số; kết quả câu khác bị bỏ", () => {
    expect(
      splitSpan(TEXT, SPANS[1]!, [
        { start: 5, end: 8 },
        { start: 29, end: 32 },
      ]),
    ).toEqual([
      { text: "Hôm nay chốt ", match: null },
      { text: "ngâ", match: 1 },
      { text: "n sách.", match: null },
    ]);
  });
});

describe("spanOfMatch / gapsBefore", () => {
  it("câu chứa kết quả", () => {
    expect(spanOfMatch(SPANS, { start: 20, end: 22 })).toBe(1);
    expect(spanOfMatch(SPANS, undefined)).toBe(-1);
  });
  it("khoảng ngừng nằm trước câu có tStart sau nó", () => {
    const gaps = [{ atSec: 30, wallSeconds: 60, reason: "user" as const }];
    expect(gapsBefore(SPANS, gaps, 0)).toEqual([]);
    expect(gapsBefore(SPANS, gaps, 1)).toEqual(gaps);
  });
});

describe("plainTranscript", () => {
  it("[hh:mm:ss] mỗi câu + dòng tạm dừng đúng chỗ (kể cả sau câu cuối)", () => {
    const gaps = [
      { atSec: 30, wallSeconds: 60, reason: "user" as const },
      { atSec: 99, wallSeconds: 5, reason: "deviceLost" as const },
    ];
    expect(plainTranscript(TEXT, SPANS, gaps, (g) => `— ${g.reason} —`)).toBe(
      [
        "[00:00:00] Chào mọi người.",
        "— user —",
        "[00:01:05] Hôm nay chốt ngân sách.",
        "— deviceLost —",
      ].join("\n"),
    );
  });
});
