import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BackupSummary } from "@shared/ipc/types";
import { openDatabase, type Db } from "../../db/database";
import {
  MIGRATIONS,
  SchemaVersionError,
  getUserVersion,
  runMigrations,
} from "../../db/migrations";
import { sanitizeConfig } from "./config-sanitize";
import { VaultBackupFailure, isSqliteFull } from "./errors";
import type { BackupManifest } from "./manifest";
import { assertSchemaMatches } from "./schema-guard";
import { DB_FILE } from "./snapshot";

// Kiểm dữ liệu đã giải nén TRƯỚC khi cho xác nhận (085, R6 + security S1/S3). Dữ liệu trong bản sao lưu KHÔNG tin
// cậy (file không mã hoá ai cũng tạo được):
//  - DB: trusted_schema=OFF, quick_check, schema phải KHỚP đúng schema app tạo ở cùng version (không trigger/view
//    lạ) TRƯỚC migration, migrate trong staging (lúc boot DB đã ở schema hiện tại), kiểm lại sau migration.
//  - config.json: chỉ giữ khoá đã biết + TẮT provider online (không tự bật egress) rồi ghi đè bản đã lọc.
//  - Đếm notebook/nguồn trên DB thật; cờ mã hoá lấy từ header container (không tin manifest).

export interface PrepareOptions {
  currentEmbeddingModelVersion: string | undefined;
  /** Cờ mã hoá THẬT từ header container. */
  encrypted: boolean;
}

const APP_MAX_SCHEMA = MIGRATIONS.reduce((m, x) => Math.max(m, x.version), 0);
// SQLITE_CORRUPT (11) / SQLITE_NOTADB (26) ⇒ file hỏng; lỗi SQLite khác (I/O…) ⇒ ioError.
const CORRUPT_ERRCODES = new Set([11, 26]);

function countOf(db: Db, table: "notebook" | "source"): number {
  return (
    db.prepare(`SELECT count(*) AS c FROM ${table}`).get() as { c: number }
  ).c;
}

async function sanitizeStagedConfig(stagingDir: string): Promise<void> {
  const p = join(stagingDir, "config.json");
  let raw: unknown = {};
  if (existsSync(p)) {
    try {
      raw = JSON.parse(await readFile(p, "utf8"));
    } catch {
      throw new VaultBackupFailure("badPasswordOrCorrupt");
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new VaultBackupFailure("badPasswordOrCorrupt");
    }
  }
  await writeFile(p, JSON.stringify(sanitizeConfig(raw, { restoring: true })), {
    mode: 0o600,
  });
}

function mapDbError(e: unknown): VaultBackupFailure {
  if (e instanceof VaultBackupFailure) return e;
  if (e instanceof SchemaVersionError) {
    return new VaultBackupFailure("newerSchema");
  }
  if (isSqliteFull(e)) return new VaultBackupFailure("diskFull");
  const errcode =
    e && typeof e === "object" && "errcode" in e
      ? (e as { errcode: number }).errcode & 0xff
      : null;
  if (errcode !== null && !CORRUPT_ERRCODES.has(errcode)) {
    return new VaultBackupFailure("ioError");
  }
  return new VaultBackupFailure("badPasswordOrCorrupt");
}

export async function prepareStaged(
  stagingDir: string,
  manifest: BackupManifest,
  opts: PrepareOptions,
): Promise<BackupSummary> {
  if (manifest.schemaVersion > APP_MAX_SCHEMA) {
    throw new VaultBackupFailure("newerSchema");
  }
  const dbPath = join(stagingDir, DB_FILE);
  if (!existsSync(dbPath)) throw new VaultBackupFailure("badPasswordOrCorrupt");
  await sanitizeStagedConfig(stagingDir);

  let db: Db | null = null;
  try {
    db = openDatabase(dbPath);
    db.exec("PRAGMA trusted_schema = OFF");
    const check = db.prepare("PRAGMA quick_check").get() as Record<
      string,
      unknown
    >;
    if (Object.values(check)[0] !== "ok") {
      throw new VaultBackupFailure("badPasswordOrCorrupt");
    }
    const version = getUserVersion(db);
    if (version > APP_MAX_SCHEMA) throw new VaultBackupFailure("newerSchema");
    if (version < 1) throw new VaultBackupFailure("badPasswordOrCorrupt");
    assertSchemaMatches(db, version);
    runMigrations(db);
    assertSchemaMatches(db, APP_MAX_SCHEMA);
    return {
      createdAt: manifest.createdAt,
      appVersion: manifest.appVersion,
      notebookCount: countOf(db, "notebook"),
      sourceCount: countOf(db, "source"),
      encrypted: opts.encrypted,
      needsReindex:
        manifest.embeddingModelVersion !==
        (opts.currentEmbeddingModelVersion ?? null),
    };
  } catch (e) {
    throw mapDbError(e);
  } finally {
    db?.close();
  }
}
