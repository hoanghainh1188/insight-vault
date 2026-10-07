import { describe, expect, it, vi } from "vitest";
import { layoutPage } from "../../src/main/services/ingestion/pdf-layout/layout-page";
import { MAX_LAYOUT_ITEMS_PER_PAGE } from "../../src/main/services/ingestion/pdf-layout/types";
import type { LayoutItem } from "../../src/main/services/ingestion/pdf-layout/types";
import { cleanText } from "../../src/main/services/ingestion/cleaning";
import { item, lines } from "./helpers/layout-items";

// 112 (FR-001..FR-003, FR-006, FR-007; contracts/pdf-layout.md): ghép dòng → vùng → đoạn cho một trang.

const PAGE = { width: 600, height: 800 };
const chars = (s: string) => [...s.replace(/\s/g, "")].sort().join("");
const L = (n: number) => `Left column line number ${n} with enough words`;
const R = (n: number) => `Right column line number ${n} with enough word`;

function twoCol(): LayoutItem[] {
  return [
    item(
      "A Two Column Article Title That Spans The Whole Page Width Here",
      50,
      50,
    ),
    ...lines(50, 90, [L(1), L(2)]),
    ...lines(50, 128, [L(3), L(4)]),
    ...lines(320, 90, [R(1), R(2)]),
    ...lines(320, 128, [R(3), R(4)]),
    item("Page 1", 280, 780),
  ];
}

describe("layoutPage (văn bản, chưa có bảng)", () => {
  it("hai cột: tiêu đề, cột trái (2 đoạn), cột phải (2 đoạn), số trang — không xoá gì", () => {
    const r = layoutPage(twoCol(), PAGE);
    expect(r.fallback).toBe(false);
    expect(r.blocks).toEqual([]);
    expect(r.text).toBe(
      [
        "A Two Column Article Title That Spans The Whole Page Width Here",
        `${L(1)} ${L(2)}`,
        `${L(3)} ${L(4)}`,
        `${R(1)} ${R(2)}`,
        `${R(3)} ${R(4)}`,
        "Page 1",
      ].join("\n\n"),
    );
  });

  it("đầu trang + chân trang (số trang) được giữ nguyên", () => {
    const r = layoutPage(
      [
        item("CONG TY ABC - BAO CAO NAM", 50, 30),
        ...lines(50, 100, ["Noi dung chinh cua trang."]),
        item("12", 295, 780),
      ],
      PAGE,
    );
    expect(r.text).toBe(
      "CONG TY ABC - BAO CAO NAM\n\nNoi dung chinh cua trang.\n\n12",
    );
  });

  it("chữ xoay nối thành đoạn cuối trang", () => {
    const r = layoutPage(
      [
        ...lines(50, 100, ["Body text."]),
        item("SIDE NOTE", 560, 600, 10, true),
      ],
      PAGE,
    );
    expect(r.text).toBe("Body text.\n\nSIDE NOTE");
  });

  it("dạng cố định của cleanText (không đổi sau làm sạch)", () => {
    const r = layoutPage(
      [...twoCol(), item("  spaced   out  ", 50, 400), item("x\ty", 50, 430)],
      PAGE,
    );
    expect(cleanText(r.text)).toBe(r.text);
  });

  it("mọi ký tự không rỗng của item xuất hiện đúng một lần", () => {
    const items = twoCol();
    expect(chars(layoutPage(items, PAGE).text)).toBe(
      chars(items.map((i) => i.text).join("")),
    );
  });

  it(`> MAX_LAYOUT_ITEMS_PER_PAGE item ⇒ fallback nối cũ`, () => {
    const items = Array.from(
      { length: MAX_LAYOUT_ITEMS_PER_PAGE + 1 },
      (_, i) =>
        item(
          String.fromCharCode(97 + (i % 26)),
          20 + (i % 100) * 5,
          20 + Math.floor(i / 100) * 11,
          5,
        ),
    );
    const r = layoutPage(items, PAGE);
    expect(r.fallback).toBe(true);
    expect(r.blocks).toEqual([]);
    expect(r.text).toBe(items.map((i) => i.text).join(" "));
  });

  it("trang rỗng ⇒ chuỗi rỗng, không fallback", () => {
    expect(layoutPage([], PAGE)).toEqual({
      text: "",
      blocks: [],
      fallback: false,
    });
  });
});

describe("layoutPage — hàm con ném lỗi ⇒ fallback trang đó", () => {
  it("orderRegions ném ⇒ fallback nối cũ", async () => {
    vi.resetModules();
    vi.doMock("../../src/main/services/ingestion/pdf-layout/columns", () => ({
      orderRegions: () => {
        throw new Error("boom");
      },
    }));
    const mod =
      await import("../../src/main/services/ingestion/pdf-layout/layout-page");
    const items = lines(50, 100, ["a", "b"]);
    const r = mod.layoutPage(items, PAGE);
    expect(r).toEqual({ text: "a b", blocks: [], fallback: true });
    vi.doUnmock("../../src/main/services/ingestion/pdf-layout/columns");
  });
});
