import { describe, it, expect } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import {
  MIGRATIONS,
  runMigrations,
  getUserVersion,
} from "../../src/main/db/migrations";

// 186 — migration v12: meeting_session, meeting_marker, transcript_span (data-model §2). Không rebuild bảng source.

type Db = ReturnType<typeof openDatabase>;

function names(db: Db, type: "table" | "index"): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type=?").all(type) as {
      name: string;
    }[]
  ).map((r) => r.name);
}

function seedV11(): Db {
  const db = openDatabase(":memory:");
  runMigrations(
    db,
    MIGRATIONS.filter((m) => m.version <= 11),
  );
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb1", "Họp", "#4F46E5", 1, 1);
  db.prepare(
    `INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run("s-old", "nb1", "pdf", "Cũ", "/x.pdf", "ready", "h", 1, 1);
  return db;
}

function addMeetingSource(db: Db, id = "m1"): void {
  db.prepare(
    `INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    "nb1",
    "meeting",
    "Cuộc họp",
    `meeting:${id}`,
    "processing",
    `h-${id}`,
    2,
    2,
  );
}

function addSession(db: Db, over: Record<string, unknown> = {}): void {
  const row = {
    source_id: "m1",
    session_id: "sess-1",
    phase: "recording",
    language_mode: "auto",
    started_at: 2,
    updated_at: 2,
    transcript_quality: null,
    ...over,
  };
  db.prepare(
    `INSERT INTO meeting_session (source_id, session_id, phase, language_mode, started_at, updated_at, transcript_quality)
     VALUES (?,?,?,?,?,?,?)`,
  ).run(
    row.source_id,
    row.session_id,
    row.phase,
    row.language_mode,
    row.started_at,
    row.updated_at,
    row.transcript_quality,
  );
}

describe("migration v12 — meeting capture", () => {
  it("có version 12 và là bản mới nhất ở feature này", () => {
    expect(MIGRATIONS.some((m) => m.version === 12)).toBe(true);
  });

  it("v11 → v12: tạo 3 bảng + index, dữ liệu cũ giữ nguyên", () => {
    const db = seedV11();
    runMigrations(db);
    expect(getUserVersion(db)).toBeGreaterThanOrEqual(12);
    expect(names(db, "table")).toEqual(
      expect.arrayContaining([
        "meeting_session",
        "meeting_marker",
        "transcript_span",
      ]),
    );
    expect(names(db, "index")).toEqual(
      expect.arrayContaining([
        "idx_meeting_session_phase",
        "idx_meeting_marker_source",
      ]),
    );
    expect(
      db.prepare("SELECT title FROM source WHERE id='s-old'").get(),
    ).toEqual({ title: "Cũ" });
  });

  it("meeting_session: giá trị mặc định + CHECK", () => {
    const db = seedV11();
    runMigrations(db);
    addMeetingSource(db);
    addSession(db);
    const r = db.prepare("SELECT * FROM meeting_session").get() as Record<
      string,
      unknown
    >;
    expect(r).toMatchObject({
      ended_by_user: 0,
      language: null,
      language_changes_json: "[]",
      segments_json: "[]",
      pause_gaps_json: "[]",
      duration_ms: 0,
      final_progress: 0,
      ended_at: null,
    });
    addMeetingSource(db, "m2");
    expect(() =>
      addSession(db, { source_id: "m2", session_id: "sess-2", phase: "bogus" }),
    ).toThrow();
    expect(() =>
      addSession(db, {
        source_id: "m2",
        session_id: "sess-2",
        language_mode: "fr",
      }),
    ).toThrow();
    expect(() =>
      addSession(db, {
        source_id: "m2",
        session_id: "sess-2",
        transcript_quality: "meh",
      }),
    ).toThrow();
    // session_id UNIQUE
    expect(() =>
      addSession(db, { source_id: "m2", session_id: "sess-1" }),
    ).toThrow();
  });

  it("meeting_marker CHECK kind + t_end ≥ t_start", () => {
    const db = seedV11();
    runMigrations(db);
    addMeetingSource(db);
    const ins = db.prepare(
      "INSERT INTO meeting_marker (id, source_id, kind, t_start, t_end, created_at) VALUES (?,?,?,?,?,?)",
    );
    ins.run("k1", "m1", "decision", 1, 1, 1);
    expect(() => ins.run("k2", "m1", "note", 1, 2, 1)).toThrow();
    expect(() => ins.run("k3", "m1", "question", 5, 2, 1)).toThrow();
    expect(() => ins.run("k4", "m1", "question", -1, 2, 1)).toThrow();
  });

  it("transcript_span PK (source_id, idx) + char_end > char_start", () => {
    const db = seedV11();
    runMigrations(db);
    addMeetingSource(db);
    const ins = db.prepare(
      "INSERT INTO transcript_span (source_id, idx, char_start, char_end, t_start, t_end) VALUES (?,?,?,?,?,?)",
    );
    ins.run("m1", 0, 0, 5, 0, 1);
    expect(() => ins.run("m1", 0, 6, 9, 1, 2)).toThrow();
    expect(() => ins.run("m1", 1, 9, 9, 1, 2)).toThrow();
  });

  it("xoá source ⇒ cascade xoá session, marker, span", () => {
    const db = seedV11();
    runMigrations(db);
    addMeetingSource(db);
    addSession(db);
    db.prepare(
      "INSERT INTO meeting_marker (id, source_id, kind, t_start, t_end, created_at) VALUES ('k','m1','question',0,0,1)",
    ).run();
    db.prepare(
      "INSERT INTO transcript_span (source_id, idx, char_start, char_end, t_start, t_end) VALUES ('m1',0,0,3,0,1)",
    ).run();
    db.prepare("DELETE FROM source WHERE id='m1'").run();
    for (const t of ["meeting_session", "meeting_marker", "transcript_span"]) {
      expect(db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get()).toEqual({
        n: 0,
      });
    }
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
});
