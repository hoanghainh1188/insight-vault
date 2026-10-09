import type { StudioKind, StudioProgressPhase } from "@shared/ipc/types";

// 149 (research R1): sổ lượt tạo Studio đang chạy ở main — mỗi lượt một AbortController, chủ sở hữu = cửa sổ đã bắt đầu
// (chỉ chủ sở hữu được huỷ), lượt mới cùng (notebookId, kind) huỷ lượt cũ (supersede). Thuần (Owner tiêm vào) — không Electron.

/** Lý do huỷ — chỉ dùng cho nhật ký (không gửi renderer). */
export type CancelReason = "user" | "navigate" | "window" | "superseded";

interface Entry<O> {
  notebookId: string;
  kind: StudioKind;
  owner: O;
  controller: AbortController;
  reason: CancelReason | null;
}

export function createGenerationRegistry<O>() {
  const entries = new Map<string, Entry<O>>();

  const abort = (e: Entry<O>, reason: CancelReason): boolean => {
    if (e.reason !== null) return false; // đã huỷ — giữ lý do đầu tiên
    e.reason = reason;
    e.controller.abort();
    return true;
  };

  return {
    /** Đăng ký lượt mới; lượt đang chạy cùng (notebookId, kind) bị huỷ "superseded". */
    register(input: {
      generationId: string;
      notebookId: string;
      kind: StudioKind;
      owner: O;
    }): { signal: AbortSignal; superseded: boolean } {
      let superseded = false;
      // Review N4: id trùng (renderer lỗi / cố ý) ⇒ lượt cũ cùng id cũng bị thay — không để controller mồ côi.
      const same = entries.get(input.generationId);
      if (same) superseded = abort(same, "superseded") || superseded;
      for (const e of entries.values()) {
        if (e.notebookId === input.notebookId && e.kind === input.kind) {
          superseded = abort(e, "superseded") || superseded;
        }
      }
      const controller = new AbortController();
      entries.set(input.generationId, {
        notebookId: input.notebookId,
        kind: input.kind,
        owner: input.owner,
        controller,
        reason: null,
      });
      return { signal: controller.signal, superseded };
    },

    /** Huỷ theo yêu cầu: chỉ khi tồn tại, đúng chủ sở hữu và chưa bị huỷ. */
    cancel(generationId: string, owner: O, reason: CancelReason): boolean {
      const e = entries.get(generationId);
      if (!e || e.owner !== owner) return false;
      return abort(e, reason);
    },

    /**
     * Lượt kết thúc (luôn gọi ở finally): xoá; trả lý do nếu lượt đã bị huỷ, ngược lại null. Idempotent. Truyền `signal` của lượt
     * để KHÔNG xoá nhầm entry của lượt khác đã đăng ký lại cùng id (review N4) — khi đó trả lý do theo signal của chính lượt.
     */
    finish(generationId: string, signal?: AbortSignal): CancelReason | null {
      const e = entries.get(generationId);
      if (signal && e?.controller.signal !== signal) {
        return signal.aborted ? "superseded" : null;
      }
      if (!e) return null;
      entries.delete(generationId);
      return e.reason;
    },

    /** Cửa sổ chủ sở hữu bị đóng ⇒ huỷ mọi lượt của nó. */
    abortAllFor(owner: O, reason: CancelReason): void {
      for (const e of entries.values()) if (e.owner === owner) abort(e, reason);
    },

    /** Mọi cửa sổ đóng ⇒ huỷ hết. */
    abortAll(reason: CancelReason): void {
      for (const e of entries.values()) abort(e, reason);
    },

    size(): number {
      return entries.size;
    },
  };
}

export type GenerationRegistry<O> = ReturnType<
  typeof createGenerationRegistry<O>
>;

/** Trường nhật ký `studio.cancelled` — KHÔNG id / notebook / nội dung (Constitution III). */
export function cancelLogFields(
  kind: StudioKind,
  lastPhase: StudioProgressPhase | undefined,
  reason: CancelReason,
): {
  kind: StudioKind;
  phase: StudioProgressPhase | "start";
  reason: CancelReason;
} {
  return { kind, phase: lastPhase ?? "start", reason };
}
