import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  preRestoreFileName,
  pruneBackups,
} from "../../src/main/services/vault-backup/retention";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "iv-ret-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("vault-backup retention", () => {
  it("tên bản tự sao lưu theo giờ địa phương YYYYMMDD-HHmmss", () => {
    expect(preRestoreFileName(new Date(2026, 9, 6, 7, 5, 9))).toBe(
      "pre-restore-20261006-070509.ivbackup",
    );
  });

  it("giữ 3 bản mới nhất, không đụng file khác", async () => {
    const names = [
      "pre-restore-20261001-000000.ivbackup",
      "pre-restore-20261002-000000.ivbackup",
      "pre-restore-20261003-000000.ivbackup",
      "pre-restore-20261004-000000.ivbackup",
      "pre-restore-20261005-000000.ivbackup",
      "ghi-chu.txt",
      "pre-restore-xyz.ivbackup",
    ];
    for (const n of names) writeFileSync(join(dir, n), "x");
    const r = await pruneBackups(dir, 3);
    expect(r.removed).toBe(2);
    expect(readdirSync(dir).sort()).toEqual([
      "ghi-chu.txt",
      "pre-restore-20261003-000000.ivbackup",
      "pre-restore-20261004-000000.ivbackup",
      "pre-restore-20261005-000000.ivbackup",
      "pre-restore-xyz.ivbackup",
    ]);
  });

  it("thư mục không tồn tại ⇒ không ném", async () => {
    await expect(pruneBackups(join(dir, "nope"), 3)).resolves.toEqual({
      removed: 0,
    });
  });
});
