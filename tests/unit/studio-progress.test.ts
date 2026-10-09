import { describe, it, expect } from "vitest";
import {
  applyStudioProgress,
  progressText,
  type StudioProgressMap,
} from "../../src/renderer/features/studio/studio-progress";
import { createTranslator } from "@shared/i18n";
import type { StudioProgressEvent } from "@shared/ipc/types";

// 146 (contract renderer): applyStudioProgress thuần — áp khi id + notebook khớp; bỏ id lạ, notebook khác, index lùi, pha lùi; không mutate.
// progressText — câu clarify #11 (vi/en).

const ev = (over: Partial<StudioProgressEvent> = {}): StudioProgressEvent => ({
  generationId: "g1",
  notebookId: "nb1",
  kind: "summary",
  phase: "reading",
  index: 1,
  total: 3,
  ...over,
});

describe("applyStudioProgress", () => {
  const active = { summary: "g1" };

  it("id + notebook khớp ⇒ cập nhật đúng loại", () => {
    const next = applyStudioProgress({}, active, "nb1", ev());
    expect(next.summary).toEqual({
      generationId: "g1",
      phase: "reading",
      index: 1,
      total: 3,
    });
  });

  it("id lạ (lượt cũ / loại khác chưa chạy) ⇒ bỏ, trả nguyên state", () => {
    const s: StudioProgressMap = {};
    expect(
      applyStudioProgress(s, active, "nb1", ev({ generationId: "old" })),
    ).toBe(s);
    expect(applyStudioProgress(s, active, "nb1", ev({ kind: "faq" }))).toBe(s);
  });

  it("notebook khác ⇒ bỏ", () => {
    const s: StudioProgressMap = {};
    expect(applyStudioProgress(s, active, "nb2", ev())).toBe(s);
  });

  it("index lùi trong pha đọc ⇒ bỏ; index tiến ⇒ áp", () => {
    const s = applyStudioProgress({}, active, "nb1", ev({ index: 2 }));
    expect(applyStudioProgress(s, active, "nb1", ev({ index: 1 }))).toBe(s);
    expect(
      applyStudioProgress(s, active, "nb1", ev({ index: 3 })).summary?.index,
    ).toBe(3);
  });

  it("pha lùi ⇒ bỏ; pha tiến ⇒ áp (bỏ index/total)", () => {
    const w = applyStudioProgress(
      {},
      active,
      "nb1",
      ev({ phase: "writing", index: undefined, total: undefined }),
    );
    expect(
      applyStudioProgress(w, active, "nb1", ev({ phase: "reading", index: 3 })),
    ).toBe(w);
    const c = applyStudioProgress({}, active, "nb1", ev({ index: 3 }));
    const c2 = applyStudioProgress(
      c,
      active,
      "nb1",
      ev({ phase: "condensing", index: undefined, total: undefined }),
    );
    expect(c2.summary).toEqual({ generationId: "g1", phase: "condensing" });
  });

  it("không mutate state đầu vào; loại khác giữ nguyên", () => {
    const s: StudioProgressMap = {
      faq: { generationId: "g9", phase: "writing" },
    };
    const frozen = JSON.stringify(s);
    const next = applyStudioProgress(s, { ...active, faq: "g9" }, "nb1", ev());
    expect(JSON.stringify(s)).toBe(frozen);
    expect(next).not.toBe(s);
    expect(next.faq).toBe(s.faq);
  });
});

describe("progressText", () => {
  const vi = createTranslator("vi");
  const en = createTranslator("en");

  it("tiếng Việt — đúng câu clarify #11", () => {
    expect(
      progressText(
        { generationId: "g", phase: "reading", index: 2, total: 5 },
        vi,
      ),
    ).toBe("Đang đọc phần 2/5…");
    expect(progressText({ generationId: "g", phase: "condensing" }, vi)).toBe(
      "Đang rút gọn ghi chú…",
    );
    expect(progressText({ generationId: "g", phase: "writing" }, vi)).toBe(
      "Đang viết…",
    );
  });

  it("English", () => {
    expect(
      progressText(
        { generationId: "g", phase: "reading", index: 2, total: 5 },
        en,
      ),
    ).toBe("Reading part 2 of 5…");
    expect(progressText({ generationId: "g", phase: "condensing" }, en)).toBe(
      "Condensing notes…",
    );
    expect(progressText({ generationId: "g", phase: "writing" }, en)).toBe(
      "Writing…",
    );
  });
});

// 146 (T018, clarify #5): câu đọc màn hình — khi vào pha đọc lần đầu, đổi sang rút gọn / viết (writing chỉ khi có pha trước),
// mốc giữa pha đọc (total ≥ 3, index = ceil(total/2)); null còn lại. Một lượt 6 phần ≤ 6 câu (gồm bắt đầu/xong hiện có).
import { progressAnnouncement } from "../../src/renderer/features/studio/studio-progress";
import type { StudioProgressState } from "../../src/renderer/features/studio/studio-progress";

describe("progressAnnouncement", () => {
  const vi_ = createTranslator("vi");
  const en_ = createTranslator("en");
  const st = (
    phase: StudioProgressState["phase"],
    index?: number,
    total?: number,
    generationId = "g",
  ): StudioProgressState => ({ generationId, phase, index, total });

  it("vào pha đọc lần đầu ⇒ câu có tên loại + phần i/N", () => {
    expect(
      progressAnnouncement(undefined, st("reading", 1, 6), "Ý chính", vi_),
    ).toBe("Ý chính: đang đọc phần 1/6.");
  });

  it("mốc giữa: total ≥ 3 và index = ceil(total/2) ⇒ có câu; các phần khác ⇒ null", () => {
    expect(
      progressAnnouncement(
        st("reading", 2, 6),
        st("reading", 3, 6),
        "Ý chính",
        vi_,
      ),
    ).toBe("Ý chính: đang đọc phần 3/6.");
    expect(
      progressAnnouncement(
        st("reading", 3, 6),
        st("reading", 4, 6),
        "Ý chính",
        vi_,
      ),
    ).toBeNull();
    expect(
      progressAnnouncement(
        st("reading", 1, 2),
        st("reading", 2, 2),
        "Ý chính",
        vi_,
      ),
    ).toBeNull();
    expect(
      progressAnnouncement(
        st("reading", 1, 5),
        st("reading", 3, 5),
        "Ý chính",
        vi_,
      ),
    ).not.toBeNull();
  });

  it("đổi sang rút gọn / viết ⇒ câu tương ứng (English)", () => {
    expect(
      progressAnnouncement(st("reading", 6, 6), st("condensing"), "FAQ", en_),
    ).toBe("FAQ: condensing notes.");
    expect(
      progressAnnouncement(st("condensing"), st("writing"), "FAQ", en_),
    ).toBe("FAQ: writing.");
  });

  it("một lượt (writing không có pha trước) ⇒ null — đã có câu bắt đầu/xong", () => {
    expect(
      progressAnnouncement(undefined, st("writing"), "FAQ", en_),
    ).toBeNull();
  });

  it("cùng pha, không phải mốc ⇒ null; lượt khác coi như chưa có pha trước", () => {
    expect(
      progressAnnouncement(st("writing"), st("writing"), "FAQ", en_),
    ).toBeNull();
    expect(
      progressAnnouncement(
        st("writing", undefined, undefined, "old"),
        st("reading", 1, 4),
        "FAQ",
        en_,
      ),
    ).toBe("FAQ: reading part 1 of 4.");
  });

  it("một lượt 6 phần có rút gọn: tổng câu (gồm bắt đầu + xong) ≤ 6", () => {
    const seq: StudioProgressState[] = [
      ...Array.from({ length: 6 }, (_, i) => st("reading", i + 1, 6)),
      st("condensing"),
      st("writing"),
    ];
    let prev: StudioProgressState | undefined;
    let count = 2; // bắt đầu + xong
    for (const next of seq) {
      if (progressAnnouncement(prev, next, "Tóm tắt", vi_)) count += 1;
      prev = next;
    }
    expect(count).toBeLessThanOrEqual(6);
  });
});

// 146 (review): xoá khoá thật sự (không để khoá mang undefined), không mutate.
import { withoutKind } from "../../src/renderer/features/studio/studio-progress";

describe("withoutKind", () => {
  it("bỏ đúng khoá, giữ khoá khác, không mutate; khoá không có ⇒ trả nguyên tham chiếu", () => {
    const m = { summary: 1, faq: 2 };
    const out = withoutKind(m, "summary");
    expect(out).toEqual({ faq: 2 });
    expect("summary" in out).toBe(false);
    expect(m).toEqual({ summary: 1, faq: 2 });
    expect(withoutKind(out, "outline")).toBe(out);
  });
});
