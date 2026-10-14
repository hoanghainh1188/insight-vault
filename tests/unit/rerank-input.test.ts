import { describe, it, expect } from "vitest";
import { rerankInput } from "../../src/main/services/rag/rerank-input";

// 187 PR 2 (T019, contracts/rerank-input.md): trình bày đoạn bảng cho bộ chấm — chỉ chuỗi gửi bộ chấm, không đổi chunk.

const header = "| Quý | Diện tích (m2) | Phí thuê (triệu đồng) |";
const sep = "|---|---|---|";
const rows = [
  "| Quý 1 | 1.150 | 80,5 |",
  "| Quý 2 | 1.200 | 84,0 |",
  "| Quý 3 | 1.250 | 87,5 |",
  "| Quý 4 | 1.200 | 84,0 |",
  "| Cả năm | 4.800 | 336,0 |",
];
const caption = "Bảng phí thuê kho theo từng quý của năm đầu tiên.";
const table = [caption, "", header, sep, ...rows].join("\n");

describe("rerankInput", () => {
  it("đoạn không có bảng ⇒ nguyên văn (kể cả dài hơn ngân sách)", () => {
    const prose = "Đoạn văn thường, không có dòng bảng nào cả. ".repeat(20);
    expect(rerankInput(prose, "văn thường", 50)).toBe(prose);
  });

  it("đoạn có bảng nhưng vừa ngân sách ⇒ nguyên văn", () => {
    expect(rerankInput(table, "quý 3", table.length)).toBe(table);
    expect(rerankInput(table, "quý 3", table.length + 100)).toBe(table);
  });

  it("vượt ngân sách ⇒ ≤ ngân sách, giữ tiêu đề + phân cách, dòng trùng từ đứng ngay sau", () => {
    const budget =
      caption.length + header.length + sep.length + rows[2].length + 8;
    const out = rerankInput(table, "Phí thuê quý 3 là bao nhiêu?", budget);
    expect(out.length).toBeLessThanOrEqual(budget);
    expect(out).toContain(header);
    expect(out).toContain(sep);
    const lines = out.split("\n");
    const h = lines.indexOf(header);
    expect(lines[h + 1]).toBe(sep);
    expect(lines[h + 2]).toBe(rows[2]);
  });

  it("dòng trùng nhiều từ hơn đứng trước; hoà ⇒ giữ thứ tự gốc; phần còn lại theo thứ tự gốc", () => {
    const big = [header, sep, ...rows].join("\n");
    const out = rerankInput(big, "quý 4 phí thuê 84,0", 10_000_000);
    expect(out).toBe(big); // vừa ngân sách ⇒ nguyên văn
    const tight = rerankInput(big, "quý 4 84,0", big.length - 1);
    const body = tight.split("\n").slice(2);
    // Quý 4 trùng 4 từ (quý, 4, 84, 0), Quý 2 trùng 3, Cả năm 2 (4, 0), Quý 1/3 chỉ 1 (quý)
    expect(body[0]).toBe(rows[3]);
    expect(body.indexOf(rows[1])).toBeLessThan(body.indexOf(rows[4]));
  });

  it("so từ sau chuẩn hoá NFC và bỏ dấu câu", () => {
    const decomposed = "| T2A 04 | Láng | Lang |";
    const other = "| T2A 05 | Thượng Đình | Thuong Dinh |";
    const t = [header, sep, other, other, other, decomposed].join("\n");
    const out = rerankInput(t, "Ga Láng thuộc phường nào?", t.length - 1);
    const body = out.split("\n").slice(2);
    expect(body[0]).toBe(decomposed);
  });

  it("dòng quá dài so với phần ngân sách còn lại ⇒ cắt, kết quả vẫn ≤ ngân sách", () => {
    const long = `| Quý 9 | ${"x".repeat(500)} | 1 |`;
    const t = [header, sep, long, ...rows].join("\n");
    const budget = header.length + sep.length + 60;
    const out = rerankInput(t, "quý 9", budget);
    expect(out.length).toBeLessThanOrEqual(budget);
    expect(out).toContain("| Quý 9 |");
  });

  it("ngân sách nhỏ hơn cả tiêu đề ⇒ vẫn ≤ ngân sách (cắt cứng)", () => {
    const out = rerankInput(table, "quý", 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.length).toBeGreaterThan(0);
  });

  it("tất định, không đổi đầu vào", () => {
    const a = rerankInput(table, "quý 3", 200);
    expect(rerankInput(table, "quý 3", 200)).toBe(a);
    expect(table).toBe([caption, "", header, sep, ...rows].join("\n"));
  });

  it("bảng không có dòng phân cách ⇒ dòng bảng đầu tiên là tiêu đề", () => {
    const t = [caption, header, ...rows].join("\n");
    const out = rerankInput(t, "quý 2", t.length - 1);
    const lines = out.split("\n");
    expect(lines).toContain(header);
    expect(lines[lines.indexOf(header) + 1]).toBe(rows[1]);
  });
});
