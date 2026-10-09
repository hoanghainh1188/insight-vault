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
