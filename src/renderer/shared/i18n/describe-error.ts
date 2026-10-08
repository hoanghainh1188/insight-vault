import type { Translator } from "@shared/i18n";
import { parseIpcError, type ParsedIpcError } from "@shared/online-error-tag";

// 123 (FR-008, contracts/codes.md §2): lỗi IPC ⇒ câu cho người dùng theo ngôn ngữ HIỆN TẠI. Lưu ParsedIpcError trong
// state (không lưu chuỗi đã dịch) và gọi hàm này lúc render ⇒ đổi ngôn ngữ thì thông báo lỗi cũng đổi.
// Lỗi không thẻ (lỗi lập trình, lỗi hệ thống) ⇒ câu chung; chi tiết đã có trong nhật ký main (088).

export function describeIpcError(p: ParsedIpcError, tr: Translator): string {
  if (p.code) return tr.t(`errors.${p.code}`, (p.params ?? {}) as never);
  if (p.onlineKind) {
    const text = tr.t(`online.${p.onlineKind}`);
    return p.provider ? `${p.provider}: ${text}` : text;
  }
  return tr.t("errors.unexpected");
}

/** Tiện ích cho catch (e: unknown). */
export function toParsedError(e: unknown): ParsedIpcError {
  const raw =
    e instanceof Error
      ? e.message
      : typeof e === "string"
        ? e
        : String(e ?? "");
  return parseIpcError(raw);
}

export function describeError(e: unknown, tr: Translator): string {
  return describeIpcError(toParsedError(e), tr);
}
