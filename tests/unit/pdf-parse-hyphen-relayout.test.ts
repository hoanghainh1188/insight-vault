import { describe, expect, it, vi } from "vitest";
import { cleanText } from "../../src/main/services/ingestion/cleaning";
import { parsePdf } from "../../src/main/services/ingestion/parsers/pdf";
import { makePdf } from "../fixtures/pdf/make-pdf";
import { hyphenCompounds } from "../fixtures/pdf/samples";

// 147 (a, FR-012, review): lượt DỰNG LẠI trang có ngắt gạch (bằng chứng cả tài liệu) mà rơi về cách nối cũ ⇒ giữ kết quả lượt đầu.

const { failRelayout } = vi.hoisted(() => ({ failRelayout: { on: false } }));

vi.mock(
  "../../src/main/services/ingestion/pdf-layout/layout-page",
  async (importOriginal) => {
    const real =
      await importOriginal<
        typeof import("../../src/main/services/ingestion/pdf-layout/layout-page")
      >();
    return {
      ...real,
      layoutPage: (...args: Parameters<typeof real.layoutPage>) => {
        // lượt dựng lại = gọi không kèm onLines
        if (failRelayout.on && !args[2]?.onLines)
          return { text: "legacy", blocks: [], fallback: true };
        return real.layoutPage(...args);
      },
    };
  },
);

describe("parsePdf — dựng lại trang có gạch nối", () => {
  it("bình thường: bằng chứng ở trang sau được dùng; văn bản ở dạng cố định của cleanText", async () => {
    failRelayout.on = false;
    const s = hyphenCompounds();
    const r = await parsePdf(makePdf(s.pages));
    expect(r.pages.map((p) => p.text)).toEqual(s.expected);
    for (const p of r.pages) expect(cleanText(p.text)).toBe(p.text);
  });

  it("dựng lại rơi về cách nối cũ ⇒ giữ kết quả lượt đầu (không đè bằng 'legacy')", async () => {
    failRelayout.on = true;
    const s = hyphenCompounds();
    const r = await parsePdf(makePdf(s.pages));
    expect(r.pages[0].text).toBe(
      s.expected[0].replace("well-known method", "wellknown method"),
    );
    expect(r.pages[1].text).toBe(s.expected[1]);
  });
});
