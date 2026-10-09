import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildLines } from "../../src/main/services/ingestion/pdf-layout/lines";
import { detectTables } from "../../src/main/services/ingestion/pdf-layout/tables";
import type { LayoutItem } from "../../src/main/services/ingestion/pdf-layout/types";
import { CW, grid, item } from "./helpers/layout-items";

// 147 (b, clarify #1): lỗi bất kỳ trong đường phụ bảng số ⇒ kết quả như khi chưa có đường phụ (không mất bảng căn trái, không ném).

const { looksNumeric, logEvent } = vi.hoisted(() => ({
  looksNumeric: vi.fn((): boolean => {
    throw new Error("boom");
  }),
  logEvent: vi.fn(),
}));

vi.mock("../../src/main/services/ingestion/pdf-layout/numeric", () => ({
  looksNumeric,
  decimalAnchor: () => 0,
}));
vi.mock("../../src/main/logging", () => ({ logEvent }));

const PAGE = { width: 600, height: 800 };
const kinds = (items: LayoutItem[]) =>
  detectTables(buildLines(items).lines, PAGE).map((s) =>
    s.kind === "table" ? { table: s.rows } : { text: s.lines.length },
  );
const right = (text: string, r: number, y: number) =>
  item(text, r - text.length * 10 * CW, y);

describe("detectTables — đường phụ lỗi", () => {
  beforeEach(() => {
    looksNumeric.mockClear();
    logEvent.mockClear();
  });

  it("bảng căn trái vẫn nhận như trước", () => {
    const rows = [
      ["Item", "Qty", "Price"],
      ["Apple", "3", "1.20"],
      ["Banana", "12", "0.50"],
    ];
    expect(kinds(grid(rows, [50, 200, 350], 100))).toEqual([{ table: rows }]);
  });

  it("bảng số căn phải ⇒ văn bản như trước 147 (không ném)", () => {
    const rows = [
      ["Revenue", "1,234.5"],
      ["Cost of sales", "(456.7)"],
      ["Gross profit", "777.8"],
      ["Total", "21.0"],
    ];
    const items = rows.flatMap((r, i) => [
      item(r[0], 50, 100 + i * 14),
      right(r[1], 400, 100 + i * 14),
    ]);
    expect(kinds(items).some((k) => "table" in k)).toBe(false);
    // đường phụ ĐÃ chạy và lỗi bị chặn + ghi mã lỗi (không nội dung)
    expect(looksNumeric).toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith("pdf.layout.fallback", {
      feature: "numericTable",
      errorType: "Error",
    });
  });
});
