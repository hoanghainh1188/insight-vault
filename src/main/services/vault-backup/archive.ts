import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
  type Hash,
} from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  type WriteStream,
} from "node:fs";
import { once } from "node:events";
import {
  appendFile,
  chmod,
  mkdir,
  open,
  readdir,
  rename,
  rm,
  stat,
  statfs,
  type FileHandle,
} from "node:fs/promises";
import { dirname, join, posix } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";
import {
  DEFAULT_KDF,
  ENC_HEADER_LEN,
  IV_LEN,
  SALT_LEN,
  deriveKey,
  encodeHeader,
  headerLength,
  parseHeader,
  trailerLength,
  type ContainerHeader,
  type KdfParams,
} from "./container";
import { VaultBackupFailure, toFailure } from "./errors";

// Đóng gói / giải nén `.ivbackup` (085, research R3–R5). Stream toàn bộ — RAM không tỉ lệ kích thước vault.

/** Thứ tự entry trong tar (manifest đầu tiên). `vectors` là thư mục. */
export const BACKUP_ENTRIES = [
  "manifest.json",
  "insightvault.db",
  "config.json",
  "vectors",
] as const;
const TOP_FILES = new Set(["manifest.json", "insightvault.db", "config.json"]);

export interface PackOptions {
  password?: string;
  kdf?: KdfParams;
}

export interface UnpackOptions {
  password?: string;
}

/** Allowlist entry khi giải nén (FR-025): chỉ File/Directory thuộc 4 thành phần cho phép. */
export function isAllowedEntry(rawPath: string, type: string): boolean {
  if (/[\\:]/.test(rawPath)) return false; // `\` / ổ đĩa Windows — không bao giờ có trong bản do app tạo
  const p = posix.normalize(rawPath.replace(/^\.\//, ""));
  if (p.startsWith("/") || p.split("/").includes("..")) return false;
  if (TOP_FILES.has(p)) return type === "File";
  if (p === "vectors" || p === "vectors/") return type === "Directory";
  if (p.startsWith("vectors/")) return type === "File" || type === "Directory";
  return false;
}

function hashTap(hash: Hash): Transform {
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      hash.update(chunk);
      cb(null, chunk);
    },
  });
}

/** Tap đếm SHA-256 và so trailer ở cuối stream (file không mã hoá) — lệch ⇒ pipeline lỗi. */
function verifyingHashTap(headerBytes: Buffer, expected: Buffer): Transform {
  const hash = createHash("sha256").update(headerBytes);
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      hash.update(chunk);
      cb(null, chunk);
    },
    flush(cb) {
      const actual = hash.digest();
      cb(
        actual.length === expected.length && timingSafeEqual(actual, expected)
          ? null
          : new VaultBackupFailure("badPasswordOrCorrupt"),
      );
    },
  });
}

/**
 * Đóng gói `srcDir` (snapshot) thành `outPath`: ghi `<out>.part` rồi rename khi xong (FR-007). Lỗi ⇒ xoá
 * `.part`, ném `diskFull`/`ioError`. Có mật khẩu ⇒ AES-256-GCM (AAD = header), salt/iv ngẫu nhiên mỗi file.
 */
export async function packToFile(
  srcDir: string,
  outPath: string,
  opts: PackOptions,
): Promise<{ sizeBytes: number }> {
  const part = `${outPath}.part`;
  let fh: FileHandle | null = null;
  let out: WriteStream | null = null;
  try {
    const entries = BACKUP_ENTRIES.filter((e) => existsSync(join(srcDir, e)));
    let header: ContainerHeader = { encrypted: false };
    let key: Buffer | null = null;
    if (opts.password !== undefined) {
      const kdf = opts.kdf ?? DEFAULT_KDF;
      const salt = randomBytes(SALT_LEN);
      header = { encrypted: true, kdf, salt, iv: randomBytes(IV_LEN) };
      key = await deriveKey(opts.password, salt, kdf);
    }
    const headerBytes = encodeHeader(header);

    // `.part` mồ côi từ lần crash trước không được chặn lần sao lưu này. Chỉ chủ sở hữu đọc được (0600).
    await rm(part, { force: true });
    fh = await open(part, "wx", 0o600);
    await fh.write(headerBytes);
    // Stream sở hữu fh (autoClose) — pipeline chỉ resolve sau khi fh đã đóng.
    out = fh.createWriteStream({ start: headerBytes.length });
    // follow:true ⇒ symlink trong vectors/ (nếu có) được ghi thành file thường — bản sao lưu luôn qua allowlist.
    const source = tar.c(
      { gzip: true, portable: true, follow: true, cwd: srcDir },
      [...entries],
    );

    let trailer: Buffer;
    if (header.encrypted && key) {
      const cipher = createCipheriv("aes-256-gcm", key, header.iv);
      cipher.setAAD(headerBytes);
      await pipeline(source, cipher, out);
      trailer = cipher.getAuthTag();
    } else {
      const hash = createHash("sha256").update(headerBytes);
      await pipeline(source, hashTap(hash), out);
      trailer = hash.digest();
    }
    fh = null;
    await appendFile(part, trailer);
    await rename(part, outPath);
    return { sizeBytes: (await stat(outPath)).size };
  } catch (e) {
    // Đóng handle TRƯỚC khi xoá (Windows không xoá được file đang mở — FR-007 không để file dở).
    if (out && !out.closed) await once(out, "close").catch(() => undefined);
    else if (fh && !out) await fh.close().catch(() => undefined);
    await rm(part, { force: true }).catch(() => undefined);
    throw toFailure(e, "ioError");
  }
}

interface OpenedContainer {
  header: ContainerHeader;
  headerBytes: Buffer;
  trailer: Buffer;
  size: number;
}

async function openContainer(file: string): Promise<OpenedContainer> {
  let fh;
  try {
    fh = await open(file, "r");
  } catch (e) {
    throw toFailure(e, "ioError");
  }
  try {
    const size = (await fh.stat()).size;
    const head = Buffer.alloc(ENC_HEADER_LEN);
    const { bytesRead } = await fh.read(head, 0, ENC_HEADER_LEN, 0);
    const { header } = parseHeader(head.subarray(0, bytesRead));
    const hLen = headerLength(header);
    const tLen = trailerLength(header);
    if (size < hLen + tLen + 1) throw new VaultBackupFailure("notBackup");
    const trailer = Buffer.alloc(tLen);
    await fh.read(trailer, 0, tLen, size - tLen);
    return {
      header,
      headerBytes: Buffer.from(head.subarray(0, hLen)),
      trailer,
      size,
    };
  } catch (e) {
    throw toFailure(e, "notBackup");
  } finally {
    await fh.close();
  }
}

/** Đọc riêng header hở (để biết file có mã hoá không) — không giải mã gì. */
export async function readContainerHeader(
  file: string,
): Promise<ContainerHeader> {
  return (await openContainer(file)).header;
}

/** Bước 1: giải mã/kiểm hash body ra file tạm `payload` (tar.gz). Chỉ xong khi GCM final / SHA-256 khớp. */
async function verifyToPayload(
  file: string,
  c: OpenedContainer,
  password: string | undefined,
  payload: string,
): Promise<void> {
  const body = createReadStream(file, {
    start: c.headerBytes.length,
    end: c.size - c.trailer.length - 1,
  });
  let stage: Transform;
  if (c.header.encrypted) {
    const key = await deriveKey(
      password as string,
      c.header.salt,
      c.header.kdf,
    );
    const decipher = createDecipheriv("aes-256-gcm", key, c.header.iv);
    decipher.setAAD(c.headerBytes);
    decipher.setAuthTag(c.trailer);
    stage = decipher;
  } else {
    stage = verifyingHashTap(c.headerBytes, c.trailer);
  }
  await pipeline(
    body,
    stage,
    createWriteStream(payload, { flags: "wx", mode: 0o600 }),
  );
}

/** manifest.json / config.json là JSON nhỏ — chặn file khổng lồ trước khi `JSON.parse` (security S2). */
export const MAX_META_ENTRY_BYTES = 1024 * 1024;
const FREE_SPACE_MARGIN = 64 * 1024 * 1024;

/**
 * Bước 2: liệt kê toàn bộ entry (đã xác thực) — 1 entry ngoài allowlist / cảnh báo / file meta quá lớn ⇒ từ chối
 * cả file. Trả tổng kích thước giải nén (để kiểm dung lượng trống trước — chống "bom giải nén" làm đầy đĩa).
 */
async function inspectEntries(payload: string): Promise<number> {
  let rejected = false;
  let total = 0;
  await tar.t({
    file: payload,
    strict: true,
    onReadEntry: (entry) => {
      const size = entry.size ?? 0;
      total += size;
      if (
        !isAllowedEntry(entry.path, String(entry.type)) ||
        (TOP_FILES.has(entry.path) &&
          entry.path !== "insightvault.db" &&
          size > MAX_META_ENTRY_BYTES)
      ) {
        rejected = true;
      }
      entry.resume();
    },
    onwarn: () => {
      rejected = true;
    },
  });
  if (rejected) throw new VaultBackupFailure("badPasswordOrCorrupt");
  return total;
}

async function assertFreeSpace(dir: string, needBytes: number): Promise<void> {
  const fs = await statfs(dir);
  if (fs.bavail * fs.bsize < needBytes + FREE_SPACE_MARGIN) {
    throw new VaultBackupFailure("diskFull");
  }
}

/** Quyền từ tar do file người dùng chọn quyết định ⇒ chuẩn hoá về 0700 (thư mục) / 0600 (file). */
async function normalizeModes(dir: string): Promise<void> {
  await chmod(dir, 0o700);
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await normalizeModes(p);
    else await chmod(p, 0o600);
  }
}

/**
 * Giải mã (nếu có) + kiểm toàn vẹn + giải nén vào `destDir` (tạo mới). Trình phân tích tar CHỈ đọc dữ liệu ĐÃ
 * XÁC THỰC: body được giải mã/kiểm SHA-256 ra file tạm cạnh `destDir` trước, sau đó mới liệt kê kiểm allowlist rồi
 * giải nén (filter giữ làm phòng thủ chiều sâu). Mọi lỗi ⇒ xoá `destDir` + file tạm, ném `badPasswordOrCorrupt`
 * (gộp sai mật khẩu + hỏng/sửa đổi — R4) hoặc `diskFull`.
 */
export async function unpackToDir(
  file: string,
  destDir: string,
  opts: UnpackOptions,
): Promise<void> {
  const c = await openContainer(file);
  if (c.header.encrypted && opts.password === undefined) {
    throw new VaultBackupFailure("passwordRequired");
  }
  const payload = `${destDir}.payload-${randomBytes(6).toString("hex")}.tgz`;
  try {
    await rm(destDir, { recursive: true, force: true });
    await mkdir(dirname(destDir), { recursive: true, mode: 0o700 });
    await assertFreeSpace(dirname(destDir), c.size);
    await verifyToPayload(file, c, opts.password, payload);
    const total = await inspectEntries(payload);
    await assertFreeSpace(dirname(destDir), total);
    await mkdir(destDir, { recursive: true, mode: 0o700 });
    await tar.x({
      file: payload,
      cwd: destDir,
      strict: true,
      filter: (path, entry) =>
        isAllowedEntry(path, "type" in entry ? String(entry.type) : ""),
    });
    await normalizeModes(destDir);
  } catch (e) {
    await rm(destDir, { recursive: true, force: true }).catch(() => undefined);
    throw toFailure(e, "badPasswordOrCorrupt");
  } finally {
    await rm(payload, { force: true }).catch(() => undefined);
  }
}
