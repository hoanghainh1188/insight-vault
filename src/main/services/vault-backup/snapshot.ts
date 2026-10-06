import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Db } from "../../db/database";
import { buildManifest, type BackupManifest } from "./manifest";

// Ảnh chụp nhất quán vault (085, research R1/R2): SQLite qua VACUUM INTO (1 read transaction — gộp WAL, không
// chặn app), copy vectors/ (gọi trong vault lock — không có writer LanceDB), config từ object electron-store
// (không copy file có thể đang ghi), rồi manifest đếm trên CHÍNH bản chụp.

export const DB_FILE = "insightvault.db";

export interface SnapshotInput {
  db: Db;
  dataDir: string;
  /** `store.store` của electron-store (không chứa API key — key ở keychain). */
  config: Record<string, unknown>;
  destDir: string;
  appVersion: string;
  encrypted: boolean;
  now: Date;
}

/** Path vào literal SQL: nhân đôi `'` (VACUUM INTO không nhận bind parameter). */
export function sqlStringLiteral(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

export async function createSnapshot(
  input: SnapshotInput,
): Promise<BackupManifest> {
  await mkdir(input.destDir, { recursive: true, mode: 0o700 });
  const dbOut = join(input.destDir, DB_FILE);
  input.db.exec(`VACUUM INTO ${sqlStringLiteral(dbOut)}`);

  const vectors = join(input.dataDir, "vectors");
  if (existsSync(vectors)) {
    await cp(vectors, join(input.destDir, "vectors"), { recursive: true });
  }
  await writeFile(
    join(input.destDir, "config.json"),
    JSON.stringify(input.config),
    { mode: 0o600 },
  );

  const snap = new DatabaseSync(dbOut, { readOnly: true });
  let manifest: BackupManifest;
  try {
    const emv = input.config.embeddingModelVersion;
    manifest = buildManifest(snap, {
      appVersion: input.appVersion,
      embeddingModelVersion: typeof emv === "string" ? emv : undefined,
      encrypted: input.encrypted,
      now: input.now,
    });
  } finally {
    snap.close();
  }
  await writeFile(
    join(input.destDir, "manifest.json"),
    JSON.stringify(manifest),
  );
  return manifest;
}
