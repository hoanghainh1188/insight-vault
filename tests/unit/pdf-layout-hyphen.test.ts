import { describe, expect, it, vi } from "vitest";

const { logEvent } = vi.hoisted(() => ({ logEvent: vi.fn() }));
vi.mock("../../src/main/logging", () => ({ logEvent }));
import {
  addLines,
  buildLexicon,
  createLexicon,
  decideHyphen,
  endsWithHyphenBreak,
  joinAcrossLines,
  mergeLexicons,
} from "../../src/main/services/ingestion/pdf-layout/hyphen";
import { HYPHEN_PAIRS } from "../fixtures/pdf/hyphen-pairs";

// 147 (a, research R6, clarify #16–#20): quyết định gạch nối cuối dòng — chỉ GIỮ gạch khi chắc (bằng chứng trong tài liệu,
// chữ hoa / số, gạch treo, tiếng Việt), còn lại hành vi cũ (chữ thường ⇒ nối liền bỏ gạch). Không từ điển.

const EMPTY = buildLexicon([]);

describe("decideHyphen — từng luật", () => {
  it("gạch treo (liên từ phía sau) ⇒ suspend", () => {
    for (const c of ["and", "or", "und", "oder", "et", "ou", "và", "hoặc"])
      expect(decideHyphen("pre", c, EMPTY)).toBe("suspend");
    expect(decideHyphen("tiền", "và", EMPTY)).toBe("suspend");
  });

  it("tiếng Việt ở một phía (ă â ê ô ơ ư đ, dấu hỏi / nặng; NFC hoặc NFD) ⇒ keep", () => {
    expect(decideHyphen("hợp", "đồng", EMPTY)).toBe("keep");
    expect(decideHyphen("xe", "đạp", EMPTY)).toBe("keep");
    expect(decideHyphen("tiêu", "chuẩn", EMPTY)).toBe("keep");
    expect(decideHyphen("kinh", "tế", EMPTY)).toBe("keep");
    expect(
      decideHyphen("hợp".normalize("NFD"), "đồng".normalize("NFD"), EMPTY),
    ).toBe("keep");
  });

  it("dấu dùng chung với ngôn ngữ khác (mũ / trăng đứng riêng, đ, й) KHÔNG tính là tiếng Việt", () => {
    for (const [p, n] of [
      ["pâ", "turage"],
      ["fo", "rêt"],
      ["перей", "ти"],
      ["ro", "mână"],
      ["rođ", "endan"],
    ])
      expect(decideHyphen(p, n, EMPTY)).toBe("default");
  });

  it("tiếng Việt thắng bằng chứng dạng liền (không bao giờ nối dính)", () => {
    const lex = buildLexicon(["hợpđồng"]);
    expect(decideHyphen("hợp", "đồng", lex)).toBe("keep");
  });

  it("chữ HOA / số phía sau, hoặc số phía trước ⇒ keep", () => {
    expect(decideHyphen("Capital", "Case", EMPTY)).toBe("keep");
    expect(decideHyphen("Covid", "19", EMPTY)).toBe("keep");
    expect(decideHyphen("3", "dimensional", EMPTY)).toBe("keep");
  });

  it("bằng chứng dạng gạch (không có dạng liền) ⇒ keep; dạng liền (không có dạng gạch) ⇒ join", () => {
    expect(
      decideHyphen("long", "term", buildLexicon(["a long-term view"])),
    ).toBe("keep");
    expect(
      decideHyphen("infor", "mation", buildLexicon(["Information is key"])),
    ).toBe("join");
  });

  it("bằng chứng mâu thuẫn (cả hai dạng) ⇒ default; không bằng chứng ⇒ default", () => {
    const both = buildLexicon(["use e-mail", "an email"]);
    expect(decideHyphen("e", "mail", both)).toBe("default");
    expect(decideHyphen("long", "term", EMPTY)).toBe("default");
  });

  it("so khớp bằng chứng không phân biệt hoa thường, NFC / NFD, U+2010 / U+2011", () => {
    const lex = buildLexicon(["Real\u2011Time alerts", "Café-crème"]);
    expect(decideHyphen("real", "time", lex)).toBe("keep");
    expect(
      decideHyphen("café".normalize("NFD"), "crème".normalize("NFD"), lex),
    ).toBe("keep");
  });
});

describe("buildLexicon / mergeLexicons", () => {
  it("bỏ mảnh ngắt dòng cuối dòng (không thành bằng chứng)", () => {
    const lex = buildLexicon(["our long-", "term plan"]);
    expect(lex.hyphenated.has("long-term")).toBe(false);
    expect(lex.plain.has("long")).toBe(false);
    expect(lex.plain.has("term")).toBe(true);
  });

  it("từ ghép nhiều phần + từ trơn", () => {
    const lex = buildLexicon(["A state-of-the-art system."]);
    expect(lex.hyphenated.has("state-of-the-art")).toBe(true);
    expect(lex.plain.has("system")).toBe(true);
  });

  it("gộp: có ở bất kỳ tập nào ⇒ có", () => {
    const m = mergeLexicons(buildLexicon(["a long-term"]), buildLexicon(["x"]));
    expect(m.hyphenated.has("long-term")).toBe(true);
    expect(m.plain.has("x")).toBe(true);
    expect(m.plain.has("y")).toBe(false);
  });
});

describe("createLexicon / addLines (bằng chứng tài liệu cộng dồn — tra O(1))", () => {
  it("cộng dồn từ nhiều trang vào cùng một tập", () => {
    const doc = createLexicon();
    addLines(doc, ["page one has long-term"]);
    addLines(doc, ["page two says information"]);
    expect(doc.hyphenated.has("long-term")).toBe(true);
    expect(doc.plain.has("information")).toBe(true);
    expect(decideHyphen("infor", "mation", doc)).toBe("join");
  });
});

describe("joinAcrossLines / endsWithHyphenBreak", () => {
  it("dòng không kết thúc bằng gạch nối từ ⇒ null (gạch đứng riêng là dấu câu)", () => {
    expect(joinAcrossLines("plain line", "next", EMPTY)).toBeNull();
    expect(joinAcrossLines("giá trị -", "tiếp theo", EMPTY)).toBeNull();
    expect(endsWithHyphenBreak("giá trị -")).toBe(false);
    expect(endsWithHyphenBreak("long-")).toBe(true);
    expect(endsWithHyphenBreak("long\u2010")).toBe(true);
    expect(endsWithHyphenBreak("trích\u00AD")).toBe(true);
    expect(endsWithHyphenBreak("1998-")).toBe(true);
    expect(endsWithHyphenBreak("en dash\u2013")).toBe(false);
  });

  it("default = hành vi cũ: chữ thường ⇒ nối bỏ gạch; khác ⇒ giữ", () => {
    expect(joinAcrossLines("a long-", "term plan", EMPTY)).toEqual({
      text: "a longterm plan",
      decision: "default",
    });
    expect(joinAcrossLines("x-", "(y)", EMPTY)?.text).toBe("x-(y)");
  });

  it("ghép nhiều phần tra bằng chứng cả cụm", () => {
    const lex = buildLexicon(["A state-of-the-art system."]);
    expect(joinAcrossLines("the state-of-the-", "art model", lex)?.text).toBe(
      "the state-of-the-art model",
    );
  });
});

// SC-004: nhóm "chắc" (quyết định ≠ default) ≥ 95% đúng; toàn tập không kém hành vi cũ; 0 tiếng Việt nối dính.
describe("tập cặp từ gắn nhãn (SC-004)", () => {
  /** Hành vi 112 (appendLine trước 147). */
  function legacy(acc: string, next: string): string {
    if (/\u00AD$/.test(acc)) return acc.slice(0, -1) + next;
    if (/(\p{L})-$/u.test(acc))
      return /^\p{Ll}/u.test(next) ? acc.slice(0, -1) + next : acc + next;
    return `${acc} ${next}`;
  }

  const results = HYPHEN_PAIRS.map((p) => {
    const lex = buildLexicon([...(p.context ?? []), p.prev, p.next]);
    const got = joinAcrossLines(p.prev, p.next, lex);
    return {
      p,
      text: got?.text ?? `${p.prev} ${p.next}`,
      sure: got !== null && got.decision !== "default",
      old: legacy(p.prev, p.next),
    };
  });

  it("≥ 40 cặp, có Anh + Việt", () => {
    const ok = (k: "text" | "old") =>
      results.filter((r) => r[k] === r.p.expected).length;
    const sure = results.filter((r) => r.sure);
    process.stdout.write(
      `[SC-004] bỏ sót (để default mà sai): ${results.filter((r) => !r.sure && r.text !== r.p.expected).length} · ${results.length} cặp · nhóm chắc ${sure.filter((r) => r.text === r.p.expected).length}/${sure.length} · đúng toàn tập: mới ${ok("text")} / cũ ${ok("old")}\n`,
    );
    expect(HYPHEN_PAIRS.length).toBeGreaterThanOrEqual(40);
    expect(HYPHEN_PAIRS.some((p) => p.lang === "vi")).toBe(true);
  });

  it("nhóm chắc ≥ 95% đúng", () => {
    const sure = results.filter((r) => r.sure);
    const wrong = sure.filter((r) => r.text !== r.p.expected);
    expect(wrong.map((r) => `${r.p.prev}|${r.p.next} ⇒ ${r.text}`)).toEqual([]);
    expect(sure.length - wrong.length).toBeGreaterThanOrEqual(
      0.95 * sure.length,
    );
  });

  it("toàn tập không kém hành vi cũ (mọi cặp cũ đúng thì nay vẫn đúng)", () => {
    const regressed = results.filter(
      (r) => r.old === r.p.expected && r.text !== r.p.expected,
    );
    expect(regressed.map((r) => r.p.note + ": " + r.p.prev)).toEqual([]);
    const ok = (k: "text" | "old") =>
      results.filter((r) => r[k] === r.p.expected).length;
    expect(ok("text")).toBeGreaterThan(ok("old"));
  });

  it("0 trường hợp tiếng Việt bị nối dính", () => {
    const vi = results.filter(
      (r) => r.p.lang === "vi" && !/\u00AD/.test(r.p.prev),
    );
    expect(vi.filter((r) => r.text !== r.p.expected)).toEqual([]);
  });
});

// clarify #26 / FR-012: luật mới ném lỗi ⇒ hành vi cũ cho đúng chỗ đó + log mã lỗi (không nội dung).
describe("joinAcrossLines — luật lỗi", () => {
  it("bằng chứng ném lỗi ⇒ default (chữ thường ⇒ nối liền) + logEvent", () => {
    const bad = {
      hyphenated: {
        has: (): boolean => {
          throw new TypeError("boom");
        },
      },
      plain: { has: () => false },
    };
    expect(joinAcrossLines("a long-", "term plan", bad)).toEqual({
      text: "a longterm plan",
      decision: "default",
    });
    expect(logEvent).toHaveBeenCalledWith("pdf.layout.fallback", {
      feature: "hyphen",
      errorType: "TypeError",
    });
  });
});
