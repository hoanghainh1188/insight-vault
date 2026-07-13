import { describe, it, expect } from "vitest";
import {
  buildImageTranscript,
  bboxForCharRange,
  type OcrLine,
} from "../../src/main/services/ingestion/image/image-transcript";

const line = (
  text: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): OcrLine => ({
  text,
  bbox: { x0, y0, x1, y1 },
});

describe("buildImageTranscript (053)", () => {
  it("ghép dòng + chuẩn hoá bbox 0..1 theo imgW/imgH", () => {
    const { text, boxMap } = buildImageTranscript(
      [line("Xin chào", 10, 20, 110, 60), line("thế giới", 10, 80, 90, 120)],
      200,
      200,
    );
    expect(text).toBe("Xin chào thế giới");
    expect(boxMap).toHaveLength(2);
    expect(boxMap[0].charStart).toBe(0);
    expect(boxMap[0].charEnd).toBe(8); // "Xin chào"
    expect(boxMap[0].bbox).toEqual({ x: 0.05, y: 0.1, w: 0.5, h: 0.2 });
    expect(boxMap[1].charStart).toBe(9); // sau khoảng trắng ghép
  });

  it("bỏ dòng rỗng; chuẩn hoá whitespace nội bộ", () => {
    const { text, boxMap } = buildImageTranscript(
      [line("  a   b ", 0, 0, 50, 10), line("   ", 0, 0, 1, 1)],
      100,
      100,
    );
    expect(text).toBe("a b");
    expect(boxMap).toHaveLength(1);
  });

  it("imgW/imgH = 0 → không chia 0 (fallback 1)", () => {
    const { boxMap } = buildImageTranscript([line("x", 0, 0, 10, 10)], 0, 0);
    expect(boxMap[0].bbox.w).toBeLessThanOrEqual(1);
  });

  it("bbox pixel vượt biên ảnh → kẹp 0..1 (clamp)", () => {
    // OCR trả toạ độ lệch: x1 > imgW, y0 < 0.
    const { boxMap } = buildImageTranscript(
      [line("x", -20, -10, 250, 260)],
      200,
      200,
    );
    const b = boxMap[0].bbox;
    expect(b.x).toBe(0); // -20/200 kẹp về 0
    expect(b.y).toBe(0);
    expect(b.w).toBeLessThanOrEqual(1);
    expect(b.h).toBeLessThanOrEqual(1);
  });
});

describe("bboxForCharRange (053)", () => {
  const { boxMap } = buildImageTranscript(
    [line("dòng một", 0, 0, 100, 20), line("dòng hai", 0, 40, 80, 60)],
    100,
    100,
  );

  it("range trong 1 dòng → bbox dòng đó", () => {
    const bb = bboxForCharRange(boxMap, 0, 3);
    expect(bb).not.toBeNull();
    expect(bb!.y).toBeCloseTo(0);
  });

  it("range trải 2 dòng → HỢP (khối bao cả hai)", () => {
    const bb = bboxForCharRange(boxMap, 0, boxMap[1].charEnd);
    expect(bb).not.toBeNull();
    expect(bb!.y).toBeCloseTo(0); // top của dòng đầu
    expect(bb!.h).toBeCloseTo(0.6); // tới đáy dòng 2 (y=0.4+h=0.2)
    expect(bb!.w).toBeCloseTo(1); // rộng nhất = dòng 1 (100/100)
  });

  it("range không giao dòng nào → null", () => {
    expect(bboxForCharRange(boxMap, 999, 1000)).toBeNull();
  });
});
