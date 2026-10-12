import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePdf } from "../../../src/main/services/ingestion/parsers/pdf";

// 108: bộ đánh giá truy xuất — nạp + validate + khớp trích đoạn đáp án. Hàm thuần (trừ loadDataset đọc tệp),
// unit test ở tests/unit/eval-dataset.test.ts. Cấu trúc: specs/20261007-111628-relevance-calibration/data-model.md
// 177: tài liệu PDF (format / file / sha256) nạp qua parsePdf THẬT của app — trích dẫn kiểm trên văn bản parsePdf (không bản
// chụp; specs/20261010-114620-eval-pdf/contracts/manifest.md).

export const MIN_CORPUS_DOCS = 8;
export const MIN_NOISE_DOCS = 2;
export const MAX_QUOTE_LEN = 200;
const MAX_QUESTION_LEN = 2000; // = MAX_QUESTION_LEN của rag (câu hỏi người dùng)

export type EvalLicense = "public-domain-vn-law" | "CC BY-SA 4.0" | "CC0-1.0";

/** 177: định dạng tài liệu đánh giá — thiếu ⇒ "md". */
export type EvalFormat = "md" | "pdf";

export interface EvalDocument {
  id: string;
  title: string;
  sourceUrl: string;
  license: EvalLicense;
  retrievedAt: string;
  noise: boolean;
  /** 177: thiếu ⇒ "md" */
  format?: EvalFormat;
  /** 177: tên tệp trong corpus/; thiếu ⇒ `<id>.<format>` */
  file?: string;
  /** 177: sha256 hex thường của bytes tệp — bắt buộc với PDF */
  sha256?: string;
  revisionId?: number;
  /** 177: cách tái tạo (PDF fixture) */
  generator?: string;
}

export interface EvalQuestion {
  id: string;
  text: string;
  lang: "vi" | "en";
  type: "answerable" | "unanswerable";
  split: "dev" | "holdout";
  quotes: string[];
  docIds: string[];
  /** 177: câu KHÔNG đáp án sát chủ đề PDF ⇒ xếp vào nhóm PDF khi báo cáo */
  topic?: "pdf";
  /** 187: câu KHÔNG đáp án sát chủ đề ⇒ id tài liệu thật (không nhiễu) mà câu "giả vờ" hỏi */
  topicDocId?: string;
}

export interface QuestionsFile {
  datasetVersion: string;
  reviewed: { by: string; date: string } | null;
  questions: EvalQuestion[];
}

export interface Dataset {
  documents: EvalDocument[];
  /** id tài liệu → văn bản khi nạp (.md: nội dung tệp; PDF: văn bản parsePdf) */
  texts: Map<string, string>;
  questions: QuestionsFile;
  /** lỗi khi đọc tệp (thiếu tệp tài liệu…) */
  loadErrors: string[];
}

const LICENSES: readonly string[] = [
  "public-domain-vn-law",
  "CC BY-SA 4.0",
  "CC0-1.0",
];
const FORMATS: readonly string[] = ["md", "pdf"];
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** 177: định dạng của tài liệu (thiếu ⇒ "md"). */
export function docFormat(d: Pick<EvalDocument, "format">): EvalFormat {
  return d.format ?? "md";
}

/** 177: tên tệp của tài liệu trong corpus/ (thiếu ⇒ `<id>.<format>`). */
export function docFile(
  d: Pick<EvalDocument, "id" | "format" | "file">,
): string {
  return d.file ?? `${d.id}.${docFormat(d)}`;
}

/** 177: sha256 hex thường. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Tên tệp phẳng trong corpus/ — không phân cách đường dẫn, không "..". */
function isPlainFileName(f: string): boolean {
  return f.trim() !== "" && !/[\\/]/.test(f) && !f.includes("..");
}

/** 177: quy tắc M1–M3, M5 cho một tài liệu. */
function formatErrors(d: EvalDocument): string[] {
  const errs: string[] = [];
  if (d.format !== undefined && !FORMATS.includes(d.format)) {
    errs.push(`manifest: format sai ở "${d.id}"`);
  }
  if (d.file !== undefined && !isPlainFileName(d.file)) {
    errs.push(`manifest: file không hợp lệ ở "${d.id}"`);
  }
  if (docFormat(d) === "pdf") {
    if (!d.sha256 || !SHA256_HEX.test(d.sha256)) {
      errs.push(`manifest: thiếu/sai sha256 ở "${d.id}"`);
    }
    if (d.noise) {
      errs.push(`manifest: tài liệu nhiễu không được là PDF "${d.id}"`);
    }
  }
  return errs;
}
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** NFC + gộp mọi khoảng trắng thành 1 dấu cách + trim (research R6). */
export function normalizeForMatch(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Đoạn "trúng" khi chứa ít nhất một trích đoạn đáp án (sau chuẩn hoá) — FR-004. */
export function chunkContainsAnyQuote(
  chunkText: string,
  quotes: readonly string[],
): boolean {
  const hay = normalizeForMatch(chunkText);
  return quotes.some((qt) => {
    const needle = normalizeForMatch(qt);
    return needle !== "" && hay.includes(needle);
  });
}

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return [...dup];
}

export function validateManifest(docs: readonly EvalDocument[]): string[] {
  const errs: string[] = [];
  for (const id of duplicates(docs.map((d) => d.id))) {
    errs.push(`manifest: id trùng "${id}"`);
  }
  for (const d of docs) {
    if (!KEBAB.test(d.id)) errs.push(`manifest: id không kebab-case "${d.id}"`);
    if (!LICENSES.includes(d.license)) {
      errs.push(`manifest: thiếu/sai giấy phép ở "${d.id}"`);
    }
    if (!d.title?.trim()) errs.push(`manifest: thiếu title ở "${d.id}"`);
    if (!d.sourceUrl?.trim())
      errs.push(`manifest: thiếu sourceUrl ở "${d.id}"`);
    errs.push(...formatErrors(d));
  }
  const real = docs.filter((d) => !d.noise).length;
  const noise = docs.length - real;
  if (real < MIN_CORPUS_DOCS) {
    errs.push(`manifest: cần ≥ ${MIN_CORPUS_DOCS} tài liệu thật (có ${real})`);
  }
  if (noise < MIN_NOISE_DOCS) {
    errs.push(`manifest: cần ≥ ${MIN_NOISE_DOCS} tài liệu nhiễu (có ${noise})`);
  }
  return errs;
}

function validateOne(
  q: EvalQuestion,
  texts: ReadonlyMap<string, string>,
  docIds: ReadonlySet<string>,
  noiseIds: ReadonlySet<string>,
  formats: ReadonlyMap<string, EvalFormat>,
): string[] {
  const errs: string[] = [];
  const at = `câu ${q.id}`;
  if (
    q.topic !== undefined &&
    (q.topic !== "pdf" || q.type !== "unanswerable")
  ) {
    errs.push(`${at}: topic sai`);
  }
  if (q.topicDocId !== undefined) {
    if (q.type !== "unanswerable") {
      errs.push(`${at}: topicDocId chỉ dùng cho câu unanswerable`);
    } else if (!docIds.has(q.topicDocId)) {
      errs.push(`${at}: topicDocId lạ "${q.topicDocId}"`);
    } else if (noiseIds.has(q.topicDocId)) {
      errs.push(`${at}: topicDocId trỏ tài liệu nhiễu "${q.topicDocId}"`);
    }
  }
  if (!q.text?.trim()) errs.push(`${at}: câu hỏi rỗng`);
  else if (q.text.length > MAX_QUESTION_LEN) {
    errs.push(`${at}: câu hỏi dài hơn ${MAX_QUESTION_LEN} ký tự`);
  }
  if (q.lang !== "vi" && q.lang !== "en") errs.push(`${at}: lang sai`);
  if (q.split !== "dev" && q.split !== "holdout") errs.push(`${at}: split sai`);
  if (q.type === "unanswerable") {
    if (q.quotes.length > 0 || q.docIds.length > 0) {
      errs.push(`${at}: unanswerable không được có trích đoạn/docIds`);
    }
    return errs;
  }
  if (q.type !== "answerable") return [...errs, `${at}: type sai`];
  if (q.quotes.length === 0) errs.push(`${at}: answerable cần ≥ 1 trích đoạn`);
  const fmts = new Set(
    q.docIds.map((id) => formats.get(id)).filter((f) => f !== undefined),
  );
  if (fmts.size > 1) errs.push(`${at}: docIds trộn định dạng`);
  for (const id of q.docIds) {
    if (!docIds.has(id)) errs.push(`${at}: docIds lạ "${id}"`);
    else if (noiseIds.has(id))
      errs.push(`${at}: docIds trỏ tài liệu nhiễu "${id}"`);
  }
  const docTexts = q.docIds
    .map((id) => texts.get(id))
    .filter((t): t is string => t !== undefined);
  for (const qt of q.quotes) {
    if (qt.length > MAX_QUOTE_LEN) {
      errs.push(`${at}: trích đoạn dài hơn ${MAX_QUOTE_LEN} ký tự`);
    } else if (!docTexts.some((t) => chunkContainsAnyQuote(t, [qt]))) {
      errs.push(
        `${at}: trích đoạn không có nguyên văn trong ${q.docIds.join(", ")}: "${qt}"`,
      );
    }
  }
  return errs;
}

export function validateQuestions(
  file: QuestionsFile,
  texts: ReadonlyMap<string, string>,
  docIds: ReadonlySet<string>,
  noiseIds: ReadonlySet<string>,
  /** 177: để kiểm docIds cùng định dạng (Q1) — bắt buộc (bỏ sót sẽ âm thầm tắt Q1) */
  documents: readonly EvalDocument[],
): string[] {
  const formats = new Map(documents.map((d) => [d.id, docFormat(d)]));
  const dup = duplicates(file.questions.map((q) => q.id)).map(
    (id) => `questions: id trùng "${id}"`,
  );
  return [
    ...dup,
    ...file.questions.flatMap((q) =>
      validateOne(q, texts, docIds, noiseIds, formats),
    ),
  ];
}

export function isReviewed(file: QuestionsFile): boolean {
  return Boolean(file.reviewed?.by?.trim() && file.reviewed?.date?.trim());
}

/**
 * 177: ghép văn bản các trang PDF bằng ký tự KHÔNG phải khoảng trắng (normalizeForMatch không gộp được) ⇒ trích dẫn vắt qua ranh
 * giới trang không khớp — đúng như chunk (không vắt trang).
 */
export const PAGE_SEPARATOR = "\u0000";

/** 177: văn bản khi nạp của một tài liệu (md: nội dung; pdf: kiểm sha256 rồi parsePdf cấu hình mặc định của app). */
async function readDocText(
  corpusDir: string,
  d: EvalDocument,
): Promise<{ text?: string; error?: string }> {
  const file = docFile(d);
  if (!isPlainFileName(file)) return { error: `file không hợp lệ ở ${d.id}` };
  const p = join(corpusDir, file);
  if (!existsSync(p)) return { error: `thiếu tệp ${file}` };
  if (docFormat(d) === "md") return { text: readFileSync(p, "utf8") };
  const bytes = new Uint8Array(readFileSync(p));
  if (sha256Hex(bytes) !== d.sha256) return { error: `sha256 lệch ở ${file}` };
  try {
    // pdfjs chuyển quyền (detach) ArrayBuffer đầu vào ⇒ truyền bản sao (văn bản trích không đổi).
    const { pages } = await parsePdf(bytes.slice());
    return { text: pages.map((pg) => pg.text).join(PAGE_SEPARATOR) };
  } catch (e) {
    // PDF hỏng ⇒ gom vào loadErrors như lỗi tệp khác (chỉ tên lớp lỗi, không nội dung tài liệu).
    return {
      error: `không trích được ${file}: ${e instanceof Error ? e.name : typeof e}`,
    };
  }
}

/** Đọc `<dir>/corpus/manifest.json`, tệp tài liệu (`docFile`), `<dir>/questions.json`. 177: bất đồng bộ (PDF qua parsePdf). */
export async function loadDataset(dir: string): Promise<Dataset> {
  const documents = JSON.parse(
    readFileSync(join(dir, "corpus", "manifest.json"), "utf8"),
  ) as EvalDocument[];
  const questions = JSON.parse(
    readFileSync(join(dir, "questions.json"), "utf8"),
  ) as QuestionsFile;
  const texts = new Map<string, string>();
  const loadErrors: string[] = [];
  for (const d of documents) {
    const { text, error } = await readDocText(join(dir, "corpus"), d);
    if (error !== undefined) {
      loadErrors.push(error);
      continue;
    }
    if (text!.trim() === "") loadErrors.push(`tệp ${docFile(d)} rỗng`);
    texts.set(d.id, text!);
  }
  return { documents, texts, questions, loadErrors };
}
