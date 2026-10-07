import { describe, it, expect } from "vitest";
import {
  chunkPages,
  joinPages,
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  type PageText,
} from "../../src/main/services/ingestion/chunker";

const lorem = (n: number): string =>
  Array.from({ length: n }, (_, i) => `cau so ${i} co noi dung.`).join(" ");

describe("chunkPages", () => {
  it("văn bản ngắn (≤ size) → 1 chunk phủ toàn bộ, locator đúng", () => {
    const pages: PageText[] = [{ page: null, text: "xin chao the gioi" }];
    const chunks = chunkPages(pages);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].locator).toEqual({
      page: null,
      charStart: 0,
      charEnd: 17,
    });
    expect(chunks[0].text).toBe("xin chao the gioi");
  });

  it("mọi chunk có locator hợp lệ trong [0, len], charEnd>charStart (SC-002)", () => {
    const pages: PageText[] = [{ page: null, text: lorem(400) }];
    const full = joinPages(pages);
    const chunks = chunkPages(pages);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.locator.charEnd).toBeGreaterThan(c.locator.charStart);
      expect(c.locator.charStart).toBeGreaterThanOrEqual(0);
      expect(c.locator.charEnd).toBeLessThanOrEqual(full.length);
      // text khớp đúng đoạn locator trỏ tới
      expect(c.text).toBe(full.slice(c.locator.charStart, c.locator.charEnd));
    }
  });

  it("ordinal tăng dần liên tục từ 0", () => {
    const chunks = chunkPages([{ page: null, text: lorem(300) }]);
    chunks.forEach((c, i) => expect(c.ordinal).toBe(i));
  });

  it("union các chunk phủ hết văn bản (không sót ký tự)", () => {
    const pages: PageText[] = [{ page: null, text: lorem(500) }];
    const full = joinPages(pages);
    const chunks = chunkPages(pages);
    // ghép theo thứ tự, bỏ overlap: kiểm không có khoảng hở
    let covered = 0;
    for (const c of chunks) {
      expect(c.locator.charStart).toBeLessThanOrEqual(covered);
      covered = Math.max(covered, c.locator.charEnd);
    }
    expect(covered).toBe(full.length);
  });

  it("có overlap giữa 2 chunk liền kề khi văn bản dài", () => {
    const chunks = chunkPages([{ page: null, text: lorem(500) }]);
    expect(chunks[1].locator.charStart).toBeLessThan(chunks[0].locator.charEnd);
  });

  it("PDF nhiều trang: chunk KHÔNG vắt trang, page đơn trị đúng trang", () => {
    const pages: PageText[] = [
      { page: 1, text: lorem(200) },
      { page: 2, text: lorem(200) },
    ];
    const full = joinPages(pages);
    const chunks = chunkPages(pages);
    const p1 = chunks.filter((c) => c.locator.page === 1);
    const p2 = chunks.filter((c) => c.locator.page === 2);
    expect(p1.length).toBeGreaterThan(0);
    expect(p2.length).toBeGreaterThan(0);
    // mọi chunk vẫn khớp toàn văn bản (offset toàn cục đúng qua ranh giới trang)
    for (const c of chunks) {
      expect(c.text).toBe(full.slice(c.locator.charStart, c.locator.charEnd));
    }
    // trang 2 bắt đầu sau trang 1 + separator
    expect(p2[0].locator.charStart).toBeGreaterThanOrEqual(
      pages[0].text.length,
    );
  });

  it("hằng số mặc định hợp lý", () => {
    expect(CHUNK_SIZE).toBe(1000);
    expect(CHUNK_OVERLAP).toBe(150);
  });
});

// 112 (FR-019): văn bản PDF có bố cục (xuống dòng, đoạn, nhiều cột) vẫn giữ bất biến locator + tái dựng viewer.
describe("chunkPages trên văn bản PDF có bố cục (112)", () => {
  it("chunk.text === T.slice(charStart, charEnd) và reconstructText === joinPages", async () => {
    const { layoutPage } =
      await import("../../src/main/services/ingestion/pdf-layout/layout-page");
    const { reconstructText } =
      await import("../../src/main/services/source-viewer/reconstruct");
    const { lines } = await import("./helpers/layout-items");
    const para = (k: string) =>
      Array.from(
        { length: 14 },
        (_, i) => `${k} column paragraph sentence ${i} here`,
      );
    const page = (n: number) => ({
      page: n,
      text: layoutPage(
        [...lines(50, 60, para("Left")), ...lines(320, 60, para("Right"))],
        { width: 600, height: 800 },
      ).text,
    });
    const pages = [page(1), page(2), page(3)];
    expect(pages[0].text).toContain("\n\n");
    const T = joinPages(pages);
    const drafts = chunkPages(pages, { size: 300, overlap: 50 });
    expect(drafts.length).toBeGreaterThan(3);
    for (const d of drafts) {
      expect(d.text).toBe(T.slice(d.locator.charStart, d.locator.charEnd));
    }
    expect(
      reconstructText(
        drafts.map((d, i) => ({ ...d, id: `c${i}`, sourceId: "s" })),
      ),
    ).toBe(T);
  });
});

// 112 (FR-008): chunker tôn trọng vùng bảng (PageText.blocks).
describe("chunkPages với blocks (bảng) — 112", () => {
  const para = (n: number) =>
    Array.from(
      { length: n },
      (_, i) => `Sentence ${i} of filler prose text.`,
    ).join(" ");
  const table = (rows: number) =>
    [
      "| Item | Qty | Price |",
      "|---|---|---|",
      ...Array.from(
        { length: rows },
        (_, i) => `| Row ${i} name | ${i} | ${i}.00 |`,
      ),
    ].join("\n");

  function pageWith(before: string, tbl: string, after: string) {
    const text = `${before}\n\n${tbl}\n\n${after}`;
    const start = before.length + 2;
    return { page: 1, text, blocks: [{ start, end: start + tbl.length }] };
  }
  const SIZE = 300;
  const OVERLAP = 50;

  it("bảng ngắn hơn một chunk ⇒ nằm trọn trong một chunk", () => {
    const pg = pageWith(para(7), table(4), para(6));
    const b = pg.blocks[0];
    expect(b.end - b.start).toBeLessThan(SIZE);
    const drafts = chunkPages([pg], { size: SIZE, overlap: OVERLAP });
    expect(
      drafts.some(
        (d) => d.locator.charStart <= b.start && d.locator.charEnd >= b.end,
      ),
    ).toBe(true);
    for (const d of drafts) {
      const { charStart: s, charEnd: e } = d.locator;
      expect(e > b.start && e < b.end).toBe(false); // không kết thúc giữa bảng
      expect(d.text).toBe(pg.text.slice(s, e));
    }
  });

  it("bảng dài hơn một chunk ⇒ chỉ cắt giữa hai hàng; chunk kế bắt đầu ở đầu hàng", () => {
    const pg = pageWith(para(2), table(30), para(2));
    const b = pg.blocks[0];
    expect(b.end - b.start).toBeGreaterThan(SIZE);
    const drafts = chunkPages([pg], { size: SIZE, overlap: OVERLAP });
    for (const d of drafts) {
      const { charStart: s, charEnd: e } = d.locator;
      if (e > b.start && e < b.end) expect(pg.text[e - 1]).toBe("\n");
      if (s > b.start && s < b.end) expect(pg.text[s - 1]).toBe("\n");
      expect(d.text).toBe(pg.text.slice(s, e));
    }
    // phủ kín văn bản, luôn tiến
    expect(drafts[0].locator.charStart).toBe(0);
    expect(drafts.at(-1)!.locator.charEnd).toBe(pg.text.length);
  });

  it("bảng hai trang ⇒ không chunk nào vắt trang; offset nối trang đúng", () => {
    const p1 = pageWith(para(1), table(5), "");
    const p2 = { ...pageWith("", table(5), para(1)), page: 2 };
    const drafts = chunkPages([p1, p2], { size: SIZE, overlap: OVERLAP });
    const T = joinPages([p1, p2]);
    for (const d of drafts) {
      expect([1, 2]).toContain(d.locator.page);
      expect(d.text).toBe(T.slice(d.locator.charStart, d.locator.charEnd));
    }
  });

  it("blocks rỗng/không có ⇒ y hệt hành vi cũ", () => {
    const text = `${para(20)}\n${para(15)}\n\n${para(25)}`;
    const a = chunkPages([{ page: 1, text }], { size: SIZE, overlap: OVERLAP });
    const b = chunkPages([{ page: 1, text, blocks: [] }], {
      size: SIZE,
      overlap: OVERLAP,
    });
    expect(b).toEqual(a);
  });
});

describe("chunkPages — overlap không bắt đầu giữa bảng ngắn (112 review)", () => {
  it("chunk kế không bắt đầu bên trong một bảng ngắn", () => {
    const filler = Array.from(
      { length: 30 },
      (_, i) => `Filler sentence ${i} here.`,
    ).join(" ");
    const tbl = [
      "| A | B |",
      "|---|---|",
      "| 1 | 2 |",
      "| 3 | 4 |",
      "| 5 | 6 |",
    ].join("\n");
    const before = filler.slice(0, 100);
    const text = `${before}\n\n${tbl}\n\n${filler}`;
    const start = before.length + 2;
    const b = { start, end: start + tbl.length };
    const drafts = chunkPages([{ page: 1, text, blocks: [b] }], {
      size: 300,
      overlap: 30,
    });
    for (const d of drafts) {
      const s = d.locator.charStart;
      expect(s > b.start && s < b.end).toBe(false);
      expect(d.text).toBe(text.slice(s, d.locator.charEnd));
    }
  });
});
