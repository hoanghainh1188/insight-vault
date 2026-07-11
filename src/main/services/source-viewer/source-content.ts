import type { SourceContent } from "@shared/ipc/types";
import type { SourceRepo } from "../ingestion/source-repo";
import { derivePageBreaks, reconstructText } from "./reconstruct";

// Assembly: dựng SourceContent để hiển thị ở viewer, ĐỌC dữ liệu 011 (source-repo). CHỈ ở main.
// KHÔNG re-parse file / re-fetch URL (Constitution I) — tái dựng từ chunk đã lưu. KHÔNG log content.

/** Trả nội dung nguồn để hiển thị; null nếu nguồn không còn tồn tại (A7). */
export function getSourceContent(
  sourceRepo: SourceRepo,
  sourceId: string,
): SourceContent | null {
  if (typeof sourceId !== "string" || sourceId === "") return null;
  const source = sourceRepo.getById(sourceId);
  if (!source) return null;

  const chunks = sourceRepo.listChunks(sourceId);
  return {
    kind: source.kind,
    title: source.title,
    pageCount: source.pageCount,
    text: reconstructText(chunks),
    pageBreaks: derivePageBreaks(chunks),
  };
}
