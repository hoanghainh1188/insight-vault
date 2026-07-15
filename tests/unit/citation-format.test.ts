import { describe, it, expect } from "vitest";
import {
  formatCitationLabel,
  citationLabels,
  pageSuffix,
  formatAnswerMarkdown,
} from "../../src/renderer/features/rag-qa/citation-format";
import type { Citation } from "@shared/ipc/types";

const cite = (n: number, page: number | null): Citation => ({
  n,
  chunkId: `c${n}`,
  sourceId: `s${n}`,
  sourceTitle: `Tài liệu ${n}`,
  locator: { page, charStart: 0, charEnd: 1 },
});

describe("citation-format", () => {
  it("có trang → '[n] Tên · trang X'", () => {
    expect(formatCitationLabel(cite(1, 48))).toBe("[1] Tài liệu 1 · trang 48");
  });
  it("không trang (page=null) → '[n] Tên'", () => {
    expect(formatCitationLabel(cite(2, null))).toBe("[2] Tài liệu 2");
  });
  it("citationLabels map cả danh sách", () => {
    expect(citationLabels([cite(1, 3), cite(2, null)])).toEqual([
      "[1] Tài liệu 1 · trang 3",
      "[2] Tài liệu 2",
    ]);
  });

  it("pageSuffix: có trang → ' · trang X'; null → ''", () => {
    expect(pageSuffix(48)).toBe(" · trang 48");
    expect(pageSuffix(null)).toBe("");
  });

  describe("formatAnswerMarkdown (072)", () => {
    it("có nguồn → nội dung + mục 'Nguồn:' kèm trang", () => {
      const out = formatAnswerMarkdown("Trả lời [1].", [cite(1, 48)]);
      expect(out).toBe(
        "Trả lời [1].\n\n---\n\nNguồn:\n[1] Tài liệu 1 · trang 48\n",
      );
    });
    it("không nguồn → chỉ nội dung (không mục Nguồn)", () => {
      const out = formatAnswerMarkdown("Không tìm thấy trong nguồn.", []);
      expect(out).toBe("Không tìm thấy trong nguồn.\n");
      expect(out).not.toContain("Nguồn:");
    });
    it("cắt khoảng trắng cuối trước khi ghép", () => {
      expect(formatAnswerMarkdown("abc  \n\n", [])).toBe("abc\n");
    });
  });
});
