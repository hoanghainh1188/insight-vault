import { open, type FileHandle } from "node:fs/promises";
import type { SegmentWriter } from "./meeting-service";
import { WAV_HEADER_BYTES, buildWavHeader } from "./wav";

// 186 — ghi MỘT phân đoạn WAV PCM16 tăng dần (I/O, research R3/D9). Header 0 lúc mở; PCM ghi nối tiếp qua chuỗi
// promise (append không chờ đĩa); fsync mỗi `fsyncSec` ⇒ sự cố mất ≤ fsyncSec; close() ghi header đúng + fsync.
// Lỗi I/O báo MỘT lần qua onError (service đóng phiên an toàn). Không đọc/log nội dung audio.

export function createSegmentWriter(
  path: string,
  opts: { fsyncSec: number; now?: () => number; onError: (e: unknown) => void },
): SegmentWriter {
  const now = opts.now ?? Date.now;
  let samples = 0;
  let position = WAV_HEADER_BYTES;
  let lastSync = now();
  let failed = false;
  let closed = false;
  let fh: FileHandle | null = null;

  const fail = (e: unknown): void => {
    if (failed) return;
    failed = true;
    opts.onError(e);
  };

  let chain: Promise<void> = (async () => {
    fh = await open(path, "w", 0o600);
    await fh.write(buildWavHeader(0), 0, WAV_HEADER_BYTES, 0);
  })().catch(fail);

  return {
    append(bytes) {
      if (closed || failed || bytes.byteLength === 0) return;
      const copy = Buffer.from(bytes); // nguồn có thể bị tái dùng sau khi trả về
      const at = position;
      position += copy.byteLength;
      samples += copy.byteLength / 2;
      chain = chain
        .then(async () => {
          if (failed || !fh) return;
          await fh.write(copy, 0, copy.byteLength, at);
          if (now() - lastSync >= opts.fsyncSec * 1000) {
            lastSync = now();
            await fh.sync();
          }
        })
        .catch(fail);
    },
    samples: () => samples,
    async close() {
      if (closed) return samples;
      closed = true;
      await chain;
      const handle = fh as FileHandle | null;
      if (handle) {
        try {
          await handle.write(
            buildWavHeader(position - WAV_HEADER_BYTES),
            0,
            WAV_HEADER_BYTES,
            0,
          );
          await handle.sync();
        } catch (e) {
          fail(e);
        } finally {
          await handle.close().catch(() => undefined);
        }
      }
      return samples;
    },
  };
}
