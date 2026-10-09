import { describe, it, expect } from "vitest";
import {
  cancelLogFields,
  createGenerationRegistry,
} from "../../src/main/services/studio/generation-registry";
import type { StudioKind } from "@shared/ipc/types";

// 149 (research R1, data-model): sổ lượt tạo Studio đang chạy — chủ sở hữu (cửa sổ), supersede theo (notebookId, kind), lý do huỷ cho log.

type Owner = { id: string };
const A: Owner = { id: "winA" };
const B: Owner = { id: "winB" };
const reg = (
  r: ReturnType<typeof createGenerationRegistry<Owner>>,
  id: string,
  kind: StudioKind = "summary",
  nb = "nb1",
  owner = A,
) => r.register({ generationId: id, notebookId: nb, kind, owner });

describe("createGenerationRegistry", () => {
  it("register trả signal chưa abort; cancel đúng owner ⇒ true + abort + lý do", () => {
    const r = createGenerationRegistry<Owner>();
    const { signal } = reg(r, "g1");
    expect(signal.aborted).toBe(false);
    expect(r.cancel("g1", A, "user")).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(r.finish("g1")).toBe("user");
  });

  it("owner khác / id lạ / đã finish / đã huỷ ⇒ false", () => {
    const r = createGenerationRegistry<Owner>();
    const { signal } = reg(r, "g1");
    expect(r.cancel("g1", B, "user")).toBe(false);
    expect(signal.aborted).toBe(false);
    expect(r.cancel("nope", A, "user")).toBe(false);
    expect(r.cancel("g1", A, "navigate")).toBe(true);
    expect(r.cancel("g1", A, "user")).toBe(false); // đã huỷ
    expect(r.finish("g1")).toBe("navigate"); // giữ lý do đầu tiên
    expect(r.cancel("g1", A, "user")).toBe(false); // đã finish
  });

  it("finish idempotent; lượt xong bình thường ⇒ null", () => {
    const r = createGenerationRegistry<Owner>();
    reg(r, "g1");
    expect(r.finish("g1")).toBeNull();
    expect(r.finish("g1")).toBeNull();
    expect(r.size()).toBe(0);
  });

  it("register cùng (notebookId, kind) ⇒ lượt cũ bị huỷ 'superseded'; khác loại / notebook không ảnh hưởng", () => {
    const r = createGenerationRegistry<Owner>();
    const old = reg(r, "g1");
    const other = reg(r, "g2", "faq");
    const otherNb = reg(r, "g3", "summary", "nb2");
    const fresh = reg(r, "g4");
    expect(old.signal.aborted).toBe(true);
    expect(fresh.superseded).toBe(true);
    expect(other.signal.aborted).toBe(false);
    expect(otherNb.signal.aborted).toBe(false);
    expect(fresh.signal.aborted).toBe(false);
    expect(r.finish("g1")).toBe("superseded");
    // lượt cũ finish muộn không xoá nhầm lượt mới
    expect(r.cancel("g4", A, "user")).toBe(true);
  });

  it("abortAllFor(owner) chỉ huỷ lượt của owner đó ('window'); abortAll huỷ hết", () => {
    const r = createGenerationRegistry<Owner>();
    const a = reg(r, "g1", "summary", "nb1", A);
    const b = reg(r, "g2", "faq", "nb1", B);
    r.abortAllFor(A, "window");
    expect(a.signal.aborted).toBe(true);
    expect(b.signal.aborted).toBe(false);
    expect(r.finish("g1")).toBe("window");
    r.abortAll("window");
    expect(b.signal.aborted).toBe(true);
    expect(r.finish("g2")).toBe("window");
  });
});

describe("cancelLogFields (analyze A1)", () => {
  it("chỉ kind/phase/reason — không id/notebook; phase mặc định 'start'", () => {
    expect(cancelLogFields("faq", undefined, "user")).toEqual({
      kind: "faq",
      phase: "start",
      reason: "user",
    });
    expect(cancelLogFields("summary", "reading", "superseded")).toEqual({
      kind: "summary",
      phase: "reading",
      reason: "superseded",
    });
  });
});
