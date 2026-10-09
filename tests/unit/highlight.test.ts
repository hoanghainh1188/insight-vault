import { describe, it, expect } from "vitest";
import { buildSegments } from "../../src/renderer/features/source-viewer/highlight";

describe("buildSegments", () => {
  it("chia [before | highlight | after]", () => {
    const segs = buildSegments("0123456789", { charStart: 3, charEnd: 6 });
    expect(segs).toEqual([
      { text: "012", kind: "plain" },
      { text: "345", kind: "highlight" },
      { text: "6789", kind: "plain" },
    ]);
  });

  it("highlight ở đầu → không có 'before'", () => {
    const segs = buildSegments("abcdef", { charStart: 0, charEnd: 3 });
    expect(segs[0]).toEqual({ text: "abc", kind: "highlight" });
    expect(segs[1]).toEqual({ text: "def", kind: "plain" });
  });

  it("highlight ở cuối → không có 'after'", () => {
    const segs = buildSegments("abcdef", { charStart: 3, charEnd: 6 });
    expect(segs[segs.length - 1]).toEqual({ text: "def", kind: "highlight" });
  });

  it("citation rỗng (null) → toàn plain, không highlight", () => {
    const segs = buildSegments("abcdef", null);
    expect(segs).toEqual([{ text: "abcdef", kind: "plain" }]);
  });

  it("offset ngoài phạm vi → phòng thủ, không highlight, không crash", () => {
    expect(buildSegments("abc", { charStart: 5, charEnd: 9 })).toEqual([
      { text: "abc", kind: "plain" },
    ]);
    expect(buildSegments("abc", { charStart: 2, charEnd: 2 })).toEqual([
      { text: "abc", kind: "plain" },
    ]);
  });

  it("chèn mốc trang theo pageBreaks", () => {
    // text 10 ký tự, trang 1 tại 0, trang 2 tại 5
    const segs = buildSegments("0123456789", { charStart: 6, charEnd: 8 }, [
      { page: 1, offset: 0 },
      { page: 2, offset: 5 },
    ]);
    expect(segs[0].pageMark).toBe(1); // đoạn đầu (offset 0)
    const p2 = segs.find((s) => s.pageMark === 2);
    expect(p2).toBeDefined();
    expect(p2!.text.startsWith("5")).toBe(true);
    // vẫn có đoạn highlight [6,8)
    expect(segs.some((s) => s.kind === "highlight" && s.text === "67")).toBe(
      true,
    );
  });

  it("text rỗng → []", () => {
    expect(buildSegments("", { charStart: 0, charEnd: 0 })).toEqual([]);
  });

  it("XSS: HTML/script trong nội dung nguồn giữ nguyên là CHUỖI (không diễn giải) — SourceViewer render text node", () => {
    const payload = "Trước <script>alert(1)</script> sau";
    const segs = buildSegments(payload, { charStart: 6, charEnd: 30 });
    // buildSegments chỉ slice chuỗi — thẻ <script> nằm nguyên trong text của segment, không bị tách/parse.
    const joined = segs.map((s) => s.text).join("");
    expect(joined).toBe(payload);
    expect(segs.some((s) => s.text.includes("<script>"))).toBe(true);
    // KHÔNG có key nào ngoài text/kind/pageMark → không có đường chèn HTML thuộc tính/DOM.
    for (const s of segs) {
      expect(
        Object.keys(s).every((k) => ["text", "kind", "pageMark"].includes(k)),
      ).toBe(true);
    }
  });
});

// 157: vùng tô sáng bắt đầu/kết thúc bằng khoảng trắng/xuống dòng (chunk mở đầu bằng "\n\n" sau câu trước) ⇒ nhãn [n] neo vào
// mảnh inline gần như rỗng ở CUỐI dòng trước (dựng dọc, đè chữ) + vạch tô sáng lẻ ở cuối. Bỏ khoảng trắng hai đầu trước khi cắt.
describe("buildSegments — bỏ khoảng trắng hai đầu vùng tô sáng (157)", () => {
  const text = "sauce.\n\nIn 2017, Vietnam made a day.\n\nNext.";
  const start = text.indexOf("\n\nIn");
  const end = text.indexOf("Next.");

  it("đoạn highlight bắt đầu ở ký tự thật đầu tiên và kết thúc ở ký tự thật cuối cùng", () => {
    const segs = buildSegments(text, { charStart: start, charEnd: end });
    const hl = segs.filter((s) => s.kind === "highlight");
    expect(hl).toHaveLength(1);
    expect(hl[0].text).toBe("In 2017, Vietnam made a day.");
    expect(segs.map((s) => s.text).join("")).toBe(text);
  });

  it("vùng chỉ toàn khoảng trắng ⇒ giữ nguyên (không mất highlight, không crash)", () => {
    const segs = buildSegments(text, {
      charStart: text.indexOf("\n\n"),
      charEnd: text.indexOf("\n\n") + 2,
    });
    expect(segs.filter((s) => s.kind === "highlight")).toHaveLength(1);
    expect(segs.map((s) => s.text).join("")).toBe(text);
  });
});

describe("CSS .hltag (157)", () => {
  it("nhãn [n] luôn trên một dòng", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(
      "src/renderer/features/source-viewer/source-viewer.css",
      "utf8",
    );
    const body = /\.vtext \.hltag\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(body).toMatch(/white-space:\s*nowrap/);
  });
});
