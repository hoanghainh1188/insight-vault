import { describe, it, expect, vi } from "vitest";
import { createStudioTokenEmitter } from "../../src/main/services/studio/token-emitter";

// 178 (PR 4, T065, FR-041/FR-042, research R8): nối dây stream Studio → `studio:streamToken` bằng hàm THUẦN. Chỉ gửi về SINK của
// lượt (sender đã gọi studio:generate — không broadcast); payload CHỈ {generationId, delta}; id không hợp lệ ⇒ không stream;
// sau huỷ / cửa sổ đóng ⇒ không gửi; send ném ⇒ nuốt.

const GEN = "0b9e6a52-1d2c-4f5e-9a7b-3c4d5e6f7a8b";

function sink(destroyed = false) {
  return {
    send: vi.fn(),
    isDestroyed: vi.fn(() => destroyed),
  };
}

describe("createStudioTokenEmitter", () => {
  it("id hợp lệ ⇒ gửi đúng {generationId, delta} và KHÔNG gì khác, theo thứ tự", () => {
    const s = sink();
    const on = createStudioTokenEmitter(GEN, new AbortController().signal, s);
    expect(on).toBeTypeOf("function");
    on!("Xin ");
    on!("chào");
    expect(s.send.mock.calls).toEqual([
      [{ generationId: GEN, delta: "Xin " }],
      [{ generationId: GEN, delta: "chào" }],
    ]);
  });

  it.each([
    undefined,
    "",
    "id có khoảng trắng",
    "x".repeat(65),
    42,
    { id: GEN },
  ])("id không hợp lệ (%j) ⇒ undefined (không stream)", (id) => {
    expect(
      createStudioTokenEmitter(id, new AbortController().signal, sink()),
    ).toBeUndefined();
  });

  it("signal đã huỷ ⇒ không gửi", () => {
    const s = sink();
    const ac = new AbortController();
    const on = createStudioTokenEmitter(GEN, ac.signal, s)!;
    on!("a");
    ac.abort();
    on!("b");
    expect(s.send).toHaveBeenCalledTimes(1);
  });

  it("cửa sổ đã đóng (isDestroyed) ⇒ không gửi", () => {
    const s = sink(true);
    createStudioTokenEmitter(GEN, new AbortController().signal, s)!("a");
    expect(s.send).not.toHaveBeenCalled();
  });

  it("delta rỗng ⇒ không gửi", () => {
    const s = sink();
    createStudioTokenEmitter(GEN, new AbortController().signal, s)!("");
    expect(s.send).not.toHaveBeenCalled();
  });

  it("send ném ⇒ nuốt (không làm hỏng lượt tạo)", () => {
    const s = sink();
    s.send.mockImplementation(() => {
      throw new Error("gone");
    });
    const on = createStudioTokenEmitter(GEN, new AbortController().signal, s)!;
    expect(() => on("a")).not.toThrow();
  });
});
