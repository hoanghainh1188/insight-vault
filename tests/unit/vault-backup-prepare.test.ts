import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../../src/main/db/database";
import {
  MIGRATIONS,
  getUserVersion,
  runMigrations,
} from "../../src/main/db/migrations";
import { prepareStaged } from "../../src/main/services/vault-backup/prepare";
import type { BackupManifest } from "../../src/main/services/vault-backup/manifest";
import { VaultBackupFailure } from "../../src/main/services/vault-backup/errors";

let dir: string;
const maxSchema = MIGRATIONS.length;

function manifest(over: Partial<BackupManifest> = {}): BackupManifest {
  return {
    formatVersion: 1,
    appVersion: "0.2.3",
    schemaVersion: maxSchema,
    embeddingModelVersion: "e5-small-384",
    createdAt: "2026-10-01T00:00:00.000Z",
    encrypted: true,
    notebookCount: 99, // cố ý sai — summary phải đếm trên DB thật
    sourceCount: 99,
    ...over,
  };
}

function makeDb(upTo: number): void {
  const db = openDatabase(join(dir, "insightvault.db"));
  runMigrations(
    db,
    MIGRATIONS.filter((m) => m.version <= upTo),
  );
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES ('a', 'A', 'blue', 1, 1)",
  ).run();
  db.close();
  writeFileSync(join(dir, "config.json"), '{"embeddingModelVersion":"x"}');
}

async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    return e instanceof VaultBackupFailure ? e.code : `other:${String(e)}`;
  }
  return undefined;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "iv-prep-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("vault-backup prepareStaged", () => {
  it("schema hiện tại ⇒ summary đếm trên DB, needsReindex theo embeddingModelVersion", async () => {
    makeDb(maxSchema);
    const s = await prepareStaged(dir, manifest(), {
      currentEmbeddingModelVersion: "e5-small-384",
      encrypted: true,
    });
    expect(s).toEqual({
      createdAt: "2026-10-01T00:00:00.000Z",
      appVersion: "0.2.3",
      notebookCount: 1,
      sourceCount: 0,
      encrypted: true,
      needsReindex: false,
    });
    const s2 = await prepareStaged(dir, manifest(), {
      currentEmbeddingModelVersion: "other",
      encrypted: true,
    });
    expect(s2.needsReindex).toBe(true);
  });

  it("schema cũ hơn ⇒ được migrate lên max ngay trong staging", async () => {
    makeDb(3);
    await prepareStaged(dir, manifest({ schemaVersion: 3 }), {
      currentEmbeddingModelVersion: undefined,
      encrypted: false,
    });
    const db = openDatabase(join(dir, "insightvault.db"));
    expect(getUserVersion(db)).toBe(maxSchema);
    db.close();
  });

  it("178: bản sao lưu schema v10 có studio_result ⇒ migrate lên v11, dữ liệu Studio giữ nguyên", async () => {
    makeDb(10);
    const pre = openDatabase(join(dir, "insightvault.db"));
    pre
      .prepare(
        "INSERT INTO studio_result (id, notebook_id, kind, content, citations_json, created_at, updated_at) VALUES ('r1','a','summary','Tóm tắt [1].','[]',7,9)",
      )
      .run();
    pre.close();
    await prepareStaged(dir, manifest({ schemaVersion: 10 }), {
      currentEmbeddingModelVersion: undefined,
      encrypted: false,
    });
    const db = openDatabase(join(dir, "insightvault.db"));
    expect(getUserVersion(db)).toBe(maxSchema);
    expect(
      db
        .prepare(
          "SELECT id, kind, content, created_at, updated_at, local FROM studio_result",
        )
        .all(),
    ).toEqual([
      {
        id: "r1",
        kind: "summary",
        content: "Tóm tắt [1].",
        created_at: 7,
        updated_at: 9,
        local: null,
      },
    ]);
    db.close();
  });

  it("schema mới hơn app (manifest hoặc DB) ⇒ newerSchema", async () => {
    makeDb(maxSchema);
    expect(
      await codeOf(
        prepareStaged(dir, manifest({ schemaVersion: maxSchema + 1 }), {
          currentEmbeddingModelVersion: undefined,
          encrypted: false,
        }),
      ),
    ).toBe("newerSchema");
    const db = openDatabase(join(dir, "insightvault.db"));
    db.exec(`PRAGMA user_version = ${maxSchema + 5}`);
    db.close();
    expect(
      await codeOf(
        prepareStaged(dir, manifest(), {
          currentEmbeddingModelVersion: undefined,
          encrypted: false,
        }),
      ),
    ).toBe("newerSchema");
  });

  it("security: cờ mã hoá lấy từ header (không tin manifest); config được lọc + TẮT provider online", async () => {
    makeDb(maxSchema);
    writeFileSync(
      join(dir, "config.json"),
      JSON.stringify({
        ai: { onlineConfig: { activeOnlineId: "openai", models: {} } },
        evil: 1,
      }),
    );
    const s = await prepareStaged(dir, manifest({ encrypted: true }), {
      currentEmbeddingModelVersion: undefined,
      encrypted: false,
    });
    expect(s.encrypted).toBe(false);
    expect(JSON.parse(readFileSync(join(dir, "config.json"), "utf8"))).toEqual({
      ai: { onlineConfig: { activeOnlineId: null, models: {} } },
    });
  });

  it("security: DB có trigger lạ ⇒ từ chối trước migration", async () => {
    makeDb(maxSchema);
    const db = openDatabase(join(dir, "insightvault.db"));
    db.exec(
      "CREATE TRIGGER evil AFTER INSERT ON notebook BEGIN DELETE FROM source; END",
    );
    db.close();
    expect(
      await codeOf(
        prepareStaged(dir, manifest(), {
          currentEmbeddingModelVersion: undefined,
          encrypted: false,
        }),
      ),
    ).toBe("badPasswordOrCorrupt");
  });

  it("DB hỏng / thiếu / config không phải object ⇒ badPasswordOrCorrupt", async () => {
    writeFileSync(join(dir, "insightvault.db"), "không phải sqlite");
    writeFileSync(join(dir, "config.json"), "{}");
    expect(
      await codeOf(
        prepareStaged(dir, manifest(), {
          currentEmbeddingModelVersion: undefined,
          encrypted: false,
        }),
      ),
    ).toBe("badPasswordOrCorrupt");

    rmSync(join(dir, "insightvault.db"));
    expect(
      await codeOf(
        prepareStaged(dir, manifest(), {
          currentEmbeddingModelVersion: undefined,
          encrypted: false,
        }),
      ),
    ).toBe("badPasswordOrCorrupt");

    makeDb(maxSchema);
    writeFileSync(join(dir, "config.json"), "[1,2]");
    expect(
      await codeOf(
        prepareStaged(dir, manifest(), {
          currentEmbeddingModelVersion: undefined,
          encrypted: false,
        }),
      ),
    ).toBe("badPasswordOrCorrupt");
  });
});
