import { describe, it, expect } from "vitest";
import {
  DEFAULT_KDF,
  ENC_HEADER_LEN,
  FORMAT_VERSION,
  HASH_LEN,
  MAGIC,
  PLAIN_HEADER_LEN,
  TAG_LEN,
  deriveKey,
  encodeHeader,
  parseHeader,
  trailerLength,
} from "../../src/main/services/vault-backup/container";
import { VaultBackupFailure } from "../../src/main/services/vault-backup/errors";

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof VaultBackupFailure ? e.code : `other:${String(e)}`;
  }
  return undefined;
}

describe("vault-backup container header", () => {
  it("header không mã hoá: 6 byte = magic + version + flags", () => {
    const h = encodeHeader({ encrypted: false });
    expect(h.length).toBe(PLAIN_HEADER_LEN);
    expect(h.subarray(0, 4).equals(MAGIC)).toBe(true);
    expect(h[4]).toBe(FORMAT_VERSION);
    expect(h[5]).toBe(0);
    expect(parseHeader(h)).toEqual({
      header: { encrypted: false },
      length: PLAIN_HEADER_LEN,
    });
    expect(trailerLength({ encrypted: false })).toBe(HASH_LEN);
  });

  it("header mã hoá: 38 byte, đọc lại đúng KDF/salt/iv", () => {
    const salt = Buffer.alloc(16, 7);
    const iv = Buffer.alloc(12, 9);
    const hdr = { encrypted: true as const, kdf: DEFAULT_KDF, salt, iv };
    const buf = encodeHeader(hdr);
    expect(buf.length).toBe(ENC_HEADER_LEN);
    expect(buf[5] & 1).toBe(1);
    const parsed = parseHeader(Buffer.concat([buf, Buffer.from("body")]));
    expect(parsed.length).toBe(ENC_HEADER_LEN);
    expect(parsed.header).toEqual(hdr);
    expect(trailerLength(hdr)).toBe(TAG_LEN);
  });

  it("sai magic / quá ngắn ⇒ notBackup", () => {
    expect(codeOf(() => parseHeader(Buffer.from("PK\u0003\u0004xx")))).toBe(
      "notBackup",
    );
    expect(codeOf(() => parseHeader(Buffer.from("IVB")))).toBe("notBackup");
    const enc = encodeHeader({
      encrypted: true,
      kdf: DEFAULT_KDF,
      salt: Buffer.alloc(16),
      iv: Buffer.alloc(12),
    });
    expect(codeOf(() => parseHeader(enc.subarray(0, 20)))).toBe("notBackup");
  });

  it("formatVersion lạ / KDF lạ hoặc tham số ngoài phạm vi ⇒ unsupportedFormat", () => {
    const h = encodeHeader({ encrypted: false });
    h[4] = 2;
    expect(codeOf(() => parseHeader(h))).toBe("unsupportedFormat");
    const enc = encodeHeader({
      encrypted: true,
      kdf: DEFAULT_KDF,
      salt: Buffer.alloc(16),
      iv: Buffer.alloc(12),
    });
    const badKdf = Buffer.from(enc);
    badKdf[6] = 9;
    expect(codeOf(() => parseHeader(badKdf))).toBe("unsupportedFormat");
    const hugeN = Buffer.from(enc);
    hugeN[7] = 30; // N = 2^30 ⇒ chống DoS bộ nhớ
    expect(codeOf(() => parseHeader(hugeN))).toBe("unsupportedFormat");
  });

  it("deriveKey: 32 byte, tất định theo (mật khẩu, salt), khác khi đổi mật khẩu", async () => {
    const kdf = { log2N: 10, r: 8, p: 1 };
    const salt = Buffer.alloc(16, 1);
    const a = await deriveKey("matkhau123", salt, kdf);
    const b = await deriveKey("matkhau123", salt, kdf);
    const c = await deriveKey("matkhau124", salt, kdf);
    expect(a.length).toBe(32);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
