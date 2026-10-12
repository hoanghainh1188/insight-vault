import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase, type Db } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import { createSnapshot } from "../../src/main/services/vault-backup/snapshot";
import {
  packToFile,
  unpackToDir,
  isAllowedEntry,
  BACKUP_ENTRIES,
} from "../../src/main/services/vault-backup/archive";
import { VAULT_ITEMS } from "../../src/main/services/vault-backup/restore-swap";
import { computeStorageInfo } from "../../src/main/services/app-shell/storage-info";
import { createFsOps } from "../../src/main/services/app-shell/storage-fs";

// 186 (quyết định C3, FR-016): audio cuộc họp là bản DUY NHẤT (app sở hữu) ⇒ sao lưu vault gồm meetings/; khôi phục
// hoán đổi meetings/ cùng DB; hộp sao lưu hiện dung lượng ghi âm.

let root: string;
let dataDir: string;
let db: Db;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "iv-meet-bk-"));
  dataDir = join(root, "data");
  mkdirSync(join(dataDir, "meetings", "sess-1", "final"), { recursive: true });
  writeFileSync(
    join(dataDir, "meetings", "sess-1", "meeting.wav"),
    Buffer.alloc(3200, 7),
  );
  writeFileSync(
    join(dataDir, "meetings", "sess-1", "final", "seg-0000.json"),
    "[]",
  );
  writeFileSync(join(dataDir, "meetings", "sess-1", "session.json.tmp"), "dở");
  db = openDatabase(join(dataDir, "insightvault.db"));
  runMigrations(db);
});
afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

async function snapshot(dest: string): Promise<void> {
  await createSnapshot({
    db,
    dataDir,
    config: {},
    destDir: dest,
    appVersion: "0.3.0",
    encrypted: false,
    now: new Date("2026-10-12T00:00:00Z"),
  });
}

describe("snapshot + archive gồm meetings/", () => {
  it("snapshot chép meetings/ (bỏ tệp tạm *.tmp)", async () => {
    const dest = join(root, "snap");
    await snapshot(dest);
    expect(
      readFileSync(join(dest, "meetings", "sess-1", "meeting.wav")).length,
    ).toBe(3200);
    expect(
      existsSync(join(dest, "meetings", "sess-1", "final", "seg-0000.json")),
    ).toBe(true);
    expect(
      existsSync(join(dest, "meetings", "sess-1", "session.json.tmp")),
    ).toBe(false);
  });

  it("không có meetings/ (chưa ghi lần nào) vẫn chụp được", async () => {
    rmSync(join(dataDir, "meetings"), { recursive: true });
    const dest = join(root, "snap2");
    await snapshot(dest);
    expect(existsSync(join(dest, "meetings"))).toBe(false);
  });

  it("đóng gói → giải nén giữ nguyên audio cuộc họp", async () => {
    const dest = join(root, "snap");
    await snapshot(dest);
    const out = join(root, "m.ivbackup");
    await packToFile(dest, out, {});
    const unpacked = join(root, "unpacked");
    await unpackToDir(out, unpacked, {});
    expect(
      readFileSync(join(unpacked, "meetings", "sess-1", "meeting.wav")).equals(
        readFileSync(join(dataDir, "meetings", "sess-1", "meeting.wav")),
      ),
    ).toBe(true);
  });
});

describe("allowlist + hoán đổi", () => {
  it("BACKUP_ENTRIES và VAULT_ITEMS có meetings", () => {
    expect(BACKUP_ENTRIES).toContain("meetings");
    expect(VAULT_ITEMS).toContain("meetings");
  });

  it("isAllowedEntry: meetings/ chỉ nhận File/Directory, chặn thoát thư mục", () => {
    expect(isAllowedEntry("meetings", "Directory")).toBe(true);
    expect(isAllowedEntry("meetings/", "Directory")).toBe(true);
    expect(isAllowedEntry("meetings/sess-1/meeting.wav", "File")).toBe(true);
    expect(isAllowedEntry("meetings/sess-1/final", "Directory")).toBe(true);
    expect(isAllowedEntry("meetings", "File")).toBe(false);
    expect(isAllowedEntry("meetings/sess-1/x", "SymbolicLink")).toBe(false);
    expect(isAllowedEntry("meetings/../../etc/passwd", "File")).toBe(false);
    expect(isAllowedEntry("meetingsX/a", "File")).toBe(false);
  });
});

describe("dung lượng ghi âm cho hộp sao lưu", () => {
  it("computeStorageInfo trả meetingsBytes khi có meetings/", async () => {
    const info = await computeStorageInfo(dataDir, createFsOps());
    expect(info.meetingsBytes).toBe(3200 + 2 + Buffer.byteLength("dở"));
  });

  it("không có meetings/ ⇒ không có trường meetingsBytes", async () => {
    rmSync(join(dataDir, "meetings"), { recursive: true });
    const info = await computeStorageInfo(dataDir, createFsOps());
    expect(info.meetingsBytes).toBeUndefined();
  });
});
