import { createReadStream, createWriteStream, existsSync } from "node:fs";
import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Segment } from "../ingestion/audio/audio-transcript";
import { parseWorkerMessage } from "./asr-protocol";
import { createCaptureSegmentWriter } from "./capture-writer";
import type { MeetingFiles } from "./meeting-service";
import { segmentFileName, type CaptureSegment } from "./segments";
import { WAV_HEADER_BYTES, buildWavHeader, repairWavHeader } from "./wav";

// 186 — tệp của phiên ghi trong <userData>/meetings/<sessionId>/ (I/O, research R3/R8/R10, data-model §3). App SỞ HỮU các
// tệp này (ngoại lệ 049 #2): xoá cùng nguồn, có trong sao lưu. sessionId do main sinh (UUID) — vẫn kiểm định dạng để
// không bao giờ thoát khỏi thư mục gốc. Không log nội dung.

const SESSION_ID = /^[0-9a-f-]{8,64}$/i;
const MERGED = "meeting.wav";

export interface MeetingFilesIo extends MeetingFiles {
  mergedPath(sessionId: string): string;
  hasMerged(sessionId: string): boolean;
  sessionDir(sessionId: string): string;
}

export function createMeetingFiles(
  root: string,
  opts: { fsyncSec: number },
): MeetingFilesIo {
  const sessionDir = (sessionId: string): string => {
    if (!SESSION_ID.test(sessionId))
      throw new Error("invalid meeting session id");
    return join(root, sessionId);
  };
  const segmentPath = (sessionId: string, index: number): string => {
    if (!Number.isInteger(index) || index < 0)
      throw new Error("invalid segment index");
    return join(sessionDir(sessionId), segmentFileName(index));
  };
  const finalPath = (sessionId: string, index: number): string =>
    join(
      sessionDir(sessionId),
      "final",
      `seg-${String(index).padStart(4, "0")}.json`,
    );
  const mergedPath = (sessionId: string): string =>
    join(sessionDir(sessionId), MERGED);

  const writeAtomic = async (path: string, data: string): Promise<void> => {
    const tmp = `${path}.tmp`;
    await writeFile(tmp, data, { mode: 0o600 });
    await rename(tmp, path);
  };

  return {
    meetingsRoot: root,
    sessionDir,
    segmentPath,
    mergedPath,
    hasMerged: (sessionId) => existsSync(mergedPath(sessionId)),

    async ensureSessionDir(sessionId) {
      await mkdir(sessionDir(sessionId), { recursive: true, mode: 0o700 });
    },

    openWriter: (sessionId, index, onError) =>
      createCaptureSegmentWriter(segmentPath(sessionId, index), {
        fsyncSec: opts.fsyncSec,
        onError,
      }),

    async repairSegments(sessionId, segments) {
      const out: CaptureSegment[] = [];
      for (const s of segments) {
        const p = segmentPath(sessionId, s.index);
        let size: number;
        try {
          size = (await stat(p)).size;
        } catch {
          out.push({ ...s, samples: 0, closed: true });
          continue;
        }
        const { dataBytes, header } = repairWavHeader(size);
        const fh = await open(p, "r+");
        try {
          await fh.write(header, 0, WAV_HEADER_BYTES, 0);
          await fh.truncate(WAV_HEADER_BYTES + dataBytes);
          await fh.sync();
        } finally {
          await fh.close();
        }
        out.push({ ...s, samples: dataBytes / 2, closed: true });
      }
      return out;
    },

    async readFinal(sessionId, index) {
      let raw: string;
      try {
        raw = await readFile(finalPath(sessionId, index), "utf8");
      } catch {
        return null;
      }
      try {
        const parsed = parseWorkerMessage({
          type: "result",
          reqId: "checkpoint",
          segments: JSON.parse(raw),
        });
        return parsed && parsed.type === "result" ? parsed.segments : null;
      } catch {
        return null;
      }
    },

    async writeFinal(sessionId, index, segments: readonly Segment[]) {
      await mkdir(join(sessionDir(sessionId), "final"), {
        recursive: true,
        mode: 0o700,
      });
      await writeAtomic(finalPath(sessionId, index), JSON.stringify(segments));
    },

    async mergeSegments(sessionId, segments) {
      const tmp = `${mergedPath(sessionId)}.tmp`;
      let total = 0;
      const out = createWriteStream(tmp, { mode: 0o600 });
      out.write(Buffer.from(buildWavHeader(0)));
      for (const s of segments) {
        const p = segmentPath(sessionId, s.index);
        if (!existsSync(p)) continue;
        const size = (await stat(p)).size;
        if (size <= WAV_HEADER_BYTES) continue;
        const bytes = size - WAV_HEADER_BYTES - ((size - WAV_HEADER_BYTES) % 2);
        total += bytes;
        await pipeline(
          createReadStream(p, {
            start: WAV_HEADER_BYTES,
            end: WAV_HEADER_BYTES + bytes - 1,
          }),
          out,
          {
            end: false,
          },
        );
      }
      await new Promise<void>((resolve, reject) =>
        out.end((e?: Error | null) => (e ? reject(e) : resolve())),
      );
      const fh = await open(tmp, "r+");
      try {
        await fh.write(buildWavHeader(total), 0, WAV_HEADER_BYTES, 0);
        await fh.sync();
      } finally {
        await fh.close();
      }
      await rename(tmp, mergedPath(sessionId));
    },

    async deleteSegments(sessionId, segments) {
      for (const s of segments)
        await rm(segmentPath(sessionId, s.index), { force: true });
      await rm(join(sessionDir(sessionId), "final"), {
        recursive: true,
        force: true,
      });
    },

    async deleteSession(sessionId) {
      await rm(sessionDir(sessionId), { recursive: true, force: true });
    },
  };
}
