import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import {
  MIGRATIONS,
  getUserVersion,
  runMigrations,
} from "../../src/main/db/migrations";
import { STUDIO_ALL_KINDS } from "../../src/main/services/studio/constants";

// 178 (research R1, data-model.md): migration #11 dựng lại studio_result — bỏ UNIQUE(notebook_id, kind), CHECK 9 kind,
// +5 cột NULL (custom_prompt, source_ids_json, parts, truncated, local), index phiên bản. Dữ liệu v10 giữ nguyên.

type Db = ReturnType<typeof openDatabase>;

interface Row {
  id: string;
  notebook_id: string;
  kind: string;
  content: string;
  citations_json: string;
  custom_prompt: string | null;
  source_ids_json: string | null;
  parts: number | null;
  truncated: number | null;
  local: number | null;
  created_at: number;
  updated_at: number;
}

const OLD_ROWS = [
  ["r1", "summary", "Tóm tắt [1].", '[{"n":1}]', 10, 20],
  ["r2", "keyPoints", "- Ý [2].", "[]", 11, 11],
  ["r3", "faq", "Hỏi: … Đáp: … [1]", "{hỏng", 12, 30],
  ["r4", "outline", "1. A [3]", '[{"n":3}]', 13, 13],
] as const;

function seedV10(): Db {
  const db = openDatabase(":memory:");
  runMigrations(
    db,
    MIGRATIONS.filter((m) => m.version <= 10),
  );
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb1", "N", "#4F46E5", 1, 1);
  const ins = db.prepare(
    "INSERT INTO studio_result (id, notebook_id, kind, content, citations_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
  );
  for (const [id, kind, content, cit, c, u] of OLD_ROWS) {
    ins.run(id, "nb1", kind, content, cit, c, u);
  }
  return db;
}

function insertVersion(db: Db, id: string, kind: string, extra = ""): void {
  db.prepare(
    `INSERT INTO studio_result (id, notebook_id, kind, content, citations_json, created_at, updated_at${extra ? ", " + extra.split("=")[0] : ""})
     VALUES (?, 'nb1', ?, 'x [1]', '[]', 100, 100${extra ? ", " + extra.split("=")[1] : ""})`,
  ).run(id, kind);
}

describe("migration v11 — studio_result nhiều phiên bản (178)", () => {
  it("nâng lên v11 và giữ nguyên mọi dòng cũ; 5 cột mới NULL", () => {
    const db = seedV10();
    expect(runMigrations(db)).toBe(11);
    expect(getUserVersion(db)).toBe(11);
    const rows = db
      .prepare("SELECT * FROM studio_result ORDER BY id")
      .all() as unknown as Row[];
    expect(rows).toHaveLength(4);
    rows.forEach((r, i) => {
      const [id, kind, content, cit, c, u] = OLD_ROWS[i];
      expect(r).toMatchObject({
        id,
        notebook_id: "nb1",
        kind,
        content,
        citations_json: cit,
        created_at: c,
        updated_at: u,
        custom_prompt: null,
        source_ids_json: null,
        parts: null,
        truncated: null,
        local: null,
      });
    });
  });

  it("bỏ UNIQUE(notebook_id, kind): nhiều phiên bản cùng loại", () => {
    const db = seedV10();
    runMigrations(db);
    insertVersion(db, "v2", "summary");
    insertVersion(db, "v3", "summary");
    const n = db
      .prepare(
        "SELECT COUNT(*) AS n FROM studio_result WHERE notebook_id='nb1' AND kind='summary'",
      )
      .get() as { n: number };
    expect(n.n).toBe(3);
  });

  it("CHECK nhận 4 loại mới + custom, từ chối loại lạ", () => {
    const db = seedV10();
    runMigrations(db);
    for (const k of [
      "studyGuide",
      "briefing",
      "timeline",
      "keyTerms",
      "custom",
    ]) {
      expect(() => insertVersion(db, `k-${k}`, k)).not.toThrow();
    }
    expect(() => insertVersion(db, "bad", "bogus")).toThrow();
  });

  it("truncated / local chỉ nhận 0, 1 hoặc NULL", () => {
    const db = seedV10();
    runMigrations(db);
    expect(() =>
      insertVersion(db, "t1", "summary", "truncated=1"),
    ).not.toThrow();
    expect(() => insertVersion(db, "l0", "summary", "local=0")).not.toThrow();
    expect(() => insertVersion(db, "t2", "summary", "truncated=2")).toThrow();
    expect(() => insertVersion(db, "l2", "summary", "local=5")).toThrow();
  });

  it("xoá notebook ⇒ cascade xoá mọi phiên bản; foreign_key_check rỗng", () => {
    const db = seedV10();
    runMigrations(db);
    insertVersion(db, "v2", "summary");
    expect(db.prepare("PRAGMA foreign_key_check(studio_result)").all()).toEqual(
      [],
    );
    db.prepare("DELETE FROM notebook WHERE id = 'nb1'").run();
    const n = db.prepare("SELECT COUNT(*) AS n FROM studio_result").get() as {
      n: number;
    };
    expect(n.n).toBe(0);
  });

  it("có index idx_studio_notebook và idx_studio_versions; không còn bảng tạm", () => {
    const db = seedV10();
    runMigrations(db);
    const names = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE tbl_name = 'studio_result' OR name LIKE 'studio_result%'",
        )
        .all() as { name: string }[]
    ).map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "studio_result",
        "idx_studio_notebook",
        "idx_studio_versions",
      ]),
    );
    expect(names).not.toContain("studio_result_new");
  });

  it("nguyên tử: lỗi giữa chừng ⇒ ROLLBACK, vẫn v10, bảng cũ (còn UNIQUE) nguyên vẹn", () => {
    const db = seedV10();
    // Dòng vi phạm CHECK mới (kind lạ) — chỉ chèn được khi tắt CHECK ⇒ INSERT … SELECT của v11 sẽ lỗi.
    db.exec("PRAGMA ignore_check_constraints = ON");
    db.prepare(
      "INSERT INTO studio_result (id, notebook_id, kind, content, citations_json, created_at, updated_at) VALUES ('bad','nb1','bogus','x','[]',1,1)",
    ).run();
    db.exec("PRAGMA ignore_check_constraints = OFF");
    expect(() => runMigrations(db)).toThrow();
    expect(getUserVersion(db)).toBe(10);
    const n = db.prepare("SELECT COUNT(*) AS n FROM studio_result").get() as {
      n: number;
    };
    expect(n.n).toBe(5);
    expect(() =>
      db
        .prepare(
          "INSERT INTO studio_result (id, notebook_id, kind, content, citations_json, created_at, updated_at) VALUES ('dup','nb1','summary','y','[]',2,2)",
        )
        .run(),
    ).toThrow(); // UNIQUE(notebook_id, kind) của v10 vẫn còn
  });

  it("CHECK của v11 khớp STUDIO_ALL_KINDS", () => {
    const db = seedV10();
    runMigrations(db);
    for (const k of STUDIO_ALL_KINDS) {
      expect(() => insertVersion(db, `all-${k}`, k)).not.toThrow();
    }
  });

  it("DB mới tạo từ đầu cũng ở v11 với cùng schema", () => {
    const db = openDatabase(":memory:");
    expect(runMigrations(db)).toBe(11);
    const cols = (
      db.prepare("PRAGMA table_info(studio_result)").all() as {
        name: string;
      }[]
    ).map((c) => c.name);
    expect(cols).toEqual(
      expect.arrayContaining([
        "custom_prompt",
        "source_ids_json",
        "parts",
        "truncated",
        "local",
      ]),
    );
  });
});
