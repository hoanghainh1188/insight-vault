import { describe, expect, it } from "vitest";
import { makePdf } from "../fixtures/pdf/make-pdf";

// 112: smoke test trình sinh PDF fixture — pdf.js mở được và trích đúng chuỗi (Latin + tiếng Việt, NFC + NFD).

async function itemsOf(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: bytes,
    useWorkerFetch: false,
    useSystemFonts: false,
  }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const c = await page.getTextContent();
    pages.push(
      c.items.flatMap((it) =>
        "str" in it ? [{ str: it.str, t: it.transform, w: it.width }] : [],
      ),
    );
  }
  await doc.cleanup();
  return pages;
}

describe("make-pdf (fixture)", () => {
  it("Latin: đúng chuỗi, toạ độ, số trang", async () => {
    const pdf = makePdf([
      {
        width: 600,
        height: 800,
        texts: [{ x: 50, y: 100, size: 12, text: "Hello world" }],
      },
      {
        width: 600,
        height: 800,
        texts: [{ x: 70, y: 200, size: 10, text: "Page two" }],
      },
    ]);
    const pages = await itemsOf(pdf);
    expect(pages).toHaveLength(2);
    expect(pages[0][0].str).toBe("Hello world");
    expect(pages[0][0].t[4]).toBeCloseTo(50, 3);
    expect(pages[0][0].t[5]).toBeCloseTo(700, 3);
    expect(pages[0][0].w).toBeCloseTo(11 * 0.5 * 12, 1);
    expect(pages[1][0].str).toBe("Page two");
  });

  it("tiếng Việt có dấu (NFC và NFD) trích nguyên chuỗi", async () => {
    const nfc = "Hợp đồng lao động — Điều 1";
    const nfd = "Hà Nội";
    const pages = await itemsOf(
      makePdf([
        {
          width: 600,
          height: 800,
          texts: [
            { x: 50, y: 100, size: 12, text: nfc },
            { x: 50, y: 130, size: 12, text: nfd },
          ],
        },
      ]),
    );
    expect(pages[0].map((i) => i.str)).toEqual([nfc, nfd]);
  });

  it("chữ xoay: transform có thành phần xoay", async () => {
    const pages = await itemsOf(
      makePdf([
        {
          width: 600,
          height: 800,
          texts: [{ x: 300, y: 400, size: 12, text: "Rotated", angle: 90 }],
        },
      ]),
    );
    expect(pages[0][0].str).toBe("Rotated");
    expect(Math.abs(pages[0][0].t[1])).toBeGreaterThan(1);
  });
});
