import { UserFacingError } from "@shared/codes/user-error";
import type { RagMode, RagTurn } from "@shared/ipc/types";
import { MAX_QUESTION_LEN, MAX_HISTORY_CONTENT_LEN } from "./constants";

// Validate input rag:ask ở boundary (FR-013, Constitution III "validate at boundaries"). Hàm THUẦN.

/** Số lượng lượt lịch sử tối đa NHẬN vào (trước khi cắt MAX_HISTORY_TURNS gửi cho model). */
export const MAX_HISTORY_ITEMS = 50;

/** Trim + kiểm non-empty + ≤ MAX_QUESTION_LEN. Ném lỗi thân thiện nếu sai. Trả câu hỏi đã trim. */
export function validateQuestion(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("Invalid question.");
  const q = raw.trim();
  if (q === "") throw new UserFacingError("questionEmpty");
  if (q.length > MAX_QUESTION_LEN) {
    throw new UserFacingError("questionTooLong", { max: MAX_QUESTION_LEN });
  }
  return q;
}

/**
 * Kiểm mode đúng 2 giá trị. Ném nếu lạ — KHÔNG âm thầm hạ về 'open' (tránh bỏ qua ràng buộc "không bịa"
 * của chế độ grounded — Constitution II).
 */
export function validateMode(raw: unknown): RagMode {
  if (raw === "grounded" || raw === "open") return raw;
  throw new Error("Invalid answer mode.");
}

/** Kiểm lịch sử hội thoại: mảng ≤ MAX_HISTORY_ITEMS, mỗi lượt role hợp lệ + content chuỗi ≤ giới hạn. */
export function validateHistory(raw: unknown): RagTurn[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new Error("Invalid conversation history.");
  if (raw.length > MAX_HISTORY_ITEMS) {
    throw new UserFacingError("historyTooLong");
  }
  return raw.map((t): RagTurn => {
    const role = (t as { role?: unknown })?.role;
    const content = (t as { content?: unknown })?.content;
    if (
      (role !== "user" && role !== "assistant") ||
      typeof content !== "string" ||
      content.length > MAX_HISTORY_CONTENT_LEN
    ) {
      throw new Error("Invalid conversation history.");
    }
    return { role, content };
  });
}
