import type { Db } from "../../db/database";
import { getUserVersion } from "../../db/migrations";
import { FORMAT_VERSION } from "./container";
import { VaultBackupFailure } from "./errors";

/** Bản kê của bản sao lưu (085) — entry `manifest.json` trong tar. Không chứa nội dung tài liệu. */
export interface BackupManifest {
  formatVersion: number;
  appVersion: string;
  schemaVersion: number;
  embeddingModelVersion: string | null;
  createdAt: string;
  encrypted: boolean;
  notebookCount: number;
  sourceCount: number;
}

export interface BuildManifestOptions {
  appVersion: string;
  embeddingModelVersion: string | undefined;
  encrypted: boolean;
  now: Date;
}

function count(db: Db, table: "notebook" | "source"): number {
  // table là hằng nội bộ (union literal), không phải input người dùng.
  const row = db.prepare(`SELECT count(*) AS c FROM ${table}`).get() as {
    c: number;
  };
  return row.c;
}

/** Dựng manifest từ DB snapshot (đã chụp — không phải DB sống). */
export function buildManifest(
  db: Db,
  opts: BuildManifestOptions,
): BackupManifest {
  return {
    formatVersion: FORMAT_VERSION,
    appVersion: opts.appVersion,
    schemaVersion: getUserVersion(db),
    embeddingModelVersion: opts.embeddingModelVersion ?? null,
    createdAt: opts.now.toISOString(),
    encrypted: opts.encrypted,
    notebookCount: count(db, "notebook"),
    sourceCount: count(db, "source"),
  };
}

const isNonNegInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0;

/**
 * Validate manifest đọc từ file người dùng chọn (dữ liệu KHÔNG tin cậy). Field thừa bị bỏ qua.
 * Thiếu/sai kiểu ⇒ `notBackup`; formatVersion lạ ⇒ `unsupportedFormat`.
 */
export function validateManifest(input: unknown): BackupManifest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new VaultBackupFailure("notBackup");
  }
  const m = input as Record<string, unknown>;
  if (isNonNegInt(m.formatVersion) && m.formatVersion !== FORMAT_VERSION) {
    throw new VaultBackupFailure("unsupportedFormat");
  }
  const ok =
    m.formatVersion === FORMAT_VERSION &&
    typeof m.appVersion === "string" &&
    m.appVersion.length <= 64 &&
    isNonNegInt(m.schemaVersion) &&
    m.schemaVersion >= 1 &&
    (m.embeddingModelVersion === null ||
      (typeof m.embeddingModelVersion === "string" &&
        m.embeddingModelVersion.length <= 128)) &&
    typeof m.createdAt === "string" &&
    !Number.isNaN(Date.parse(m.createdAt)) &&
    typeof m.encrypted === "boolean" &&
    isNonNegInt(m.notebookCount) &&
    isNonNegInt(m.sourceCount);
  if (!ok) throw new VaultBackupFailure("notBackup");
  return {
    formatVersion: m.formatVersion as number,
    appVersion: m.appVersion as string,
    schemaVersion: m.schemaVersion as number,
    embeddingModelVersion: m.embeddingModelVersion as string | null,
    createdAt: m.createdAt as string,
    encrypted: m.encrypted as boolean,
    notebookCount: m.notebookCount as number,
    sourceCount: m.sourceCount as number,
  };
}
