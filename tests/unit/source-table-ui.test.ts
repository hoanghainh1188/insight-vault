// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { readFileSync } from "node:fs";
import { SourceViewer } from "../../src/renderer/features/source-viewer/SourceViewer";
import type { SourceViewerState } from "../../src/renderer/features/source-viewer/useSourceViewer";
import type { Citation, SourceContent } from "../../src/shared/ipc/types";
import { renderTable } from "../../src/main/services/ingestion/pdf-layout/tables";
import * as pdfTables from "../../src/shared/pdf-tables";

// 147 (e, T004): lưới bảng trong Trình xem nguồn — ngữ nghĩa bảng, tô sáng theo ô, căn phải ô số, công tắc dạng xem (nhớ trong
// phiên), chỉ PDF, dự phòng khi phân tích bảng lỗi.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const TABLE = renderTable([
  ["Năm", "Doanh thu"],
  ["2023", "1.234,5"],
  ["2024", "2.000"],
]);
const P1 = "Trang một.\n\n";
const TEXT = `${P1}Mở đầu bảng.\n\n${TABLE}\n\nHết.`;
const page2 = P1.length;

const content = (kind: SourceContent["kind"] = "pdf"): SourceContent => ({
  kind,
  title: "bao-cao.pdf",
  pageCount: 2,
  text: TEXT,
  pageBreaks:
    kind === "pdf"
      ? [
          { page: 1, offset: 0 },
          { page: 2, offset: page2 },
        ]
      : [],
});

const cite = (a: string, b: string): Citation => ({
  n: 3,
  chunkId: "c1",
  sourceId: "s1",
  sourceTitle: "bao-cao.pdf",
  locator: {
    page: 2,
    charStart: TEXT.indexOf(a),
    charEnd: TEXT.indexOf(b) + b.length,
  },
});

function viewerOf(
  c: SourceContent,
  citation: Citation | null,
): SourceViewerState {
  return {
    target: { sourceId: "s1", citation },
    content: c,
    loading: false,
    missing: false,
    isOpen: true,
    open: vi.fn(),
    openCitation: vi.fn(),
    openSource: vi.fn(),
    close: vi.fn(),
  } as unknown as SourceViewerState;
}

const render = (c: SourceContent, citation: Citation | null = null): void =>
  act(() =>
    root.render(createElement(SourceViewer, { viewer: viewerOf(c, citation) })),
  );

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  sessionStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const q = (s: string) => container.querySelector(s) as HTMLElement | null;

describe("SourceViewer — lưới bảng (147)", () => {
  it("PDF có bảng ⇒ <table> mặc định: tên 'Bảng 1 — trang 2', hàng tiêu đề columnheader, ô số căn phải", () => {
    render(content());
    const table = q("table")!;
    expect(table).not.toBeNull();
    expect(table.getAttribute("aria-label")).toBe("Bảng 1 — trang 2");
    const ths = table.querySelectorAll("thead th[scope=col]");
    expect([...ths].map((th) => th.textContent)).toEqual(["Năm", "Doanh thu"]);
    const firstRow = table
      .querySelectorAll("tbody tr")[0]
      .querySelectorAll("td");
    expect(firstRow[1].textContent).toBe("1.234,5");
    expect(firstRow[1].className).toContain("num");
    expect(container.textContent).not.toContain("|---|");
  });

  it("trích dẫn trỏ vào ô ⇒ <mark> trong đúng ô, nhãn [n] ở đoạn tô đầu", () => {
    render(content(), cite("2023", "1.234,5"));
    const marks = [...container.querySelectorAll("table mark")];
    expect(marks.map((m) => m.textContent?.replace("[3]", ""))).toEqual([
      "2023",
      "1.234,5",
    ]);
    expect(q("[data-testid=viewer-hltag]")!.closest("td")).not.toBeNull();
  });

  it("công tắc Dạng văn bản ⇒ bảng như văn bản cũ (| a | b |), cùng vùng tô; nhớ trong phiên", () => {
    render(content(), cite("2023", "1.234,5"));
    act(() =>
      (q("[data-testid=viewer-view-text]") as HTMLButtonElement).click(),
    );
    expect(q("table")).toBeNull();
    expect(container.textContent).toContain("|---|---|");
    expect(container.querySelectorAll("mark").length).toBeGreaterThan(0);
    expect(
      q("[data-testid=viewer-view-text]")!.getAttribute("aria-pressed"),
    ).toBe("true");
    act(() => root.unmount());
    root = createRoot(container);
    render(content());
    expect(q("table")).toBeNull(); // vẫn dạng văn bản trong phiên
    act(() =>
      (q("[data-testid=viewer-view-grid]") as HTMLButtonElement).click(),
    );
    expect(q("table")).not.toBeNull();
  });

  it("nguồn không phải PDF ⇒ không lưới, không công tắc", () => {
    render(content("md"));
    expect(q("table")).toBeNull();
    expect(q("[data-testid=viewer-view-grid]")).toBeNull();
  });

  it("PDF không có bảng ⇒ không công tắc", () => {
    render({ ...content(), text: "Chỉ có chữ." });
    expect(q("[data-testid=viewer-view-grid]")).toBeNull();
  });

  it("phân tích bảng lỗi ⇒ hiển thị văn bản như cũ (FR-012)", () => {
    vi.spyOn(pdfTables, "parsePdfTables").mockImplementation(() => {
      throw new Error("x");
    });
    render(content());
    expect(q("table")).toBeNull();
    expect(container.textContent).toContain("| Năm | Doanh thu |");
  });

  it("vùng bảng cuộn ngang được bằng bàn phím (region + tabindex=0); CSS overflow-x", () => {
    render(content());
    const region = q("[data-testid=viewer-table-1]")!;
    expect(region.getAttribute("role")).toBe("region");
    expect(region.getAttribute("tabindex")).toBe("0");
    const css = readFileSync(
      "src/renderer/features/source-viewer/source-viewer.css",
      "utf8",
    );
    expect(/\.vtable-wrap\s*\{[^}]*overflow-x:\s*auto/.test(css)).toBe(true);
  });
});
