import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_QUOTE_LEN,
  MIN_CORPUS_DOCS,
  MIN_NOISE_DOCS,
  chunkContainsAnyQuote,
  isReviewed,
  loadDataset,
  normalizeForMatch,
  validateManifest,
  validateQuestions,
  type EvalDocument,
  type EvalQuestion,
  type QuestionsFile,
} from "../eval/lib/dataset";

// 108: phần THUẦN của bộ đánh giá (nạp/validate/khớp trích đoạn) — dữ liệu giả nhỏ trong test.

const doc = (id: string, over: Partial<EvalDocument> = {}): EvalDocument => ({
  id,
  title: `Tài liệu ${id}`,
  sourceUrl: `https://example.org/${id}`,
  license: "CC BY-SA 4.0",
  retrievedAt: "2026-10-07",
  noise: false,
  ...over,
});

const docsOk = (): EvalDocument[] => [
  ...Array.from({ length: MIN_CORPUS_DOCS }, (_, i) => doc(`d${i}`)),
  ...Array.from({ length: MIN_NOISE_DOCS }, (_, i) =>
    doc(`n${i}`, { noise: true }),
  ),
];

const q = (id: string, over: Partial<EvalQuestion> = {}): EvalQuestion => ({
  id,
  text: "Câu hỏi?",
  lang: "vi",
  type: "answerable",
  split: "dev",
  quotes: ["Hà Nội là thủ đô"],
  docIds: ["d0"],
  ...over,
});

const texts = new Map([
  ["d0", "Việt Nam.\n\nHà  Nội   là\nthủ đô của nước này."],
  ["d1", "Nội dung khác."],
]);

describe("normalizeForMatch / chunkContainsAnyQuote (R6)", () => {
  it("NFC + gộp mọi khoảng trắng + trim", () => {
    const decomposed = "Hà Nội"; // "Hà" dạng tổ hợp
    expect(normalizeForMatch(`  ${decomposed}\n\t là  `)).toBe("Hà Nội là");
  });

  it("trúng khi chunk chứa BẤT KỲ trích đoạn nào (sau chuẩn hoá)", () => {
    const chunk = "… Hà Nội là\nthủ đô …";
    expect(chunkContainsAnyQuote(chunk, ["không có", "Hà Nội là thủ đô"])).toBe(
      true,
    );
    expect(chunkContainsAnyQuote(chunk, ["Huế là cố đô"])).toBe(false);
    expect(chunkContainsAnyQuote(chunk, [])).toBe(false);
  });
});

describe("validateManifest", () => {
  it("hợp lệ ⇒ không lỗi", () => {
    expect(validateManifest(docsOk())).toEqual([]);
  });

  it("id trùng / thiếu giấy phép / id không kebab-case", () => {
    const errs = validateManifest([
      ...docsOk(),
      doc("d0"),
      doc("bad id"),
      doc("nolic", { license: "" as EvalDocument["license"] }),
    ]);
    expect(errs.join("\n")).toMatch(/trùng.*d0/);
    expect(errs.join("\n")).toMatch(/bad id/);
    expect(errs.join("\n")).toMatch(/giấy phép.*nolic/);
  });

  it(`< MIN_CORPUS_DOCS tài liệu thật hoặc < MIN_NOISE_DOCS nhiễu ⇒ lỗi`, () => {
    const few = docsOk().filter((d) => d.id !== "d0");
    expect(validateManifest(few).join("\n")).toMatch(
      new RegExp(`${MIN_CORPUS_DOCS}`),
    );
    const noNoise = docsOk().filter((d) => !d.noise);
    expect(validateManifest(noNoise).join("\n")).toMatch(/nhiễu/);
  });
});

describe("validateQuestions", () => {
  const file = (questions: EvalQuestion[]): QuestionsFile => ({
    datasetVersion: "1",
    reviewed: null,
    questions,
  });
  const ids = new Set(["d0", "d1", "n0"]);
  const noise = new Set(["n0"]);

  it("hợp lệ ⇒ không lỗi (trích đoạn khớp nguyên văn sau chuẩn hoá)", () => {
    const f = file([
      q("q1"),
      q("q2", { type: "unanswerable", quotes: [], docIds: [] }),
      q("q3", { lang: "en", split: "holdout" }),
    ]);
    expect(validateQuestions(f, texts, ids, noise)).toEqual([]);
  });

  it("answerable thiếu trích đoạn / trích đoạn không có trong tài liệu / quá dài", () => {
    const errs = validateQuestions(
      file([
        q("q1", { quotes: [] }),
        q("q2", { quotes: ["không tồn tại trong d0"] }),
        q("q3", { quotes: ["x".repeat(MAX_QUOTE_LEN + 1)] }),
      ]),
      texts,
      ids,
      noise,
    ).join("\n");
    expect(errs).toMatch(/q1.*trích đoạn/);
    expect(errs).toMatch(/q2.*nguyên văn/);
    expect(errs).toMatch(/q3.*200/);
  });

  it("unanswerable có trích đoạn/docIds ⇒ lỗi; docIds lạ hoặc trỏ tài liệu nhiễu ⇒ lỗi", () => {
    const errs = validateQuestions(
      file([
        q("q1", { type: "unanswerable" }),
        q("q2", { docIds: ["zzz"] }),
        q("q3", { docIds: ["n0"], quotes: ["x"] }),
      ]),
      texts,
      ids,
      noise,
    ).join("\n");
    expect(errs).toMatch(/q1.*unanswerable/);
    expect(errs).toMatch(/q2.*zzz/);
    expect(errs).toMatch(/q3.*nhiễu/);
  });

  it("id trùng, lang/type/split sai, câu rỗng hoặc quá dài", () => {
    const errs = validateQuestions(
      file([
        q("q1"),
        q("q1"),
        q("q2", { lang: "fr" as EvalQuestion["lang"] }),
        q("q3", { type: "maybe" as EvalQuestion["type"] }),
        q("q4", { split: "test" as EvalQuestion["split"] }),
        q("q5", { text: "  " }),
        q("q6", { text: "a".repeat(2001) }),
      ]),
      texts,
      ids,
      noise,
    ).join("\n");
    expect(errs).toMatch(/trùng.*q1/);
    expect(errs).toMatch(/q2.*lang/);
    expect(errs).toMatch(/q3.*type/);
    expect(errs).toMatch(/q4.*split/);
    expect(errs).toMatch(/q5.*rỗng/);
    expect(errs).toMatch(/q6.*2000/);
  });
});

describe("isReviewed", () => {
  it("null ⇒ false; có by + date ⇒ true", () => {
    const base = { datasetVersion: "1", questions: [] };
    expect(isReviewed({ ...base, reviewed: null })).toBe(false);
    expect(
      isReviewed({ ...base, reviewed: { by: "Harry", date: "2026-10-07" } }),
    ).toBe(true);
    expect(isReviewed({ ...base, reviewed: { by: "", date: "" } })).toBe(false);
  });
});

describe("loadDataset", () => {
  let dir = "";
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("đọc manifest + tệp .md + questions.json; thiếu tệp tài liệu ⇒ lỗi", () => {
    dir = mkdtempSync(join(tmpdir(), "iv-eval-ds-"));
    mkdirSync(join(dir, "corpus"));
    writeFileSync(
      join(dir, "corpus", "manifest.json"),
      JSON.stringify([doc("d0"), doc("gone")]),
    );
    writeFileSync(join(dir, "corpus", "d0.md"), "Hà Nội là thủ đô.");
    writeFileSync(
      join(dir, "questions.json"),
      JSON.stringify({
        datasetVersion: "1",
        reviewed: null,
        questions: [q("q1")],
      }),
    );
    const ds = loadDataset(dir);
    expect(ds.documents.map((d) => d.id)).toEqual(["d0", "gone"]);
    expect(ds.texts.get("d0")).toBe("Hà Nội là thủ đô.");
    expect(ds.questions.questions).toHaveLength(1);
    expect(ds.loadErrors.join("\n")).toMatch(/gone\.md/);
  });
});
