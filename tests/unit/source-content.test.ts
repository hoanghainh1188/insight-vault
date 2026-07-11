import { describe, it, expect } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import { createSourceRepo } from "../../src/main/services/ingestion/source-repo";
import { getSourceContent } from "../../src/main/services/source-viewer/source-content";
import {
  chunkPages,
  joinPages,
  type PageText,
} from "../../src/main/services/ingestion/chunker";

function setup() {
  const db = openDatabase(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb1", "N", "#4F46E5", 1, 1);
  let t = 1000;
  let n = 0;
  const repo = createSourceRepo(db, {
    now: () => ++t,
    uuid: () => `id-${++n}`,
  });
  return repo;
}

const lorem = (n: number) =>
  Array.from({ length: n }, (_, i) => `cau ${i} noi dung day du.`).join(" ");

describe("getSourceContent", () => {
  it("PDF: text tái dựng == văn bản gốc + pageBreaks đúng", () => {
    const repo = setup();
    const pages: PageText[] = [
      { page: 1, text: lorem(120) },
      { page: 2, text: lorem(90) },
    ];
    const src = repo.create({
      notebookId: "nb1",
      kind: "pdf",
      title: "doc.pdf",
      origin: "/p",
      contentHash: "h",
      pageCount: 2,
    });
    repo.insertChunks(src.id, chunkPages(pages));

    const content = getSourceContent(repo, src.id)!;
    expect(content.kind).toBe("pdf");
    expect(content.title).toBe("doc.pdf");
    expect(content.pageCount).toBe(2);
    expect(content.text).toBe(joinPages(pages)); // tái dựng khớp gốc
    expect(content.pageBreaks.map((p) => p.page)).toEqual([1, 2]);
    expect(content.pageBreaks[0].offset).toBe(0);
  });

  it("txt (non-PDF): pageBreaks rỗng, text tái dựng đúng", () => {
    const repo = setup();
    const pages: PageText[] = [{ page: null, text: lorem(200) }];
    const src = repo.create({
      notebookId: "nb1",
      kind: "txt",
      title: "a.txt",
      origin: "/a",
      contentHash: "h",
    });
    repo.insertChunks(src.id, chunkPages(pages));
    const content = getSourceContent(repo, src.id)!;
    expect(content.pageBreaks).toEqual([]);
    expect(content.text).toBe(joinPages(pages));
  });

  it("URL: text từ chunk đã lưu (KHÔNG fetch mạng — chỉ đọc DB)", () => {
    const repo = setup();
    const pages: PageText[] = [
      { page: null, text: "noi dung trang web da luu" },
    ];
    const src = repo.create({
      notebookId: "nb1",
      kind: "url",
      title: "Trang X",
      origin: "https://x.com",
      contentHash: "h",
    });
    repo.insertChunks(src.id, chunkPages(pages));
    const content = getSourceContent(repo, src.id)!;
    expect(content.kind).toBe("url");
    expect(content.text).toBe(joinPages(pages));
  });

  it("nguồn tồn tại nhưng 0 chunk → text rỗng, pageBreaks rỗng (không crash)", () => {
    const repo = setup();
    const src = repo.create({
      notebookId: "nb1",
      kind: "txt",
      title: "empty.txt",
      origin: "/e",
      contentHash: "h",
    });
    const content = getSourceContent(repo, src.id)!;
    expect(content.text).toBe("");
    expect(content.pageBreaks).toEqual([]);
  });

  it("nguồn không tồn tại / id rỗng → null (A7)", () => {
    const repo = setup();
    expect(getSourceContent(repo, "khong-co")).toBeNull();
    expect(getSourceContent(repo, "")).toBeNull();
  });
});
