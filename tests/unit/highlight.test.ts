import { describe, it, expect } from "vitest";
import { buildSegments } from "../../src/renderer/features/source-viewer/highlight";

describe("buildSegments", () => {
  it("chia [before | highlight | after]", () => {
    // 159: ranh giới vùng tô là ranh giới chữ (giữa chữ ⇒ trình xem nới về đầu chữ — test riêng bên dưới).
    const segs = buildSegments("012 345 6789", { charStart: 4, charEnd: 7 });
    expect(segs).toEqual([
      { text: "012 ", kind: "plain" },
      { text: "345", kind: "highlight" },
      { text: " 6789", kind: "plain" },
    ]);
  });

  it("highlight ở đầu → không có 'before'", () => {
    const segs = buildSegments("abcdef", { charStart: 0, charEnd: 3 });
    expect(segs[0]).toEqual({ text: "abc", kind: "highlight" });
    expect(segs[1]).toEqual({ text: "def", kind: "plain" });
  });

  it("highlight ở cuối → không có 'after'", () => {
    const segs = buildSegments("abc def", { charStart: 4, charEnd: 7 });
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
    // text 10 ký tự, trang 1 tại 0, trang 2 tại 5 (vùng tô [6,8) bắt đầu ở đầu chữ — 159)
    const segs = buildSegments("01234 67 9", { charStart: 6, charEnd: 8 }, [
      { page: 1, offset: 0 },
      { page: 2, offset: 5 },
    ]);
    expect(segs[0].pageMark).toBe(1); // đoạn đầu (offset 0)
    const p2 = segs.find((s) => s.pageMark === 2);
    expect(p2).toBeDefined();
    expect(p2!.text.startsWith(" ")).toBe(true);
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

// 159 (phần hiển thị): chunk chồng lấn bắt đầu giữa chữ (chunker lùi 150 ký tự thô). Trình xem không tô một mảnh chữ:
// - mảnh là ĐUÔI NGẮN của đoạn trước (tới xuống dòng) ⇒ bỏ qua, tô từ đoạn kế;
// - còn lại ⇒ nới về đầu chữ. Chỉ đổi hiển thị — locator/dữ liệu không đổi.
describe("buildSegments — không bắt đầu giữa chữ (159)", () => {
  const hlText = (text: string, start: number, end: number): string =>
    buildSegments(text, { charStart: start, charEnd: end })
      .filter((s) => s.kind === "highlight")
      .map((s) => s.text)
      .join("");

  it("mảnh đuôi đoạn trước ('sauc|e.' + xuống dòng) ⇒ tô từ đoạn kế", () => {
    const text = "herbs and sauce.\n\nIn 2017, Vietnam made a day.\n\nNext.";
    const start = text.indexOf("e.\n\nIn");
    const end = text.indexOf("\n\nNext");
    expect(hlText(text, start, end)).toBe("In 2017, Vietnam made a day.");
  });

  it("giữa chữ trong câu ('etymo|logy of its name') ⇒ nới về đầu chữ", () => {
    const text = "as well as to the etymology of its name. The Hanoi style.";
    const start = text.indexOf("logy");
    expect(hlText(text, start, text.length)).toBe(
      "etymology of its name. The Hanoi style.",
    );
  });

  it("chữ tiếng Việt có dấu ('Ph|ở bò') ⇒ nới về đầu chữ", () => {
    const text = "Món Phở bò rất ngon.";
    const start = text.indexOf("ở bò");
    expect(hlText(text, start, text.length)).toBe("Phở bò rất ngon.");
  });

  it("đã ở đầu chữ / đầu văn bản ⇒ không đổi", () => {
    const text = "Alpha beta gamma.";
    expect(hlText(text, text.indexOf("beta"), text.length)).toBe("beta gamma.");
    expect(hlText(text, 0, 5)).toBe("Alpha");
  });

  it("đuôi dài (không xuống dòng gần) ⇒ không bỏ cả câu, chỉ nới về đầu chữ", () => {
    const text = `word${"x".repeat(5)} continues with a long sentence that keeps going and going without any line break here.`;
    const start = 6;
    expect(hlText(text, start, text.length).startsWith("wordxxxxx")).toBe(true);
  });

  it("mảnh đuôi chiếm trọn vùng tô ⇒ giữ nguyên (không mất highlight)", () => {
    const text = "sauce.\n\nNext.";
    const start = text.indexOf("e.");
    const segs = buildSegments(text, { charStart: start, charEnd: start + 2 });
    expect(segs.filter((s) => s.kind === "highlight")).toHaveLength(1);
    expect(segs.map((s) => s.text).join("")).toBe(text);
  });
});
