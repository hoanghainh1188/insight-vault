import type { SourceKind } from "@shared/ipc/types";
import type { PageText } from "../chunker";

// Kết quả parse chuẩn hoá cho mọi loại nguồn. Pipeline sẽ làm sạch từng page rồi chunk.
export interface ParseResult {
  /** Tiêu đề suy từ nguồn (URL: tiêu đề trang). File: pipeline dùng tên tệp nếu không có. */
  title?: string;
  /** PDF → số trang; loại khác → null. */
  pageCount: number | null;
  /** Văn bản theo trang (PDF nhiều trang; loại khác 1 phần tử page=null). */
  pages: PageText[];
}

const EXT_KIND: Record<string, SourceKind> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "md",
  markdown: "md",
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
