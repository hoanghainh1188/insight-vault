import { tagOnlineError } from "@shared/online-error-tag";
import { OnlineProviderError } from "./online/online-error";

// 098 — đích AI theo lượt (ADR 2026-10-07-online-fallback-clarify): mặc định provider đang bật; "local" = Ollama
// cho MỌI lệnh LLM của lượt (gồm cả viết lại câu hỏi) — người dùng bấm "Trả lời bằng AI cục bộ" sau lỗi online.

import type { AiTarget } from "@shared/ipc/types";
export type { AiTarget };

/** Đọc `target` từ đầu vào IPC (không tin cậy). Thiếu ⇒ active; giá trị lạ ⇒ ném. */
export function parseAiTarget(input: unknown): AiTarget {
  const t =
    input !== null && typeof input === "object"
      ? (input as { target?: unknown }).target
      : undefined;
  if (t === undefined || t === "active") return "active";
  if (t === "local") return "local";
  throw new Error("Invalid AI target.");
}

/** Ném lại lỗi cho IPC: lỗi provider online được gắn thẻ loại để renderer hiện nút chuyển về AI cục bộ. */
export function rethrowForIpc(e: unknown): never {
  if (e instanceof OnlineProviderError) {
    throw new Error(tagOnlineError(e.message, e.kind));
  }
  throw e;
}

/** Phần registry cần để chọn provider (thuần, test được với registry giả). */
export interface ProviderSource<P> {
  getActive(): P;
  get(id: string): P;
}

/** Chọn provider cho lượt: "local" LUÔN là Ollama (không lệnh LLM nào ra ngoài); "active" = provider đang bật. */
export function pickProvider<P>(
  registry: ProviderSource<P>,
  target: AiTarget,
): P {
  return target === "local" ? registry.get("ollama") : registry.getActive();
}
