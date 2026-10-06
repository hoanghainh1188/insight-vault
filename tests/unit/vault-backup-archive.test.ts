import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  symlinkSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as tar from "tar";
import {
  packToFile,
  readContainerHeader,
  unpackToDir,
} from "../../src/main/services/vault-backup/archive";
import { encodeHeader } from "../../src/main/services/vault-backup/container";
import { VaultBackupFailure } from "../../src/main/services/vault-backup/errors";
import { createHash } from "node:crypto";

let root: string;
let src: string;

function makeSnapshotDir(dir: string): void {
  mkdirSync(join(dir, "vectors", "chunks.lance", "_versions"), {
    recursive: true,
  });
  writeFileSync(join(dir, "manifest.json"), '{"formatVersion":1}');
  writeFileSync(join(dir, "insightvault.db"), Buffer.alloc(4096, 3));
  writeFileSync(join(dir, "config.json"), '{"a":1}');
  writeFileSync(
    join(dir, "vectors", "chunks.lance", "_versions", "1.manifest"),
    Buffer.from("vec-data-ổn"),
  );
}

async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    return e instanceof VaultBackupFailure ? e.code : `other:${String(e)}`;
  }
  return undefined;
}

/** Ghép 1 file .ivbackup không mã hoá hợp lệ từ 1 tar.gz bất kỳ (để thử entry độc hại). */
function wrapPlain(tgz: Buffer): Buffer {
  const header = encodeHeader({ encrypted: false });
  const hash = createHash("sha256").update(header).update(tgz).digest();
  return Buffer.concat([header, tgz, hash]);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "iv-archive-"));
  src = join(root, "src");
  makeSnapshotDir(src);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("vault-backup archive (không mật khẩu)", () => {
  it("round-trip giữ nguyên byte; không để lại .part", async () => {
    const out = join(root, "a.ivbackup");
    const { sizeBytes } = await packToFile(src, out, {});
    expect(sizeBytes).toBe(statSync(out).size);
    expect(existsSync(`${out}.part`)).toBe(false);
    expect(await readContainerHeader(out)).toEqual({ encrypted: false });

    const dest = join(root, "dest");
    await unpackToDir(out, dest, {});
    for (const f of [
      "manifest.json",
      "insightvault.db",
      "config.json",
      "vectors/chunks.lance/_versions/1.manifest",
    ]) {
      expect(
        readFileSync(join(dest, f)).equals(readFileSync(join(src, f))),
      ).toBe(true);
    }
  });

  it("vectors/ vắng (cài mới) vẫn đóng gói được", async () => {
    rmSync(join(src, "vectors"), { recursive: true });
    const out = join(root, "b.ivbackup");
    await packToFile(src, out, {});
    const dest = join(root, "dest");
    await unpackToDir(out, dest, {});
    expect(existsSync(join(dest, "insightvault.db"))).toBe(true);
  });

  it("sửa 1 byte body hoặc header ⇒ badPasswordOrCorrupt + xoá dest", async () => {
    const out = join(root, "c.ivbackup");
    await packToFile(src, out, {});
    const bytes = readFileSync(out);
    for (const pos of [100, 5, bytes.length - 40]) {
      const bad = Buffer.from(bytes);
      bad[pos] ^= 0x01;
      const f = join(root, `bad-${pos}.ivbackup`);
      writeFileSync(f, bad);
      const dest = join(root, `dest-${pos}`);
      const code = await codeOf(unpackToDir(f, dest, {}));
      // byte 5 = flags ⇒ thành "mã hoá" mà không có mật khẩu/đủ header — vẫn bị từ chối, không giải nén.
      expect([
        "badPasswordOrCorrupt",
        "notBackup",
        "passwordRequired",
        ,
        "unsupportedFormat",
      ]).toContain(code);
      expect(existsSync(dest)).toBe(false);
    }
  });

  it("file không phải bản sao lưu ⇒ notBackup", async () => {
    const f = join(root, "x.ivbackup");
    writeFileSync(f, "hello world, không phải backup");
    expect(await codeOf(unpackToDir(f, join(root, "d"), {}))).toBe("notBackup");
    expect(await codeOf(readContainerHeader(f))).toBe("notBackup");
  });

  it("entry `..`, symlink, ngoài allowlist ⇒ từ chối cả file", async () => {
    const evil = join(root, "evil");
    mkdirSync(evil);
    writeFileSync(join(evil, "manifest.json"), "{}");
    writeFileSync(join(evil, "secret.txt"), "x");
    symlinkSync("/etc/hosts", join(evil, "config.json"));

    const cases: Array<[string, Parameters<typeof tar.c>[0], string[]]> = [
      [
        "traversal",
        { gzip: true, cwd: evil, prefix: "../../" },
        ["manifest.json"],
      ],
      ["symlink", { gzip: true, cwd: evil }, ["manifest.json", "config.json"]],
      [
        "not-allowed",
        { gzip: true, cwd: evil },
        ["manifest.json", "secret.txt"],
      ],
    ];
    for (const [name, opts, files] of cases) {
      const tgzPath = join(root, `${name}.tgz`);
      await tar.c({ ...opts, file: tgzPath }, files);
      const f = join(root, `${name}.ivbackup`);
      writeFileSync(f, wrapPlain(readFileSync(tgzPath)));
      const dest = join(root, `dest-${name}`);
      expect(await codeOf(unpackToDir(f, dest, {}))).toBe(
        "badPasswordOrCorrupt",
      );
      expect(existsSync(dest)).toBe(false);
      expect(existsSync(join(root, "secret.txt"))).toBe(false);
    }
  });

  it("lỗi ghi (thư mục đích không tồn tại) ⇒ ioError, không còn .part", async () => {
    const out = join(root, "no-such-dir", "z.ivbackup");
    expect(await codeOf(packToFile(src, out, {}))).toBe("ioError");
    expect(existsSync(`${out}.part`)).toBe(false);
  });

  it("security S2: manifest/config > 1MB ⇒ từ chối trước khi đọc", async () => {
    writeFileSync(join(src, "config.json"), Buffer.alloc(1024 * 1024 + 1, 32));
    const out = join(root, "big.ivbackup");
    await packToFile(src, out, {});
    const dest = join(root, "dest-big");
    expect(await codeOf(unpackToDir(out, dest, {}))).toBe(
      "badPasswordOrCorrupt",
    );
    expect(existsSync(dest)).toBe(false);
  });

  it("security N2: quyền file giải nén được chuẩn hoá 0600/0700; file sao lưu 0600", async () => {
    const out = join(root, "m.ivbackup");
    await packToFile(src, out, {});
    expect(statSync(out).mode & 0o777).toBe(0o600);
    const dest = join(root, "dest-m");
    await unpackToDir(out, dest, {});
    expect(statSync(join(dest, "insightvault.db")).mode & 0o777).toBe(0o600);
    expect(statSync(join(dest, "vectors")).mode & 0o777).toBe(0o700);
  });

  it(".part mồ côi từ lần trước không chặn lần sao lưu mới", async () => {
    const out = join(root, "p.ivbackup");
    writeFileSync(`${out}.part`, "rác");
    await packToFile(src, out, {});
    expect(existsSync(`${out}.part`)).toBe(false);
    expect(existsSync(out)).toBe(true);
  });
});
