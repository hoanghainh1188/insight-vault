import { describe, it, expect } from "vitest";
import type { MeetingDraftLine } from "@shared/ipc/types";
import { mergeDraft } from "../../src/renderer/features/meeting-capture/draft-merge";

// 186 PR B (R6) — gộp nháp ở renderer: thay theo id (key React ổn định ⇒ không nhấp nháy, giữ vùng chọn). THUẦN.

const line = (
  id: string,
  tStart: number,
  text: string,
  pending = false,
): MeetingDraftLine => ({ id, tStart, tEnd: tStart + 10, text, pending });

describe("mergeDraft", () => {
  it("cửa sổ mới ⇒ thêm vào cuối", () => {
    const prev = [line("w0", 0, "a")];
    expect(mergeDraft(prev, [line("w1", 10, "b")])).toEqual([
      line("w0", 0, "a"),
      line("w1", 10, "b"),
    ]);
  });

  it("cùng id ⇒ thay tại chỗ (pending → xong)", () => {
    const prev = [line("w0", 0, "a"), line("w1", 10, "Đang", true)];
    expect(mergeDraft(prev, [line("w1", 10, "Đang nói", false)])).toEqual([
      line("w0", 0, "a"),
      line("w1", 10, "Đang nói", false),
    ]);
  });

  it("giữ thứ tự theo tStart kể cả khi đến lệch", () => {
    const r = mergeDraft([line("w2", 20, "c")], [line("w1", 10, "b")]);
    expect(r.map((l) => l.id)).toEqual(["w1", "w2"]);
  });

  it("không mutate; dòng không đổi giữ nguyên tham chiếu", () => {
    const a = Object.freeze(line("w0", 0, "a"));
    const prev = Object.freeze([a]);
    const r = mergeDraft(prev, [line("w1", 10, "b")]);
    expect(prev).toHaveLength(1);
    expect(r[0]).toBe(a);
  });

  it("incoming rỗng ⇒ trả lại chính mảng cũ", () => {
    const prev = [line("w0", 0, "a")];
    expect(mergeDraft(prev, [])).toBe(prev);
  });
});
