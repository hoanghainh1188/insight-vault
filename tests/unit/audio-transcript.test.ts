import { describe, it, expect } from "vitest";
import {
  buildTranscript,
  timeForCharRange,
  type Segment,
} from "../../src/main/services/ingestion/audio/audio-transcript";

describe("buildTranscript (045)", () => {
  it("ghép segment bằng 1 space + map char↔time; bỏ segment rỗng", () => {
    const segs: Segment[] = [
      { text: " Xin chào", tStart: 0, tEnd: 1.2 },
      { text: "  ", tStart: 1.2, tEnd: 1.3 }, // rỗng → bỏ
      { text: "thế giới ", tStart: 1.3, tEnd: 2.5 },
    ];
    const { text, timeMap } = buildTranscript(segs);
    expect(text).toBe("Xin chào thế giới");
    expect(timeMap).toHaveLength(2);
    expect(timeMap[0]).toEqual({
      charStart: 0,
      charEnd: 8,
      tStart: 0,
      tEnd: 1.2,
    });
    // segment 2 bắt đầu sau " " (char 9)
    expect(timeMap[1].charStart).toBe(9);
    expect(text.slice(timeMap[1].charStart, timeMap[1].charEnd)).toBe(
      "thế giới",
    );
  });

  it("chuẩn hoá khoảng trắng nội bộ (khớp cleanText → offset bảo toàn)", () => {
    const { text } = buildTranscript([
      { text: "a\n\tb   c", tStart: 0, tEnd: 1 },
    ]);
    expect(text).toBe("a b c");
  });
});

describe("timeForCharRange (045)", () => {
  const timeMap = [
    { charStart: 0, charEnd: 8, tStart: 0, tEnd: 1.2 },
    { charStart: 9, charEnd: 17, tStart: 1.3, tEnd: 2.5 },
  ];
  it("range phủ 2 segment → gộp tStart nhỏ nhất / tEnd lớn nhất", () => {
    expect(timeForCharRange(timeMap, 0, 17)).toEqual({ tStart: 0, tEnd: 2.5 });
  });
  it("range chỉ giao 1 segment", () => {
    expect(timeForCharRange(timeMap, 10, 15)).toEqual({
      tStart: 1.3,
      tEnd: 2.5,
    });
  });
  it("range không giao segment nào → null", () => {
    expect(timeForCharRange(timeMap, 8, 9)).toBeNull(); // khoảng trắng ghép
  });
});
