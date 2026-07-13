import { describe, it, expect } from "vitest";
import { parseImage } from "../../src/main/services/ingestion/parsers/image";
import type { Ocr } from "../../src/main/services/ingestion/image/ocr";
import type { OcrLine } from "../../src/main/services/ingestion/image/image-transcript";

const ocrOf = (lines: OcrLine[]): Ocr => ({ recognize: async () => lines });
const dims = async (): Promise<{ width: number; height: number }> => ({
  width: 100,
  height: 100,
});

describe("parseImage (053)", () => {
  it("ảnh có chữ → ParseResult text + boxMap", async () => {
    const ocr = ocrOf([
      { text: "hoá đơn", bbox: { x0: 0, y0: 0, x1: 50, y1: 20 } },
    ]);
    const res = await parseImage("a.png", ocr, dims);
    expect(res.pages).toHaveLength(1);
    expect(res.pages[0].text).toBe("hoá đơn");
    expect(res.boxMap && res.boxMap.length).toBe(1);
    expect(res.boxMap![0].bbox.w).toBeCloseTo(0.5);
  });

  it("ảnh KHÔNG chữ (ocr rỗng) → ParseResult rỗng (ready 0 chunk)", async () => {
    const res = await parseImage("b.png", ocrOf([]), dims);
    expect(res.pages).toEqual([]);
    expect(res.boxMap).toEqual([]);
  });
});
