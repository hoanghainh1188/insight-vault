import type { SourceContent } from "@shared/ipc/types";
import type { SourceRepo } from "../ingestion/source-repo";
import { derivePageBreaks, reconstructText } from "./reconstruct";

// Assembly: dựng SourceContent để hiển thị ở viewer, ĐỌC dữ liệu 011 (source-repo). CHỈ ở main.
// KHÔNG re-parse file / re-fetch URL (Constitution I) — tái dựng từ chunk đã lưu. KHÔNG log content.

/** 112: yêu cầu nội dung kèm chunkId của trích dẫn ⇒ trả thêm citationValid (chunk còn thuộc nguồn hay không). */
export interface SourceContentRequest {
  sourceId: string;
  chunkId?: string;
}

function parseRequest(
  req: unknown,
): { sourceId: string; chunkId?: string } | null {
  if (typeof req === "string") return req === "" ? null : { sourceId: req };
  if (!req || typeof req !== "object") return null;
  const { sourceId, chunkId } = req as Record<string, unknown>;
  if (typeof sourceId !== "string" || sourceId === "") return null;
  if (chunkId !== undefined && typeof chunkId !== "string") return null;
  return chunkId === undefined ? { sourceId } : { sourceId, chunkId };
}

/** Trả nội dung nguồn để hiển thị; null nếu nguồn không còn tồn tại (A7). */
export function getSourceContent(
  sourceRepo: SourceRepo,
  request: string | SourceContentRequest,
): SourceContent | null {
  const req = parseRequest(request);
  if (!req) return null;
  const source = sourceRepo.getById(req.sourceId);
  if (!source) return null;

  const chunks = sourceRepo.listChunks(req.sourceId);
  const content: SourceContent = {
    kind: source.kind,
    title: source.title,
    pageCount: source.pageCount,
    text: reconstructText(chunks),
    pageBreaks: derivePageBreaks(chunks),
  };
  // Trích dẫn cũ: chunk id không còn thuộc nguồn (nguồn đã được xử lý lại ⇒ chunk mới, id mới) — research R12.
  return req.chunkId === undefined
    ? content
    : { ...content, citationValid: chunks.some((c) => c.id === req.chunkId) };
}
