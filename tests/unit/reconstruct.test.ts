import { describe, it, expect } from "vitest";
import {
  reconstructText,
  derivePageBreaks,
} from "../../src/main/services/source-viewer/reconstruct";
import {
  chunkPages,
  joinPages,
  type PageText,
} from "../../src/main/services/ingestion/chunker";
import type { Chunk } from "@shared/ipc/types";

const lorem = (n: number): string =>
  Array.from({ length: n }, (_, i) => `cau so ${i} co noi dung day du.`).join(
    " ",
  );

// Tạo ChunkLike từ chunkPages thật (dữ liệu ingestion) để test tái dựng khớp gốc.
function chunksFrom(pages: PageText[]): Pick<Chunk, "text" | "locator">[] {
  return chunkPages(pages).map((d) => ({ text: d.text, locator: d.locator }));
}

describe("reconstructText — CRUX Constitution II / SC-002", () => {
  const cases: { name: string; pages: PageText[] }[] = [
    { name: "1 trang non-PDF dài", pages: [{ page: null, text: lorem(500) }] },
    {
      name: "PDF nhiều trang (fill gap)",
      pages: [
        { page: 1, text: lorem(200) },
        { page: 2, text: lorem(180) },
        { page: 3, text: lorem(60) },
      ],
    },
    { name: "1 chunk ngắn", pages: [{ page: 1, text: "abc xyz" }] },
  ];

  for (const { name, pages } of cases) {
    it(`tái dựng == văn bản gốc: ${name}`, () => {
      const chunks = chunksFrom(pages);
      const T = reconstructText(chunks);
      expect(T).toBe(joinPages(pages)); // KHỚP TUYỆT ĐỐI
    });

    it(`mọi chunk: T.slice(locator)===chunk.text: ${name}`, () => {
      const chunks = chunksFrom(pages);
      const T = reconstructText(chunks);
      for (const c of chunks) {
        expect(T.slice(c.locator.charStart, c.locator.charEnd)).toBe(c.text);
      }
    });
  }

  it("chunk không sắp thứ tự đầu vào vẫn tái dựng đúng", () => {
    const chunks = chunksFrom([{ page: null, text: lorem(300) }]);
    const shuffled = [...chunks].reverse();
    expect(reconstructText(shuffled)).toBe(reconstructText(chunks));
  });

  it("rỗng → ''", () => {
    expect(reconstructText([])).toBe("");
  });
});

describe("derivePageBreaks", () => {
  it("PDF: offset = min charStart mỗi trang, sắp theo offset", () => {
    const chunks = chunksFrom([
      { page: 1, text: lorem(200) },
      { page: 2, text: lorem(200) },
    ]);
    const pb = derivePageBreaks(chunks);
    expect(pb[0]).toEqual({ page: 1, offset: 0 });
    expect(pb.length).toBe(2);
    expect(pb[1].page).toBe(2);
    expect(pb[1].offset).toBeGreaterThan(0);
    // offset trang 2 = đầu trang 2 trong T
    const T = reconstructText(chunks);
    expect(T.slice(pb[1].offset, pb[1].offset + 3)).toBe(
      chunks.find((c) => c.locator.page === 2)!.text.slice(0, 3),
    );
  });

  it("non-PDF (page=null) → []", () => {
    const chunks = chunksFrom([{ page: null, text: lorem(100) }]);
    expect(derivePageBreaks(chunks)).toEqual([]);
  });
});
