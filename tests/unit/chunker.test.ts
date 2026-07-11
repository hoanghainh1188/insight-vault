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
