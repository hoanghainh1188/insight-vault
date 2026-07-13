import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import type { SourceRepo } from "../ingestion/source-repo";
import { extOf, mimeForAudioExt, parseRange } from "./media-range";

// Phục vụ file audio gốc cho player renderer qua giao thức iv-media:// (049, Pha 2a-player). Renderer
// sandbox KHÔNG đọc FS → main stream file theo sourceId (tra DB, KHÔNG nhận path từ renderer — Constitution
// III). Hỗ trợ Range để <audio> seek. Tham chiếu file GỐC (không copy v1); file gốc mất → 404 (vẫn xem
// transcript). Hàm thuần (parseRange/mimeForAudioExt/extOf) ở media-range.ts (test); file này I/O (exclude).

/** Handler cho protocol.handle("iv-media", ...). URL: iv-media://source/<id>. Nguồn audio (049)/video (051)/image (053). */
export function createMediaHandler(
  sourceRepo: SourceRepo,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    const id = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const source = id ? sourceRepo.getById(id) : null;
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
    if (!path || !existsSync(path)) return new Response(null, { status: 404 });

    const size = statSync(path).size;
    const mime = mimeForAudioExt(extOf(path));
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
  };
}
