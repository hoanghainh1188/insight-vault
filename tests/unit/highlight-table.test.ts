import { describe, it, expect } from "vitest";
import {
  buildViewerBlocks,
  type ViewerBlock,
} from "../../src/renderer/features/source-viewer/highlight";
import { parsePdfTables } from "../../src/shared/pdf-tables";
import { renderTable } from "../../src/main/services/ingestion/pdf-layout/tables";

// 147 (e, research R2): khối hiển thị text | table; tô sáng theo KÝ TỰ trong ô (ô phủ trọn ⇒ cả ô); ký tự khung bảng không hiển thị;
// chỉnh vùng tô của 157/159 vẫn áp; mốc trang giữ.

const TABLE = renderTable([
  ["Năm", "Doanh thu"],
  ["2023", "1.234,5 tỷ"],
  ["2024", "2.000 tỷ"],
]);
const TEXT = `Mở đầu đoạn văn.\n\n${TABLE}\n\nKết thúc.`;
const TABLES = parsePdfTables(TEXT, []);
/** Vị trí bắt đầu dòng trống ngay trước bảng (không tô). */
const TRAIL = TEXT.slice(0, TABLES[0].start).replace(/\s+$/u, "").length;

/** Chữ được tô (theo thứ tự) từ khối hiển thị. */
function highlighted(blocks: ViewerBlock[]): string {
  let out = "";
  for (const b of blocks) {
    if (b.kind === "text") {
      for (const s of b.segments) if (s.kind === "highlight") out += s.text;
    } else {
      for (const row of b.cells)
        for (const cell of row)
          for (const s of cell) if (s.kind === "highlight") out += s.text;
    }
  }
  return out;
}

describe("buildViewerBlocks", () => {
  it("không có bảng ⇒ một khối text như buildSegments", () => {
    const blocks = buildViewerBlocks("abc", null, [], []);
    expect(blocks).toEqual([
      { kind: "text", segments: [{ text: "abc", kind: "plain" }] },
    ]);
  });

  it("chia text | table | text; ô có chữ đúng, ký tự khung không hiển thị", () => {
    const blocks = buildViewerBlocks(TEXT, null, [], TABLES);
    expect(blocks.map((b) => b.kind)).toEqual(["text", "table", "text"]);
    const t = blocks[1];
    if (t.kind !== "table") throw new Error();
    expect(
      t.cells.map((r) => r.map((c) => c.map((s) => s.text).join(""))),
    ).toEqual([
      ["Năm", "Doanh thu"],
      ["2023", "1.234,5 tỷ"],
      ["2024", "2.000 tỷ"],
    ]);
  });

  it("vùng tô bắt đầu giữa đoạn văn, kết thúc giữa ô ⇒ chỉ phần trong vùng được tô", () => {
    const a = TEXT.indexOf("đoạn văn");
    const b = TEXT.indexOf("1.234,5") + "1.234".length;
    const blocks = buildViewerBlocks(
      TEXT,
      { charStart: a, charEnd: b },
      [],
      TABLES,
    );
    expect(highlighted(blocks)).toBe("đoạn văn.NămDoanh thu20231.234"); // dòng trống trước bảng không tô
  });

  it("ô phủ trọn ⇒ cả ô là một đoạn tô; vùng ngoài bảng ⇒ bảng không tô", () => {
    const a = TEXT.indexOf("2024");
    const b = TEXT.indexOf("2.000 tỷ") + "2.000 tỷ".length;
    const blocks = buildViewerBlocks(
      TEXT,
      { charStart: a, charEnd: b },
      [],
      TABLES,
    );
    const t = blocks[1];
    if (t.kind !== "table") throw new Error();
    expect(t.cells[2][0]).toEqual([
      { text: "2024", kind: "highlight", first: true },
    ]);
    expect(t.cells[2][1]).toEqual([{ text: "2.000 tỷ", kind: "highlight" }]);
    const k = TEXT.indexOf("Kết thúc");
    const out = buildViewerBlocks(
      TEXT,
      { charStart: k, charEnd: k + 3 },
      [],
      TABLES,
    );
    expect(highlighted(out)).toBe("Kết");
    const tt = out[1];
    if (tt.kind !== "table") throw new Error();
    expect(tt.cells.flat(2).every((s) => s.kind === "plain")).toBe(true);
  });

  it("chỉ đoạn tô ĐẦU TIÊN mang first (nhãn [n] + cuộn tới)", () => {
    const a = TEXT.indexOf("Năm");
    const blocks = buildViewerBlocks(
      TEXT,
      { charStart: a, charEnd: TEXT.length },
      [],
      TABLES,
    );
    const firsts: string[] = [];
    for (const b of blocks) {
      const segs = b.kind === "text" ? b.segments : b.cells.flat(2);
      for (const s of segs) if (s.first) firsts.push(s.text);
    }
    expect(firsts).toEqual(["Năm"]);
  });

  it("157/159 vẫn áp: vùng bắt đầu bằng xuống dòng / giữa chữ được chỉnh", () => {
    const a = TEXT.indexOf("\n\n|");
    const b = TEXT.indexOf("Doanh thu") + 5;
    const blocks = buildViewerBlocks(
      TEXT,
      { charStart: a, charEnd: b },
      [],
      TABLES,
    );
    expect(highlighted(blocks)).toBe("NămDoanh");
  });

  it("mốc trang ngay đầu bảng được giữ trên khối bảng", () => {
    const start = TABLES[0].start;
    const blocks = buildViewerBlocks(
      TEXT,
      null,
      [{ page: 2, offset: start }],
      TABLES,
    );
    const t = blocks.find((b) => b.kind === "table");
    expect(t && t.kind === "table" && t.pageMark).toBe(2);
  });

  it("thuộc tính: vùng [đầu ô, cuối ô] ngẫu nhiên ⇒ chữ được tô == phần chữ hiển thị trong vùng", () => {
    const cells = [...TABLES[0].header, ...TABLES[0].rows.flat()];
    for (let i = 0; i < cells.length; i++) {
      for (let j = i; j < cells.length; j++) {
        const a = cells[i].start;
        const b = cells[j].end;
        if (a >= b) continue;
        let expected = "";
        for (let p = a; p < b; p++) {
          const inTable = p >= TABLES[0].start && p < TABLES[0].end;
          const inCell = cells.some((c) => p >= c.start && p < c.end);
          const blankBeforeTable = p >= TRAIL && p < TABLES[0].start;
          if ((!inTable || inCell) && !blankBeforeTable) expected += TEXT[p];
        }
        const got = highlighted(
          buildViewerBlocks(TEXT, { charStart: a, charEnd: b }, [], TABLES),
        );
        expect(got).toBe(expected);
      }
    }
  });
});
