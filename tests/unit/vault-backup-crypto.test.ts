import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
import {
  packToFile,
  readContainerHeader,
  unpackToDir,
} from "../../src/main/services/vault-backup/archive";
import { ENC_HEADER_LEN } from "../../src/main/services/vault-backup/container";
import { VaultBackupFailure } from "../../src/main/services/vault-backup/errors";

const PW = "mat-khau-dai-du";
const KDF = { log2N: 10, r: 8, p: 1 };
let root: string;
let file: string;

async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    return e instanceof VaultBackupFailure ? e.code : `other:${String(e)}`;
  }
  return undefined;
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "iv-crypto-"));
  const src = join(root, "src");
  mkdirSync(join(src, "vectors"), { recursive: true });
  writeFileSync(join(src, "manifest.json"), '{"bí mật":"nội dung tài liệu"}');
  writeFileSync(join(src, "insightvault.db"), Buffer.alloc(8192, 5));
  writeFileSync(join(src, "vectors", "v"), "vec");
  file = join(root, "enc.ivbackup");
  await packToFile(src, file, { password: PW, kdf: KDF });
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("vault-backup mã hoá (US3)", () => {
  it("header báo mã hoá; body không lộ tên entry/nội dung, không giải gzip được", async () => {
    expect((await readContainerHeader(file)).encrypted).toBe(true);
    const bytes = readFileSync(file);
    expect(bytes.includes(Buffer.from("manifest.json"))).toBe(false);
    expect(bytes.includes(Buffer.from("nội dung tài liệu"))).toBe(false);
    expect(() => gunzipSync(bytes.subarray(ENC_HEADER_LEN))).toThrow();
  });

  it("round-trip với mật khẩu đúng", async () => {
    const dest = join(root, "ok");
    await unpackToDir(file, dest, { password: PW });
    expect(readFileSync(join(dest, "vectors", "v"), "utf8")).toBe("vec");
  });

  it("không gửi mật khẩu ⇒ passwordRequired; sai ⇒ badPasswordOrCorrupt", async () => {
    expect(await codeOf(unpackToDir(file, join(root, "a"), {}))).toBe(
      "passwordRequired",
    );
    expect(
      await codeOf(
        unpackToDir(file, join(root, "b"), { password: "sai-mat-khau" }),
      ),
    ).toBe("badPasswordOrCorrupt");
    expect(existsSync(join(root, "b"))).toBe(false);
  });

  it("sửa 1 byte header(salt/iv) / giữa body / byte cuối ciphertext / tag ⇒ badPasswordOrCorrupt", async () => {
    const bytes = readFileSync(file);
    const positions = {
      salt: 12,
      iv: 30,
      body: ENC_HEADER_LEN + 50,
      lastCipher: bytes.length - 17,
      tag: bytes.length - 1,
    };
    for (const [name, pos] of Object.entries(positions)) {
      const bad = Buffer.from(bytes);
      bad[pos] ^= 0x01;
      const f = join(root, `t-${name}.ivbackup`);
      writeFileSync(f, bad);
      const dest = join(root, `d-${name}`);
      expect(await codeOf(unpackToDir(f, dest, { password: PW }))).toBe(
        "badPasswordOrCorrupt",
      );
      expect(existsSync(dest)).toBe(false);
    }
  });
});
