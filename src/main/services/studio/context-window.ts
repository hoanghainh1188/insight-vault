import { STUDIO_CONTEXT_BUDGET } from "./constants";

// 105 — ngân sách ký tự Studio theo CỬA SỔ NGỮ CẢNH thật của model (ADR 2026-10-07-studio-large-clarify). Thuần.

/**
 * Trần num_ctx cho Ollama — KV cache tốn RAM/VRAM tỉ lệ thuận (model 8B @32k ≈ 4GB+), prefill prompt lớn chậm trên
 * máy cá nhân. 16K ≈ 33.000 ký tự tiếng Việt mỗi lượt (gấp đôi ngân sách cũ) — vượt thì map-reduce (review 105).
 */
export const OLLAMA_MAX_NUM_CTX = 16384;
/** Trần ký tự cho provider online (cửa sổ rất lớn) — giới hạn chi phí/độ trễ trên key của người dùng. */
export const ONLINE_MAX_CHARS = 120_000;
/** Hệ số ký tự/token THẬN TRỌNG cho tiếng Việt (tokenizer chia nhỏ chữ có dấu). */
export const CHARS_PER_TOKEN = 2.5;
/** Dự phòng token cho câu trả lời + system prompt (không để context ăn hết cửa sổ). */
export const OUTPUT_RESERVE_TOKENS = 2048;
export const SYSTEM_RESERVE_TOKENS = 1024;
/** Sàn ngân sách — model cửa sổ rất nhỏ vẫn đưa được vài đoạn (lượt map sẽ chia nhỏ hơn). */
export const MIN_BUDGET_CHARS = 2000;

/** num_ctx truyền cho Ollama: cửa sổ của model, có trần. Không biết ⇒ null (không ép). */
export function numCtxFor(contextLength: number | null): number | null {
  if (!contextLength || contextLength <= 0) return null;
  return Math.min(contextLength, OLLAMA_MAX_NUM_CTX);
}

/** Ngân sách ký tự cho phần đoạn nguồn trong prompt. Không biết cửa sổ ⇒ 16.000 (hành vi cũ). */
export function budgetForTokens(
  tokens: number | null,
  maxChars: number = Number.POSITIVE_INFINITY,
): number {
  if (!tokens || tokens <= 0) return STUDIO_CONTEXT_BUDGET;
  const usable = tokens - OUTPUT_RESERVE_TOKENS - SYSTEM_RESERVE_TOKENS;
  const chars = Math.floor(usable * CHARS_PER_TOKEN);
  return Math.min(maxChars, Math.max(MIN_BUDGET_CHARS, chars));
}

/** Đọc cửa sổ ngữ cảnh từ phản hồi Ollama `/api/show` (`model_info["<arch>.context_length"]`). */
export function parseOllamaContextLength(show: unknown): number | null {
  const info =
    show !== null && typeof show === "object"
      ? (show as { model_info?: unknown }).model_info
      : undefined;
  if (!info || typeof info !== "object") return null;
  for (const [k, v] of Object.entries(info as Record<string, unknown>)) {
    if (k.endsWith(".context_length") && typeof v === "number" && v > 0) {
      return v;
    }
  }
  return null;
}

/**
 * Ngữ cảnh Studio theo provider: Ollama ⇒ num_ctx = cửa sổ model (có trần) và ngân sách theo num_ctx đó (TRUYỀN
 * TƯỜNG MINH, tránh Ollama dùng cửa sổ mặc định nhỏ và cắt đầu prompt); online ⇒ không ép, ngân sách có trần ký tự.
 */
export function studioContextFor(
  providerId: string,
  contextTokens: number | null,
): { budget: number; numCtx: number | null } {
  if (providerId === "ollama") {
    const numCtx = numCtxFor(contextTokens);
    return { numCtx, budget: budgetForTokens(numCtx) };
  }
  return {
    numCtx: null,
    budget: budgetForTokens(contextTokens, ONLINE_MAX_CHARS),
  };
}
