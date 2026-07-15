import { describe, it, expect } from "vitest";
import {
  formatCitationLabel,
  citationLabels,
  pageSuffix,
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
});
