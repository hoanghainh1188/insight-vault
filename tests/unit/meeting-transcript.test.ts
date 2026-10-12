import { describe, it, expect } from "vitest";
import { buildMeetingTranscript } from "../../src/main/services/meeting-capture/meeting-transcript";
import { cleanText } from "../../src/main/services/ingestion/cleaning";
import { timeForCharRange } from "../../src/main/services/ingestion/audio/audio-transcript";

// 186 — transcript cuộc họp (R8, D2, D3): văn bản lập chỉ mục + span mức segment, thời gian audio tuyệt đối.

const s = (text: string, tStart: number, tEnd: number) => ({
  text,
  tStart,
  tEnd,
});

describe("buildMeetingTranscript", () => {
  it("nối segment bằng \\n, trim + gộp khoảng trắng; span khớp đúng ký tự", () => {
    const t = buildMeetingTranscript([
      s("  Xin   chào ", 0, 2),
      s("mọi người.", 2, 4),
    ]);
    expect(t.text).toBe("Xin chào\nmọi người.");
    expect(t.spans).toEqual([
      { charStart: 0, charEnd: 8, tStart: 0, tEnd: 2 },
      { charStart: 9, charEnd: 19, tStart: 2, tEnd: 4 },
    ]);
    for (const sp of t.spans) {
      expect(t.text.slice(sp.charStart, sp.charEnd)).not.toMatch(/^\s|\s$/);
    }
  });

  it("bỏ segment rỗng / chỉ khoảng trắng", () => {
    const t = buildMeetingTranscript([
      s("a", 0, 1),
      s("   ", 1, 2),
      s("b", 2, 3),
    ]);
    expect(t.text).toBe("a\nb");
    expect(t.spans).toHaveLength(2);
  });

  it("sắp theo tStart dù đầu vào lộn xộn", () => {
    const t = buildMeetingTranscript([s("sau", 10, 12), s("trước", 1, 2)]);
    expect(t.text).toBe("trước\nsau");
  });

  it("bất biến: cleanText(text) === text ⇒ offset locator không lệch", () => {
    const t = buildMeetingTranscript([
      s("Dòng\tmột có tab", 0, 1),
      s("dòng hai  ", 1, 2),
      s("\n\nba\r\n", 2, 3),
    ]);
    expect(cleanText(t.text)).toBe(t.text);
  });

  it("timeMap dùng được với timeForCharRange (thời gian audio tuyệt đối)", () => {
    const t = buildMeetingTranscript([
      s("một", 600, 602),
      s("hai", 602, 605),
      s("ba", 605, 607),
    ]);
    const start = t.text.indexOf("hai");
    expect(timeForCharRange(t.timeMap, start, t.text.length)).toEqual({
      tStart: 602,
      tEnd: 607,
    });
  });

  it("không có segment ⇒ văn bản rỗng", () => {
    expect(buildMeetingTranscript([])).toEqual({
      text: "",
      spans: [],
      timeMap: [],
    });
  });
});
