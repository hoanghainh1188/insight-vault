import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../../src/main/db/database";
import { MIGRATIONS, runMigrations } from "../../src/main/db/migrations";
import { sanitizeConfig } from "../../src/main/services/vault-backup/config-sanitize";
import {
  assertSchemaMatches,
  expectedSchema,
} from "../../src/main/services/vault-backup/schema-guard";
import { VaultBackupFailure } from "../../src/main/services/vault-backup/errors";

const MAX = MIGRATIONS.length;

describe("085 S1: sanitizeConfig", () => {
  const raw = {
    ai: {
      modelSelection: { chatModel: "ministral-3", embedModel: null },
      onlineConfig: {
        activeOnlineId: "anthropic",
        models: { anthropic: "claude-x", gemini: null, openai: null },
      },
      evil: { endpoint: "https://attacker" },
    },
    onboardingComplete: true,
    embeddingModelVersion: "e5-small-384",
    __proto__polluted: 1,
    unknown: "x",
  };

  it("chỉ giữ khoá cho phép; khôi phục ⇒ TẮT provider online (không egress ngầm)", () => {
    expect(sanitizeConfig(raw, { restoring: true })).toEqual({
      ai: {
        modelSelection: { chatModel: "ministral-3", embedModel: null },
        onlineConfig: {
          activeOnlineId: null,
          models: { anthropic: "claude-x", gemini: null, openai: null },
        },
      },
      onboardingComplete: true,
      embeddingModelVersion: "e5-small-384",
    });
  });

  it("123 FR-005: ngôn ngữ giao diện (uiLanguage) KHÔNG đi theo sao lưu/khôi phục", () => {
    for (const restoring of [true, false]) {
      const out = sanitizeConfig(
        { uiLanguage: "en", onboardingComplete: true },
        { restoring },
      );
      expect(out).toEqual({ onboardingComplete: true });
    }
  });

  it("lúc sao lưu giữ nguyên activeOnlineId (chỉ lọc khoá)", () => {
    const out = sanitizeConfig(raw, { restoring: false }) as {
      ai: { onlineConfig: { activeOnlineId: string } };
    };
    expect(out.ai.onlineConfig.activeOnlineId).toBe("anthropic");
  });

  it("sai kiểu ⇒ bỏ field; đầu vào không phải object ⇒ {}", () => {
    expect(
      sanitizeConfig(
        { onboardingComplete: "yes", embeddingModelVersion: 3, ai: [] },
        { restoring: true },
      ),
    ).toEqual({});
    expect(sanitizeConfig(null, { restoring: true })).toEqual({});
  });
});

describe("085 S3: schema guard cho DB khôi phục", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "iv-schema-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function dbAt(version: number) {
    const db = openDatabase(join(dir, "x.db"));
    runMigrations(
      db,
      MIGRATIONS.filter((m) => m.version <= version),
    );
    return db;
  }

  function codeOf(fn: () => void): string | undefined {
    try {
      fn();
    } catch (e) {
      return e instanceof VaultBackupFailure ? e.code : `other:${String(e)}`;
    }
    return undefined;
  }

  it("DB đúng schema (mọi version) ⇒ khớp", () => {
    for (const v of [1, 3, 5, MAX]) {
      const db = dbAt(v);
      expect(() => assertSchemaMatches(db, v)).not.toThrow();
      db.close();
      rmSync(join(dir, "x.db"));
      rmSync(join(dir, "x.db-wal"), { force: true });
      rmSync(join(dir, "x.db-shm"), { force: true });
    }
    expect(expectedSchema(MAX).size).toBeGreaterThan(3);
  });

  it("thêm trigger/view/bảng lạ ⇒ từ chối", () => {
    const cases = [
      "CREATE TRIGGER evil AFTER INSERT ON notebook BEGIN DELETE FROM source; END",
      "CREATE VIEW v AS SELECT 1",
      "CREATE TABLE extra (x)",
    ];
    for (const sql of cases) {
      const db = dbAt(MAX);
      db.exec(sql);
      expect(codeOf(() => assertSchemaMatches(db, MAX))).toBe(
        "badPasswordOrCorrupt",
      );
      db.close();
      rmSync(join(dir, "x.db"));
      rmSync(join(dir, "x.db-wal"), { force: true });
      rmSync(join(dir, "x.db-shm"), { force: true });
    }
  });

  it("đổi định nghĩa object cùng tên / thiếu object ⇒ từ chối", () => {
    const db = dbAt(MAX);
    db.exec("DROP TABLE studio_result");
    db.exec("CREATE TABLE studio_result (id TEXT)");
    expect(codeOf(() => assertSchemaMatches(db, MAX))).toBe(
      "badPasswordOrCorrupt",
    );
    db.exec("DROP TABLE studio_result");
    expect(codeOf(() => assertSchemaMatches(db, MAX))).toBe(
      "badPasswordOrCorrupt",
    );
    db.close();
  });
});
