// 149 (research R3/R4): huỷ lượt gọi AI do NGƯỜI DÙNG — khác hết thời gian chờ. Hàm thuần, không phụ thuộc Electron.

/** Lượt gọi AI bị huỷ qua signal ngoài (người dùng / rời notebook / cửa sổ đóng / bị lượt mới thay) — KHÔNG phải timeout. */
export class ChatAbortedError extends Error {
  constructor() {
    super("The AI request was cancelled.");
    this.name = "ChatAbortedError";
  }
}

export function isChatAborted(e: unknown): e is ChatAbortedError {
  return e instanceof ChatAbortedError;
}

/** Ném ChatAbortedError nếu signal đã abort (ranh giới giữa các bước). */
export function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new ChatAbortedError();
}

/**
 * Nối signal ngoài vào controller nội bộ (vd controller timeout): outer abort ⇒ controller abort. Trả hàm gỡ listener — gọi ở
 * `finally` để không rò listener trên signal sống lâu. Không dùng AbortSignal.any (không gỡ được, khó phân biệt nguồn abort).
 */
export function linkAbort(
  outer: AbortSignal | undefined,
  controller: AbortController,
): () => void {
  if (!outer) return () => undefined;
  if (outer.aborted) {
    controller.abort();
    return () => undefined;
  }
  const onAbort = (): void => controller.abort();
  outer.addEventListener("abort", onAbort, { once: true });
  return () => outer.removeEventListener("abort", onAbort);
}
