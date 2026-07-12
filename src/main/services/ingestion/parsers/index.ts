import type { SourceKind } from "@shared/ipc/types";
import type { PageText } from "../chunker";
import type { TimeMapEntry } from "../audio/audio-transcript";

// Kết quả parse chuẩn hoá cho mọi loại nguồn. Pipeline sẽ làm sạch từng page rồi chunk.
export interface ParseResult {
  /** Tiêu đề suy từ nguồn (URL: tiêu đề trang). File: pipeline dùng tên tệp nếu không có. */
  title?: string;
  /** PDF → số trang; loại khác → null. */
  pageCount: number | null;
  /** Văn bản theo trang (PDF nhiều trang; loại khác 1 phần tử page=null). */
  pages: PageText[];
  /** Audio (045): map char↔time để gắn tStart/tEnd cho chunk sau khi chunk theo char. */
  timeMap?: TimeMapEntry[];
}

const EXT_KIND: Record<string, SourceKind> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "md",
  markdown: "md",
  // audio (045, Pha 2a) — wav/mp3/flac/ogg (m4a/aac cần ffmpeg → 2b)
  wav: "audio",
  mp3: "audio",
  flac: "audio",
  ogg: "audio",
};

/** Suy loại nguồn từ đuôi tệp (thuần, unit-test được). Ném nếu không hỗ trợ. */
export function detectKindFromPath(
  filePath: string,
): Exclude<SourceKind, "url"> {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const kind = EXT_KIND[ext];
  if (!kind || kind === "url") {
    throw new Error(`Định dạng tệp không hỗ trợ: .${ext}`);
  }
  return kind;
}

/** Tên hiển thị mặc định từ đường dẫn tệp (basename). */
export function titleFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}
