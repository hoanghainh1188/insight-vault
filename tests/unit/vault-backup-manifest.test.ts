import { describe, it, expect } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import {
  buildManifest,
  validateManifest,
} from "../../src/main/services/vault-backup/manifest";
import { VaultBackupFailure } from "../../src/main/services/vault-backup/errors";

function seeded() {
  const db = openDatabase(":memory:");
  const v = runMigrations(db);
  const now = Date.now();
  for (const id of ["nb1", "nb2"]) {
    db.prepare(
      "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(id, id, "blue", now, now);
  }
  db.prepare(
    `INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at)
     VALUES ('s1', 'nb1', 'txt', 't', '/x.txt', 'ready', 'h', ?, ?)`,
  ).run(now, now);
  return { db, v };
}

function codeOf(x: unknown): string | undefined {
  try {
    validateManifest(x);
  } catch (e) {
    return e instanceof VaultBackupFailure ? e.code : "other";
  }
  return undefined;
}

describe("vault-backup manifest", () => {
  it("buildManifest đếm notebook/nguồn, lấy user_version + metadata", () => {
    const { db, v } = seeded();
    const m = buildManifest(db, {
      appVersion: "0.2.3",
      embeddingModelVersion: "e5-small-384",
      encrypted: true,
      now: new Date("2026-10-06T12:00:00Z"),
    });
    expect(m).toEqual({
      formatVersion: 1,
      appVersion: "0.2.3",
      schemaVersion: v,
      embeddingModelVersion: "e5-small-384",
      createdAt: "2026-10-06T12:00:00.000Z",
      encrypted: true,
      notebookCount: 2,
      sourceCount: 1,
    });
    expect(validateManifest(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });

  it("embeddingModelVersion vắng ⇒ null", () => {
    const { db } = seeded();
    const m = buildManifest(db, {
      appVersion: "1",
      embeddingModelVersion: undefined,
      encrypted: false,
      now: new Date(0),
    });
    expect(m.embeddingModelVersion).toBeNull();
  });

  const good = {
    formatVersion: 1,
    appVersion: "0.2.3",
    schemaVersion: 8,
    embeddingModelVersion: null,
    createdAt: "2026-10-06T12:00:00.000Z",
    encrypted: false,
    notebookCount: 0,
    sourceCount: 0,
  };

  it("bỏ qua field thừa", () => {
    expect(validateManifest({ ...good, extra: "x" })).toEqual(good);
  });

  it("thiếu/sai kiểu/phạm vi ⇒ notBackup; formatVersion lạ ⇒ unsupportedFormat", () => {
    expect(codeOf(null)).toBe("notBackup");
    expect(codeOf("x")).toBe("notBackup");
    expect(codeOf({ ...good, appVersion: 3 })).toBe("notBackup");
    expect(codeOf({ ...good, schemaVersion: 0 })).toBe("notBackup");
    expect(codeOf({ ...good, schemaVersion: 1.5 })).toBe("notBackup");
    expect(codeOf({ ...good, notebookCount: -1 })).toBe("notBackup");
    expect(codeOf({ ...good, createdAt: "hôm qua" })).toBe("notBackup");
    expect(codeOf({ ...good, encrypted: "no" })).toBe("notBackup");
    expect(codeOf({ ...good, embeddingModelVersion: 5 })).toBe("notBackup");
    expect(codeOf({ ...good, formatVersion: 2 })).toBe("unsupportedFormat");
  });
});
