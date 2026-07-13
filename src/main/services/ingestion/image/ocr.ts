import { createWorker } from "tesseract.js";
import { logEvent } from "../../../logging";
import { resolveCorePath } from "./ocr-path";
import type { OcrLine } from "./image-transcript";

// OCR ảnh bằng tesseract.js (053, Constitution III: chạy CHỈ main). Traineddata vie+eng tải lần đầu về
// cacheDir (data dir) → sau offline. I/O/wiring — loại coverage (phần thuần ở image-transcript.ts).
// KHÔNG log nội dung/đường dẫn ảnh.

export const OCR_LANG = "vie+eng";

export interface Ocr {
  /** OCR 1 ảnh → danh sách dòng chữ + bbox (pixel). onProgress(0..1). */
  recognize(
    imagePath: string,
    onProgress?: (frac: number) => void,
  ): Promise<OcrLine[]>;
}

interface TessLine {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}
interface TessBlock {
  paragraphs?: { lines?: TessLine[] }[];
}

export function createOcr(opts: {
  cacheDir: string;
  isPackaged: boolean;
  /** Bật/tắt chỉ báo egress khi TẢI traineddata lần đầu (Constitution I — badge khớp hành vi). */
  setOnline?: (online: boolean) => void;
}): Ocr {
  let workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null =
    null;

  const getWorker = (
    onProgress?: (frac: number) => void,
  ): Promise<Awaited<ReturnType<typeof createWorker>>> => {
    if (!workerPromise) {
      logEvent("image.ocr.load", { lang: OCR_LANG });
      // Lần đầu tải traineddata vie+eng qua mạng → báo egress; tắt khi tải xong (cache local).
      opts.setOnline?.(true);
      workerPromise = createWorker(OCR_LANG, 1, {
        cachePath: opts.cacheDir,
        corePath: resolveCorePath(opts.isPackaged),
        // Tiến độ tải/khởi tạo traineddata (0→0.5) — ADR C6, đối xứng progress_callback Whisper 045.
        logger: (m: { progress?: number }) => {
          if (typeof m.progress === "number") {
            onProgress?.(Math.max(0, Math.min(1, m.progress)) * 0.5);
          }
        },
      }).finally(() => opts.setOnline?.(false));
    }
    return workerPromise;
  };

  return {
    async recognize(imagePath, onProgress) {
      const worker = await getWorker(onProgress);
      onProgress?.(0.6);
      const { data } = await worker.recognize(imagePath, {}, { blocks: true });
      onProgress?.(1);
      const blocks = (data.blocks ?? []) as TessBlock[];
      const lines: OcrLine[] = [];
      for (const b of blocks) {
        for (const p of b.paragraphs ?? []) {
          for (const l of p.lines ?? []) {
            if (typeof l.text === "string" && l.text.trim() !== "") {
              lines.push({ text: l.text, bbox: l.bbox });
            }
          }
        }
      }
      return lines;
    },
  };
}
