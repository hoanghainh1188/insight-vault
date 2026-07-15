import { describe, it, expect } from "vitest";
import type { Chunk } from "../../src/shared/ipc/types";
import { makeSnippet } from "../../src/main/services/search/snippet";
import { createContentSearch } from "../../src/main/services/search/content-search";
import { CHANNELS, isWhitelisted } from "../../src/shared/ipc/channels";

describe("content-search channel (073)", () => {
  it("source:search whitelisted, tên không trùng", () => {
    expect(CHANNELS.sourceSearch).toBe("source:search");
    expect(isWhitelisted("source:search")).toBe(true);
    expect(new Set(Object.values(CHANNELS)).size).toBe(
      Object.values(CHANNELS).length,
    );
  });
});

function chunk(id: string, sourceId: string, text: string, page = 1): Chunk {
  return {
    id,
    sourceId,
    ordinal: 0,
    text,
    locator: { page, charStart: 0, charEnd: text.length },
  };
}

describe("makeSnippet (073)", () => {
  it("gộp khoảng trắng + trim", () => {
    expect(makeSnippet("  a\n\n b\t c  ")).toBe("a b c");
  });
  it("cắt tối đa maxLen + thêm …", () => {
    expect(makeSnippet("x".repeat(200), 10)).toBe(`${"x".repeat(10)}…`);
  });
  it("ngắn hơn maxLen → giữ nguyên (không …)", () => {
    expect(makeSnippet("ngắn", 100)).toBe("ngắn");
  });
});

describe("createContentSearch (073)", () => {
  function make(
    overrides: Partial<Parameters<typeof createContentSearch>[0]> = {},
  ) {
    const chunks: Chunk[] = [
      chunk("c1", "s1", "Điều khoản bảo mật dữ liệu người dùng.", 3),
      chunk("c2", "s2", "Nội dung khác về thanh toán.", 7),
    ];
    const byId = new Map(chunks.map((c) => [c.id, c]));
    return createContentSearch({
      searchBm25: () => [
        { id: "c1", score: 0.1 },
        { id: "c2", score: 0.2 },
      ],
      getChunksByIds: (ids) =>
        ids.map((id) => byId.get(id)).filter((c): c is Chunk => c != null),
      getSourceTitle: (sid) => (sid === "s1" ? "Hợp đồng" : "Báo cáo"),
      ...overrides,
    });
  }

  it("query rỗng → [] (không gọi BM25)", () => {
    let called = false;
    const svc = make({
      searchBm25: () => {
        called = true;
        return [];
      },
    });
    expect(svc.search("nb1", "   ")).toEqual([]);
    expect(called).toBe(false);
  });

  it("dựng ContentSearchHit theo thứ tự score + giữ locator + snippet + title", () => {
    const svc = make();
    const hits = svc.search("nb1", "bảo mật");
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({
      n: 1,
      chunkId: "c1",
      sourceId: "s1",
      sourceTitle: "Hợp đồng",
      snippet: "Điều khoản bảo mật dữ liệu người dùng.",
    });
    expect(hits[0].locator.page).toBe(3);
    expect(hits[1].chunkId).toBe("c2");
    expect(hits[1].sourceTitle).toBe("Báo cáo");
  });

  it("BM25 trả rỗng → []", () => {
    const svc = make({ searchBm25: () => [] });
    expect(svc.search("nb1", "khong-khop")).toEqual([]);
  });

  it("chỉ gọi getSourceTitle 1 lần/nguồn (cache)", () => {
    let calls = 0;
    const c = [chunk("a", "s1", "x"), chunk("b", "s1", "y")];
    const byId = new Map(c.map((x) => [x.id, x]));
    const svc = createContentSearch({
      searchBm25: () => [
        { id: "a", score: 1 },
        { id: "b", score: 2 },
      ],
      getChunksByIds: (ids) =>
        ids.map((id) => byId.get(id)).filter((x): x is Chunk => x != null),
      getSourceTitle: () => {
        calls += 1;
        return "Nguồn";
      },
    });
    svc.search("nb1", "q");
    expect(calls).toBe(1);
  });
});
