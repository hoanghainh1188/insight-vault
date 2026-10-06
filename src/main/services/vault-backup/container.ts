import { scrypt as scryptCb, type ScryptOptions } from "node:crypto";
import { VaultBackupFailure } from "./errors";

// Container `.ivbackup` (085, research R4): header HỞ ‖ body (tar.gz, mã hoá AES-256-GCM nếu có mật khẩu) ‖
// trailer (GCM tag 16 B, hoặc SHA-256(header‖body) 32 B khi không mã hoá). Header làm AAD của GCM ⇒ sửa header
// bị phát hiện. Phần hở CHỈ lộ: magic, formatVersion, cờ mã hoá (+ tham số KDF/salt/iv) — FR-021a.

export const MAGIC = Buffer.from("IVBK", "ascii");
export const FORMAT_VERSION = 1;
const FLAG_ENCRYPTED = 0x01;
const KDF_SCRYPT = 1;

export const PLAIN_HEADER_LEN = 6;
export const SALT_LEN = 16;
export const IV_LEN = 12;
export const ENC_HEADER_LEN = PLAIN_HEADER_LEN + 4 + SALT_LEN + IV_LEN; // 38
export const TAG_LEN = 16;
export const HASH_LEN = 32;
export const KEY_LEN = 32;

export interface KdfParams {
  log2N: number;
  r: number;
  p: number;
}

/** scrypt N=2^17, r=8, p=1 (~128 MB RAM, ~0.2 s) — nằm trong header nên nâng được về sau. */
export const DEFAULT_KDF: KdfParams = { log2N: 17, r: 8, p: 1 };
// Giới hạn khi ĐỌC (file do người dùng chọn — chống tham số phình RAM/CPU).
const KDF_LIMITS = { log2N: [10, 20], r: [1, 16], p: [1, 4] } as const;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

export type ContainerHeader =
  | { encrypted: false }
  | { encrypted: true; kdf: KdfParams; salt: Buffer; iv: Buffer };

export function encodeHeader(h: ContainerHeader): Buffer {
  const head = Buffer.concat([
    MAGIC,
    Buffer.from([FORMAT_VERSION, h.encrypted ? FLAG_ENCRYPTED : 0]),
  ]);
  if (!h.encrypted) return head;
  return Buffer.concat([
    head,
    Buffer.from([KDF_SCRYPT, h.kdf.log2N, h.kdf.r, h.kdf.p]),
    h.salt,
    h.iv,
  ]);
}

function inRange(v: number, [lo, hi]: readonly [number, number]): boolean {
  return v >= lo && v <= hi;
}

/** Đọc header từ đầu file. Ném `notBackup` (sai magic/thiếu byte) hoặc `unsupportedFormat` (phiên bản/KDF lạ). */
export function parseHeader(buf: Buffer): {
  header: ContainerHeader;
  length: number;
} {
  if (buf.length < PLAIN_HEADER_LEN || !buf.subarray(0, 4).equals(MAGIC)) {
    throw new VaultBackupFailure("notBackup");
  }
  if (buf[4] !== FORMAT_VERSION) {
    throw new VaultBackupFailure("unsupportedFormat");
  }
  if ((buf[5] & FLAG_ENCRYPTED) === 0) {
    return { header: { encrypted: false }, length: PLAIN_HEADER_LEN };
  }
  if (buf.length < ENC_HEADER_LEN) throw new VaultBackupFailure("notBackup");
  const kdf: KdfParams = { log2N: buf[7], r: buf[8], p: buf[9] };
  if (
    buf[6] !== KDF_SCRYPT ||
    !inRange(kdf.log2N, KDF_LIMITS.log2N) ||
    !inRange(kdf.r, KDF_LIMITS.r) ||
    !inRange(kdf.p, KDF_LIMITS.p) ||
    // scrypt cần ~128·N·r byte — vượt maxmem ⇒ từ chối rõ ràng thay vì để scrypt ném (security N3)
    128 * 2 ** kdf.log2N * kdf.r > SCRYPT_MAXMEM
  ) {
    throw new VaultBackupFailure("unsupportedFormat");
  }
  const salt = Buffer.from(buf.subarray(10, 10 + SALT_LEN));
  const iv = Buffer.from(buf.subarray(10 + SALT_LEN, ENC_HEADER_LEN));
  return {
    header: { encrypted: true, kdf, salt, iv },
    length: ENC_HEADER_LEN,
  };
}

export function headerLength(h: ContainerHeader): number {
  return h.encrypted ? ENC_HEADER_LEN : PLAIN_HEADER_LEN;
}

export function trailerLength(h: ContainerHeader): number {
  return h.encrypted ? TAG_LEN : HASH_LEN;
}

/** Dẫn xuất khoá AES-256 từ mật khẩu (scrypt built-in). Mật khẩu không bao giờ được log/lưu. */
export function deriveKey(
  password: string,
  salt: Buffer,
  kdf: KdfParams,
): Promise<Buffer> {
  const opts: ScryptOptions = {
    N: 2 ** kdf.log2N,
    r: kdf.r,
    p: kdf.p,
    maxmem: SCRYPT_MAXMEM,
  };
  return new Promise((resolve, reject) => {
    scryptCb(password.normalize("NFC"), salt, KEY_LEN, opts, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}
