import { describe, it, expect, vi } from "vitest";
import { createStudioProgressEmitter } from "../../src/main/services/studio/progress-emitter";
import type { StudioGenerateInput } from "@shared/ipc/types";

// 146 (analyze M1): nối dây IPC bằng hàm THUẦN — id hợp lệ ⇒ onProgress gửi đúng payload (không thêm trường, không nội dung);
// id thiếu/không hợp lệ ⇒ undefined (không phát); send ném ⇒ nuốt.

const input = (generationId?: unknown): StudioGenerateInput =>
  ({
    notebookId: "nb1",
    kind: "faq",
    sourceId: "s-secret",
    outputLanguage: "en",
    generationId,
  }) as StudioGenerateInput;

describe("createStudioProgressEmitter", () => {
  it("id hợp lệ ⇒ gửi {generationId, notebookId, kind, phase, index?, total?} và KHÔNG gì khác", () => {
    const send = vi.fn();
    const on = createStudioProgressEmitter(input("gen-1"), send);
    expect(on).toBeTypeOf("function");
    on!({ phase: "reading", index: 2, total: 5 });
    on!({ phase: "writing" });
    expect(send.mock.calls).toEqual([
      [
        {
          generationId: "gen-1",
          notebookId: "nb1",
          kind: "faq",
          phase: "reading",
          index: 2,
          total: 5,
        },
      ],
      [
        {
          generationId: "gen-1",
          notebookId: "nb1",
          kind: "faq",
          phase: "writing",
        },
      ],
    ]);
  });

  it("chỉ chép các trường đã biết của bước (trường lạ không lọt ra ngoài)", () => {
    const send = vi.fn();
    const on = createStudioProgressEmitter(input("gen-1"), send)!;
    on({ phase: "condensing", notes: "nội dung bí mật" } as never);
    expect(send.mock.calls[0][0]).toEqual({
      generationId: "gen-1",
      notebookId: "nb1",
      kind: "faq",
      phase: "condensing",
    });
  });

  it.each([undefined, "", "x".repeat(65), "a b", "../x", 42, null])(
    "id không hợp lệ (%s) ⇒ undefined, không gửi gì",
    (id) => {
      const send = vi.fn();
      expect(createStudioProgressEmitter(input(id), send)).toBeUndefined();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it("send ném lỗi (cửa sổ đã đóng) ⇒ nuốt", () => {
    const on = createStudioProgressEmitter(input("gen-1"), () => {
      throw new Error("destroyed");
    })!;
    expect(() => on({ phase: "writing" })).not.toThrow();
  });
});
