import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import {
  buildFtsMatch,
  foldVietnamese,
} from "../../src/main/services/ingestion/fts-fold";

// 147 (a, clarify #20): giữ gạch trong từ ghép giúp tìm kiếm từ khoá — "long-term" khớp cả "long term" lẫn "long-term" (tokenizer
// unicode61 tách tại gạch), còn "longterm" (hành vi cũ) không khớp.

function search(text: string, query: string): boolean {
  const db = openDatabase(":memory:");
  db.exec("CREATE VIRTUAL TABLE t USING fts5(text, tokenize='unicode61')");
  db.prepare("INSERT INTO t (text) VALUES (?)").run(foldVietnamese(text));
  const row = db
    .prepare("SELECT count(*) AS n FROM t WHERE t MATCH ?")
    .get(buildFtsMatch(query)) as { n: number };
  db.close();
  return row.n > 0;
}

describe("FTS + gạch nối", () => {
  it("chunk 'long-term' khớp 'long term' và 'long-term'", () => {
    expect(search("our long-term plan", "long term")).toBe(true);
    expect(search("our long-term plan", "long-term")).toBe(true);
  });

  it("chunk 'longterm' (nối dính kiểu cũ) không khớp 'long term'", () => {
    expect(search("our longterm plan", "long term")).toBe(false);
  });

  it("tiếng Việt 'hợp-đồng' khớp 'hợp đồng' và 'hop dong'", () => {
    expect(search("bản hợp-đồng này", "hợp đồng")).toBe(true);
    expect(search("bản hợp-đồng này", "hop dong")).toBe(true);
    expect(search("bản hợpđồng này", "hop dong")).toBe(false);
  });
});
