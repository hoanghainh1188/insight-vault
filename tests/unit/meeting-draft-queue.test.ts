import { describe, it, expect } from "vitest";
import {
  planDraftQueue,
  type AsrJob,
} from "../../src/main/services/meeting-capture/draft-queue";

// 186 PR B (R6) — hàng việc ASR khi đang ghi: ưu tiên detect > draft > final; tồn > 3 cửa sổ nháp ⇒ bỏ cũ nhất + bật
// `lagging`; tắt khi tồn ≤ 1 (trễ để không nhấp nháy). Lượt 5 s (partial) lỗi thời khi đã có lượt đủ của cùng cửa sổ. THUẦN.

const draft = (window: number, partial = false): AsrJob => ({
  kind: "draft",
  window,
  partial,
});
const detect: AsrJob = { kind: "detect", window: 0, partial: false };
const final: AsrJob = { kind: "final", window: 0, partial: false };

describe("planDraftQueue", () => {
  it("thứ tự: detect > draft (cửa sổ cũ trước) > final", () => {
    const r = planDraftQueue([final, draft(2), detect, draft(1)], false);
    expect(r.ordered).toEqual([detect, draft(1), draft(2), final]);
    expect(r.dropped).toEqual([]);
    expect(r.lagging).toBe(false);
  });

  it("tồn > 3 cửa sổ nháp ⇒ bỏ cũ nhất (giữ 3 mới nhất), bật lagging", () => {
    const r = planDraftQueue(
      [1, 2, 3, 4, 5].map((w) => draft(w)),
      false,
    );
    expect(r.ordered).toEqual([draft(3), draft(4), draft(5)]);
    expect(r.dropped).toEqual([1, 2]);
    expect(r.lagging).toBe(true);
  });

  it("đang lagging: còn 2–3 cửa sổ ⇒ vẫn lagging; ≤ 1 ⇒ tắt", () => {
    expect(planDraftQueue([draft(1), draft(2)], true).lagging).toBe(true);
    expect(planDraftQueue([draft(3)], true).lagging).toBe(false);
    expect(planDraftQueue([], true).lagging).toBe(false);
  });

  it("chưa lagging, 3 cửa sổ ⇒ không bật", () => {
    expect(planDraftQueue([draft(1), draft(2), draft(3)], false).lagging).toBe(
      false,
    );
  });

  it("lượt 5 s của cửa sổ đã có lượt đủ ⇒ bỏ lượt 5 s (không tính là cửa sổ bị bỏ)", () => {
    const r = planDraftQueue([draft(4, true), draft(4)], false);
    expect(r.ordered).toEqual([draft(4)]);
    expect(r.dropped).toEqual([]);
  });

  it("đếm theo cửa sổ, không theo việc; không mutate đầu vào", () => {
    const input = Object.freeze([draft(1, true), draft(2), draft(3), draft(4)]);
    const r = planDraftQueue(input, false);
    expect(r.lagging).toBe(true);
    expect(r.dropped).toEqual([1]);
    expect(input).toHaveLength(4);
  });
});
