import { describe, it, expect } from "vitest";
import { parsePdfTables } from "../../src/shared/pdf-tables";
import { renderTable } from "../../src/main/services/ingestion/pdf-layout/tables";

// 147 (e, research R1): đọc lại bảng Markdown (định dạng cố định của renderTable — 112) từ văn bản nguồn PDF; ô có vị trí ký tự
// trong văn bản gốc (không gồm "|" và khoảng đệm) để tô sáng trích dẫn theo ký tự. Cổng chặt: không biến dòng "| x | y |" lẻ thành bảng.

const TABLE = renderTable([
  ["Năm", "Doanh thu", "Lãi"],
  ["2023", "1.234,5", "(12)"],
  ["2024", "2.000", ""],
]);

describe("parsePdfTables", () => {
  it("bảng chuẩn ⇒ tiêu đề + hàng; vị trí ô đúng trong văn bản gốc", () => {
    const text = `Mở đầu.\n\n${TABLE}\n\nKết thúc.`;
    const [t] = parsePdfTables(text, []);
    expect(t.header.map((c) => c.text)).toEqual(["Năm", "Doanh thu", "Lãi"]);
    expect(t.rows.map((r) => r.map((c) => c.text))).toEqual([
      ["2023", "1.234,5", "(12)"],
      ["2024", "2.000", ""],
    ]);
    expect(text.slice(t.start, t.end)).toBe(TABLE);
    for (const c of [...t.header, ...t.rows.flat()]) {
      expect(text.slice(c.start, c.end)).toBe(c.text);
    }
  });

  it("ô rỗng có độ dài 0, nằm giữa hai dấu |", () => {
    const text = TABLE;
    const empty = parsePdfTables(text, [])[0].rows[1][2];
    expect(empty.text).toBe("");
    expect(empty.start).toBe(empty.end);
    expect(text[empty.start - 1] === " " || text[empty.start - 1] === "|").toBe(
      true,
    );
  });

  it("'\\|' trong ô là ký tự của ô (đã bỏ thoát), không tách ô", () => {
    const text = renderTable([
      ["A", "B"],
      ["x|y", "z"],
      ["1", "2"],
    ]);
    const t = parsePdfTables(text, [])[0];
    expect(t.rows[0].map((c) => c.text)).toEqual(["x|y", "z"]);
    expect(text.slice(t.rows[0][0].start, t.rows[0][0].end)).toBe("x\\|y");
  });

  it("cột số ⇒ numericColumns (≥ 80% ô có chữ là số)", () => {
    const t = parsePdfTables(TABLE, [])[0];
    expect(t.numericColumns).toEqual([true, true, true]);
    const t2 = parsePdfTables(
      renderTable([
        ["Tên", "Ghi chú"],
        ["An", "đi học"],
        ["Bình", "12"],
      ]),
      [],
    )[0];
    expect(t2.numericColumns).toEqual([false, false]);
  });

  it("nhiều bảng ⇒ đủ, đúng thứ tự", () => {
    const text = `${TABLE}\n\nđoạn giữa\n\n${TABLE}`;
    const ts = parsePdfTables(text, []);
    expect(ts).toHaveLength(2);
    expect(ts[1].start).toBeGreaterThan(ts[0].end);
  });

  it("dòng '| x | y |' lẻ trong đoạn văn / thiếu hàng phân cách / số ô lệch ⇒ không phải bảng", () => {
    expect(parsePdfTables("Công thức | x | y | ở giữa câu.", [])).toEqual([]);
    expect(parsePdfTables("| a | b |\n| c | d |\n| e | f |", [])).toEqual([]);
    expect(parsePdfTables("| a | b |\n|---|---|\n| c | d | e |", [])).toEqual(
      [],
    );
    expect(parsePdfTables("| a | b |\n|---|---|", [])).toEqual([]); // chỉ tiêu đề, không hàng
  });

  it("không vắt ranh giới trang: bảng hai trang ⇒ hai bảng riêng, khối vắt mốc trang bị loại", () => {
    const text = `${TABLE}\n\n${TABLE}`;
    const second = TABLE.length + 2;
    expect(parsePdfTables(text, [{ page: 2, offset: second }])).toHaveLength(2);
    const lines = TABLE.split("\n");
    const cut = lines[0].length + 1 + lines[1].length + 1; // mốc trang giữa hàng 2 và 3
    expect(parsePdfTables(TABLE, [{ page: 2, offset: cut }])).toEqual([]);
  });

  it("đầu vào dị thường không ném (FR-012)", () => {
    expect(() => parsePdfTables("|".repeat(10_000), [])).not.toThrow();
    expect(parsePdfTables("", [])).toEqual([]);
  });

  it("thuộc tính: mọi ô của bảng renderTable ngẫu nhiên khớp văn bản tại vị trí của nó", () => {
    const words = ["a", "Bé", "12,5", "x|y", "", "phở bò", "(3)"];
    for (let seed = 1; seed <= 40; seed++) {
      const cols = 2 + (seed % 3);
      const rows = Array.from({ length: 3 + (seed % 4) }, (_, r) =>
        Array.from(
          { length: cols },
          (_, c) => words[(seed * 7 + r * 3 + c) % words.length],
        ),
      );
      rows[0] = rows[0].map((w, c) => w || `H${c}`); // tiêu đề có chữ
      const text = `pre\n\n${renderTable(rows)}\n\npost`;
      const [t] = parsePdfTables(text, []);
      expect(t).toBeDefined();
      for (const c of [...t.header, ...t.rows.flat()]) {
        expect(text.slice(c.start, c.end).replace(/\\\|/g, "|")).toBe(c.text);
      }
    }
  });
});
