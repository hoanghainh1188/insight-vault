import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { makePdf } from "../fixtures/pdf/make-pdf";
import {
  MAX_QUOTE_LEN,
  MIN_CORPUS_DOCS,
  MIN_NOISE_DOCS,
  chunkContainsAnyQuote,
  docFile,
  docFormat,
  isReviewed,
  loadDataset,
  normalizeForMatch,
  sha256Hex,
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
  const docsQ = [doc("d0"), doc("d1"), doc("n0", { noise: true })];

  it("hợp lệ ⇒ không lỗi (trích đoạn khớp nguyên văn sau chuẩn hoá)", () => {
    const f = file([
      q("q1"),
      q("q2", { type: "unanswerable", quotes: [], docIds: [] }),
      q("q3", { lang: "en", split: "holdout" }),
    ]);
    expect(validateQuestions(f, texts, ids, noise, docsQ)).toEqual([]);
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
      docsQ,
    ).join("\n");
    expect(errs).toMatch(/q1.*trích đoạn/);
    expect(errs).toMatch(/q2.*nguyên văn/);
    // 177 (FR-004): thông báo nêu cả mã câu hỏi lẫn mã tài liệu.
    expect(errs).toMatch(/câu q2: trích đoạn không có nguyên văn trong d0:/);
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
      docsQ,
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
      docsQ,
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

  it("đọc manifest + tệp .md + questions.json; thiếu tệp tài liệu ⇒ lỗi", async () => {
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
    const ds = await loadDataset(dir);
    expect(ds.documents.map((d) => d.id)).toEqual(["d0", "gone"]);
    expect(ds.texts.get("d0")).toBe("Hà Nội là thủ đô.");
    expect(ds.questions.questions).toHaveLength(1);
    expect(ds.loadErrors.join("\n")).toMatch(/gone\.md/);
  });
});

// 177: PDF trong bộ đánh giá — manifest format / file / sha256 / giấy phép (contracts/manifest.md M1–M5, Q1, Q3).
const SHA = "a".repeat(64);
const pdfDoc = (id: string, over: Partial<EvalDocument> = {}): EvalDocument =>
  doc(id, { format: "pdf", sha256: SHA, ...over });

describe("177: docFormat / docFile / sha256Hex", () => {
  it("thiếu format ⇒ md; thiếu file ⇒ <id>.<format>", () => {
    expect(docFormat(doc("a"))).toBe("md");
    expect(docFormat(pdfDoc("b"))).toBe("pdf");
    expect(docFile(doc("a"))).toBe("a.md");
    expect(docFile(pdfDoc("b"))).toBe("b.pdf");
    expect(docFile(pdfDoc("b", { file: "khac.pdf" }))).toBe("khac.pdf");
  });

  it("sha256Hex = node:crypto sha256 dạng hex thường", () => {
    const bytes = new TextEncoder().encode("abc");
    expect(sha256Hex(bytes)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(sha256Hex(bytes)).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
  });
});

describe("177: validateManifest — tài liệu PDF", () => {
  const withDocs = (...extra: EvalDocument[]) =>
    validateManifest([...docsOk(), ...extra]).join("\n");

  it("PDF hợp lệ + giấy phép CC0-1.0 ⇒ không lỗi; tài liệu cũ không format vẫn hợp lệ", () => {
    expect(withDocs(pdfDoc("p1", { license: "CC0-1.0" }))).toBe("");
  });

  it("format sai ⇒ lỗi (M1)", () => {
    expect(withDocs(doc("x", { format: "docx" as never }))).toMatch(
      /format sai ở "x"/,
    );
  });

  it.each(["a/b.pdf", "a\\b.pdf", "../b.pdf", "..", ""])(
    "file không hợp lệ (%j) ⇒ lỗi (M2)",
    (file) => {
      expect(withDocs(pdfDoc("x", { file }))).toMatch(
        /file không hợp lệ ở "x"/,
      );
    },
  );

  it.each([undefined, "abc", "A".repeat(64), "g".repeat(64)])(
    "PDF thiếu / sai sha256 (%j) ⇒ lỗi (M3)",
    (sha256) => {
      expect(withDocs(pdfDoc("x", { sha256 }))).toMatch(
        /thiếu\/sai sha256 ở "x"/,
      );
    },
  );

  it("giấy phép lạ ⇒ lỗi (M4)", () => {
    expect(withDocs(pdfDoc("x", { license: "MIT" as never }))).toMatch(
      /giấy phép ở "x"/,
    );
  });

  it("tài liệu nhiễu là PDF ⇒ lỗi (M5)", () => {
    expect(withDocs(pdfDoc("x", { noise: true }))).toMatch(
      /tài liệu nhiễu không được là PDF "x"/,
    );
  });
});

describe("177: validateQuestions — PDF", () => {
  const docs = [doc("d0"), pdfDoc("p0")];
  const ids = new Set(docs.map((d) => d.id));
  const t = new Map([
    ["d0", "Hà Nội là thủ đô."],
    ["p0", "| Năm | Doanh thu |\n| 2024 | 1.200 |"],
  ]);
  const run = (qs: EvalQuestion[]) =>
    validateQuestions(
      { datasetVersion: "4", reviewed: null, questions: qs },
      t,
      ids,
      new Set(),
      docs,
    ).join("\n");

  it("docIds trộn md + pdf ⇒ lỗi (Q1); một định dạng ⇒ hợp lệ", () => {
    expect(
      run([q("q1", { docIds: ["d0", "p0"], quotes: ["Hà Nội là thủ đô"] })]),
    ).toMatch(/câu q1: docIds trộn định dạng/);
    expect(
      run([q("q2", { docIds: ["p0"], quotes: ["| 2024 | 1.200 |"] })]),
    ).toBe("");
  });

  it("topic 'pdf' chỉ hợp lệ ở câu unanswerable (Q3)", () => {
    expect(
      run([
        q("u1", { type: "unanswerable", quotes: [], docIds: [], topic: "pdf" }),
      ]),
    ).toBe("");
    expect(run([q("a1", { topic: "pdf" })])).toMatch(/câu a1: topic sai/);
    expect(
      run([
        q("u2", {
          type: "unanswerable",
          quotes: [],
          docIds: [],
          topic: "md" as never,
        }),
      ]),
    ).toMatch(/câu u2: topic sai/);
  });
});

describe("177: loadDataset — PDF qua parsePdf thật", () => {
  let dir = "";
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  const pdfBytes = makePdf([
    {
      width: 400,
      height: 300,
      texts: [
        { x: 40, y: 60, size: 12, text: "Doanh thu năm 2024 tăng mạnh." },
      ],
    },
  ]);

  function setup(
    manifest: EvalDocument[],
    files: Record<string, Uint8Array | string>,
  ) {
    dir = mkdtempSync(join(tmpdir(), "iv-eval-pdf-"));
    mkdirSync(join(dir, "corpus"));
    writeFileSync(
      join(dir, "corpus", "manifest.json"),
      JSON.stringify(manifest),
    );
    for (const [name, data] of Object.entries(files)) {
      writeFileSync(join(dir, "corpus", name), data);
    }
    writeFileSync(
      join(dir, "questions.json"),
      JSON.stringify({ datasetVersion: "4", reviewed: null, questions: [] }),
    );
  }

  it("texts của PDF = văn bản parsePdf; sha256 khớp ⇒ không lỗi", async () => {
    setup([doc("d0"), pdfDoc("p0", { sha256: sha256Hex(pdfBytes) })], {
      "d0.md": "Hà Nội.",
      "p0.pdf": pdfBytes,
    });
    const ds = await loadDataset(dir);
    expect(ds.loadErrors).toEqual([]);
    expect(normalizeForMatch(ds.texts.get("p0") ?? "")).toContain(
      "Doanh thu năm 2024 tăng mạnh.",
    );
  });

  it("trích dẫn vắt qua ranh giới trang KHÔNG khớp (chunk không vắt trang)", async () => {
    const twoPages = makePdf([
      {
        width: 400,
        height: 300,
        texts: [{ x: 40, y: 60, size: 12, text: "Cuối trang một." }],
      },
      {
        width: 400,
        height: 300,
        texts: [{ x: 40, y: 60, size: 12, text: "Đầu trang hai." }],
      },
    ]);
    setup([pdfDoc("p0", { sha256: sha256Hex(twoPages) })], {
      "p0.pdf": twoPages,
    });
    const ds = await loadDataset(dir);
    const t = ds.texts.get("p0") ?? "";
    expect(chunkContainsAnyQuote(t, ["Cuối trang một."])).toBe(true);
    expect(chunkContainsAnyQuote(t, ["Đầu trang hai."])).toBe(true);
    expect(chunkContainsAnyQuote(t, ["trang một. Đầu trang"])).toBe(false);
  });

  it("sha256 lệch ⇒ loadErrors 'sha256 lệch'", async () => {
    setup([pdfDoc("p0", { sha256: "0".repeat(64) })], { "p0.pdf": pdfBytes });
    const ds = await loadDataset(dir);
    expect(ds.loadErrors.join("\n")).toMatch(/sha256 lệch ở p0\.pdf/);
  });

  it("PDF hỏng (parsePdf ném) ⇒ gom vào loadErrors, không reject cả loadDataset", async () => {
    const junk = new TextEncoder().encode("đây không phải PDF");
    setup([doc("d0"), pdfDoc("p0", { sha256: sha256Hex(junk) })], {
      "d0.md": "Hà Nội.",
      "p0.pdf": junk,
    });
    const ds = await loadDataset(dir);
    expect(ds.loadErrors.join("\n")).toMatch(/không trích được p0\.pdf/);
    expect(ds.texts.get("d0")).toBe("Hà Nội.");
  });

  it("thiếu tệp PDF ⇒ lỗi", async () => {
    setup([pdfDoc("p0")], {});
    const ds = await loadDataset(dir);
    expect(ds.loadErrors.join("\n")).toMatch(/thiếu tệp p0\.pdf/);
  });

  it("PDF không ra chữ ⇒ rỗng", async () => {
    const empty = makePdf([{ width: 200, height: 200, texts: [] }]);
    setup([pdfDoc("p0", { sha256: sha256Hex(empty) })], { "p0.pdf": empty });
    const ds = await loadDataset(dir);
    expect(ds.loadErrors.join("\n")).toMatch(/tệp p0\.pdf rỗng/);
  });

  it("file tuỳ chỉnh được dùng thay <id>.<format>", async () => {
    setup(
      [pdfDoc("p0", { file: "ten-khac.pdf", sha256: sha256Hex(pdfBytes) })],
      {
        "ten-khac.pdf": pdfBytes,
      },
    );
    const ds = await loadDataset(dir);
    expect(ds.loadErrors).toEqual([]);
  });
});
