import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// 108: bộ đánh giá truy xuất — nạp + validate + khớp trích đoạn đáp án. Hàm thuần (trừ loadDataset đọc tệp),
// unit test ở tests/unit/eval-dataset.test.ts. Cấu trúc: specs/20261007-111628-relevance-calibration/data-model.md

export const MIN_CORPUS_DOCS = 8;
export const MIN_NOISE_DOCS = 2;
export const MAX_QUOTE_LEN = 200;
const MAX_QUESTION_LEN = 2000; // = MAX_QUESTION_LEN của rag (câu hỏi người dùng)

export type EvalLicense = "public-domain-vn-law" | "CC BY-SA 4.0";

export interface EvalDocument {
  id: string;
  title: string;
  sourceUrl: string;
  license: EvalLicense;
  retrievedAt: string;
  noise: boolean;
}

export interface EvalQuestion {
  id: string;
  text: string;
  lang: "vi" | "en";
  type: "answerable" | "unanswerable";
  split: "dev" | "holdout";
  quotes: string[];
  docIds: string[];
}

export interface QuestionsFile {
  datasetVersion: string;
  reviewed: { by: string; date: string } | null;
  questions: EvalQuestion[];
}

export interface Dataset {
  documents: EvalDocument[];
  /** id tài liệu → toàn văn (.md) */
  texts: Map<string, string>;
  questions: QuestionsFile;
  /** lỗi khi đọc tệp (thiếu tệp tài liệu…) */
  loadErrors: string[];
}

const LICENSES: readonly string[] = ["public-domain-vn-law", "CC BY-SA 4.0"];
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
): string[] {
  const errs: string[] = [];
  const at = `câu ${q.id}`;
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
      errs.push(`${at}: trích đoạn không có nguyên văn trong docIds: "${qt}"`);
    }
  }
  return errs;
}

export function validateQuestions(
  file: QuestionsFile,
  texts: ReadonlyMap<string, string>,
  docIds: ReadonlySet<string>,
  noiseIds: ReadonlySet<string>,
): string[] {
  const dup = duplicates(file.questions.map((q) => q.id)).map(
    (id) => `questions: id trùng "${id}"`,
  );
  return [
    ...dup,
    ...file.questions.flatMap((q) => validateOne(q, texts, docIds, noiseIds)),
  ];
}

export function isReviewed(file: QuestionsFile): boolean {
  return Boolean(file.reviewed?.by?.trim() && file.reviewed?.date?.trim());
}

/** Đọc `<dir>/corpus/manifest.json`, `<dir>/corpus/<id>.md`, `<dir>/questions.json`. */
export function loadDataset(dir: string): Dataset {
  const documents = JSON.parse(
    readFileSync(join(dir, "corpus", "manifest.json"), "utf8"),
  ) as EvalDocument[];
  const questions = JSON.parse(
    readFileSync(join(dir, "questions.json"), "utf8"),
  ) as QuestionsFile;
  const texts = new Map<string, string>();
  const loadErrors: string[] = [];
  for (const d of documents) {
    const p = join(dir, "corpus", `${d.id}.md`);
    if (!existsSync(p)) {
      loadErrors.push(`thiếu tệp ${d.id}.md`);
      continue;
    }
    const text = readFileSync(p, "utf8");
    if (text.trim() === "") loadErrors.push(`tệp ${d.id}.md rỗng`);
    texts.set(d.id, text);
  }
  return { documents, texts, questions, loadErrors };
}
