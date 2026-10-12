import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { parsePdf } from "../../src/main/services/ingestion/parsers/pdf";
import {
  docFile,
  docFormat,
  loadDataset,
  sha256Hex,
  validateManifest,
  validateQuestions,
  type EvalDocument,
} from "../eval/lib/dataset";

// 177 (T013, SC-002/003/005, clarify #5): kiểm corpus PDF THẬT của bộ đánh giá — không mô hình, không mạng, chạy trong `npm test`:
// sha256 khớp; trích một lần làm nóng rồi 2 lần có đo giờ ⇒ văn bản giống hệt, lần NHANH NHẤT ≤ 1000 ms (chống dao động khi chạy
// song song + coverage); tổng dung lượng PDF ≤ 1 MiB; metadata không có trường cá nhân; mọi trích dẫn khớp văn bản parsePdf.

const EVAL_DIR = join(__dirname, "../eval");
const CORPUS = join(EVAL_DIR, "corpus");
const manifest = JSON.parse(
  readFileSync(join(CORPUS, "manifest.json"), "utf8"),
) as EvalDocument[];
const pdfs = manifest.filter((d) => docFormat(d) === "pdf");
const read = (d: EvalDocument) =>
  new Uint8Array(readFileSync(join(CORPUS, docFile(d))));

const MAX_PARSE_MS = 1000;
const MAX_TOTAL_BYTES = 1_048_576;
/** Trường Info có thể lộ danh tính / máy người soạn. */
const PERSONAL_INFO_KEYS = ["Author", "Subject", "Keywords"] as const;
const PERSONAL_PATH = /(\/Users\/|\/home\/|[A-Za-z]:\\)/;

describe("corpus PDF của bộ đánh giá (177)", () => {
  it("có ít nhất 2 PDF (1 fixture CC0-1.0 + 1 Wikipedia CC BY-SA 4.0)", () => {
    expect(pdfs.length).toBeGreaterThanOrEqual(2);
    expect(pdfs.some((d) => d.license === "CC0-1.0")).toBe(true);
    expect(pdfs.some((d) => d.license === "CC BY-SA 4.0")).toBe(true);
  });

  it("tổng dung lượng PDF ≤ 1 MiB (SC-005)", () => {
    const total = pdfs.reduce((s, d) => s + read(d).byteLength, 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
  });

  it.each(pdfs.map((d) => [d.id, d] as const))(
    "%s: sha256 khớp manifest",
    (_id, d) => {
      expect(sha256Hex(read(d))).toBe(d.sha256);
    },
  );

  it.each(pdfs.map((d) => [d.id, d] as const))(
    "%s: trích tất định, lần nhanh nhất ≤ 1000 ms",
    async (_id, d) => {
      const bytes = read(d);
      const warm = await parsePdf(bytes.slice()); // làm nóng (pdfjs nạp động lần đầu)
      const times: number[] = [];
      const texts: string[] = [];
      for (let i = 0; i < 2; i += 1) {
        const t0 = performance.now();
        const r = await parsePdf(bytes.slice());
        times.push(performance.now() - t0);
        texts.push(r.pages.map((p) => p.text).join("\n"));
      }
      const warmText = warm.pages.map((p) => p.text).join("\n");
      expect(warmText.trim()).not.toBe("");
      expect(texts[0]).toBe(warmText);
      expect(texts[1]).toBe(warmText);
      expect(Math.min(...times)).toBeLessThanOrEqual(MAX_PARSE_MS);
    },
    30_000,
  );

  // Security review (M1): PDF bên thứ ba không được mang hành động / mã chủ động. Liên kết /URI tham khảo của Wikipedia được phép.
  it.each(pdfs.map((d) => [d.id, d] as const))(
    "%s: không có JavaScript / OpenAction / Launch / EmbeddedFile / RichMedia / XFA / AcroForm",
    (_id, d) => {
      const raw = Buffer.from(read(d)).toString("latin1");
      expect(raw).not.toMatch(
        /\/(JavaScript|JS|OpenAction|AA|Launch|EmbeddedFiles?|RichMedia|XFA|AcroForm|SubmitForm)\b/,
      );
    },
  );

  it.each(pdfs.map((d) => [d.id, d] as const))(
    "%s: metadata không có trường cá nhân / đường dẫn máy",
    async (_id, d) => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const task = pdfjs.getDocument({ data: read(d) });
      const doc = await task.promise;
      const info = (await doc.getMetadata()).info as unknown as Record<
        string,
        unknown
      >;
      for (const k of PERSONAL_INFO_KEYS) {
        expect(String(info[k] ?? "").trim(), k).toBe("");
      }
      expect(JSON.stringify(info)).not.toMatch(PERSONAL_PATH);
      await task.destroy();
    },
  );

  it("bộ dữ liệu thật hợp lệ: manifest + mọi trích dẫn (gồm PDF) khớp văn bản khi nạp", async () => {
    const ds = await loadDataset(EVAL_DIR);
    const ids = new Set(ds.documents.map((d) => d.id));
    const noise = new Set(ds.documents.filter((d) => d.noise).map((d) => d.id));
    const errors = [
      ...ds.loadErrors,
      ...validateManifest(ds.documents),
      ...validateQuestions(ds.questions, ds.texts, ids, noise, ds.documents),
    ];
    expect(errors, errors.join("\n")).toEqual([]);
  }, 30_000);

  it("có câu hỏi trỏ vào MỖI PDF; câu PDF chỉ tiếng Việt; có câu không đáp án topic 'pdf'", async () => {
    const ds = await loadDataset(EVAL_DIR);
    const qs = ds.questions.questions;
    for (const d of pdfs) {
      expect(
        qs.some((q) => q.docIds.includes(d.id)),
        `thiếu câu hỏi cho ${d.id}`,
      ).toBe(true);
    }
    const pdfIds = new Set(pdfs.map((d) => d.id));
    const pdfQs = qs.filter(
      (q) => q.docIds.some((id) => pdfIds.has(id)) || q.topic === "pdf",
    );
    expect(pdfQs.every((q) => q.lang === "vi")).toBe(true);
    expect(qs.some((q) => q.topic === "pdf")).toBe(true);
    for (const split of ["dev", "holdout"] as const) {
      expect(
        pdfQs.some((q) => q.split === split && q.type === "answerable"),
        `thiếu câu PDF có đáp án ở ${split}`,
      ).toBe(true);
    }
  }, 30_000);
});
