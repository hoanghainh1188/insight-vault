import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import type { SourceRepo } from "../ingestion/source-repo";
import {
  extOf,
  isServableMediaExt,
  mimeForAudioExt,
  parseRange,
} from "./media-range";

// Phục vụ file audio gốc cho player renderer qua giao thức iv-media:// (049, Pha 2a-player). Renderer
// sandbox KHÔNG đọc FS → main stream file theo sourceId (tra DB, KHÔNG nhận path từ renderer — Constitution
// III). Hỗ trợ Range để <audio> seek. Tham chiếu file GỐC (không copy v1); file gốc mất → 404 (vẫn xem
// transcript). Hàm thuần (parseRange/mimeForAudioExt/extOf) ở media-range.ts (test); file này I/O (exclude).

/**
 * 186: tệp phát lại của nguồn cuộc họp (meeting.wav khi đã ghép, ngược lại phân đoạn `seg`). Do main tra từ DB +
 * thư mục phiên — KHÔNG bao giờ nhận đường dẫn từ renderer. null ⇒ 404.
 */
export type MeetingPlaybackResolver = (
  sourceId: string,
  seg: number | undefined,
) => string | null;

/** Chỉ số phân đoạn trong query `?seg=` — chữ số thuần; thiếu ⇒ undefined; sai ⇒ null (404). */
function parseSeg(url: URL): number | undefined | null {
  const raw = url.searchParams.get("seg");
  if (raw === null) return undefined;
  return /^\d{1,6}$/.test(raw) ? Number(raw) : null;
}

/** Handler cho protocol.handle("iv-media", ...). URL: iv-media://source/<id>[?seg=n]. Audio (049)/video (051)/image (053)/cuộc họp (186). */
export function createMediaHandler(
  sourceRepo: SourceRepo,
  resolveMeeting?: MeetingPlaybackResolver,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    const id = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const source = id ? sourceRepo.getById(id) : null;
    if (source?.kind === "meeting") {
      const seg = parseSeg(url);
      const path =
        seg === null || !resolveMeeting ? null : resolveMeeting(id, seg);
      if (!path || !existsSync(path))
        return new Response(null, { status: 404 });
      return serveFile(path, "audio/wav", request);
    }
    // 049 audio + 051 video + 053 image — chỉ phục vụ nguồn media (đọc file gốc); loại khác → 404.
    if (
      !source ||
      (source.kind !== "audio" &&
        source.kind !== "video" &&
        source.kind !== "image")
    ) {
      return new Response(null, { status: 404 });
    }
    const path = sourceRepo.getOrigin(id);
    // 085 S4: origin có thể đến từ bản sao lưu khôi phục ⇒ chỉ phục vụ đuôi media đã biết.
    if (!path || !isServableMediaExt(extOf(path)) || !existsSync(path)) {
      return new Response(null, { status: 404 });
    }

    return serveFile(path, mimeForAudioExt(extOf(path)), request);
  };
}

/** Stream tệp (Range ⇒ 206) — dùng chung cho tệp gốc và audio cuộc họp. */
function serveFile(path: string, mime: string, request: Request): Response {
  const size = statSync(path).size;
  const range = parseRange(request.headers.get("Range"), size);
  if (range) {
    const stream = createReadStream(path, {
      start: range.start,
      end: range.end,
    });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type": mime,
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": String(range.end - range.start + 1),
      },
    });
  }
  return new Response(
    Readable.toWeb(createReadStream(path)) as ReadableStream,
    {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Accept-Ranges": "bytes",
        "Content-Length": String(size),
      },
    },
  );
}
