import { logEvent } from "../../../logging";

// 147 (a, research R6, clarify #16–#20): quyết định gạch nối ở CUỐI DÒNG. Chỉ GIỮ gạch khi chắc — gạch treo, tiếng Việt, chữ hoa / số,
// bằng chứng trong chính tài liệu (dạng có gạch / dạng liền); còn lại giữ hành vi 112 (chữ thường ⇒ nối liền bỏ gạch). Không từ điển,
// không danh sách từ cố định. Hàm thuần (trừ log mã lỗi khi luật mới ném — quay về hành vi cũ, FR-012).

export type HyphenDecision = "join" | "keep" | "suspend" | "default";

export interface WordSet {
  has(word: string): boolean;
}

/** Bằng chứng theo tài liệu: từ ghép có gạch đã gặp + từ liền đã gặp (chữ thường, NFC, gạch quy về `-`). */
export interface Lexicon {
  hyphenated: WordSet;
  plain: WordSet;
}

const HYPHENS = "\\-\\u2010\\u2011";
const WORD = "[\\p{L}\\p{M}\\p{N}]+";
const COMPOUND = `${WORD}(?:[${HYPHENS}]${WORD})*`;
/** cụm từ (có thể đã có gạch) ngay trước gạch cuối dòng */
const BREAK = new RegExp(`(${COMPOUND})([${HYPHENS}])$`, "u");
const LEAD = new RegExp(`^${COMPOUND}`, "u");
const HYPHENATED = new RegExp(`${WORD}(?:[${HYPHENS}]${WORD})+`, "gu");
const PLAIN = new RegExp(WORD, "gu");
const SOFT_HYPHEN = /\u00AD$/;
/** mảnh từ cuối dòng bị ngắt (bỏ khỏi bằng chứng) */
const PLAIN_TAIL = new RegExp(`${WORD}$`, "u");
const BREAK_TAIL = new RegExp(`${COMPOUND}[${HYPHENS}]$`, "u");
const BREAK_END = new RegExp(`[\\p{L}\\p{M}\\p{N}][${HYPHENS}]$`, "u");
const STARTS_LOWER = /^\p{Ll}/u;
const STARTS_UPPER_OR_DIGIT = /^[\p{Lu}\p{N}]/u;
const HAS_DIGIT = /\p{N}/u;
/**
 * Dấu CHỈ tiếng Việt có (sau NFD): móc ơ / ư, hỏi, nặng, hoặc dấu thanh chồng lên mũ / trăng (ế ầ ẫ ắ…). Mũ / trăng đứng riêng, đ, й
 * dùng chung với Pháp / Rumani / Bồ / Croatia / Nga nên KHÔNG tính (review 147 a).
 */
const VIETNAMESE_MARK = new RegExp(
  "[\u031B\u0309\u0323]|[\u0302\u0306][\u0300\u0301\u0303]",
  "u",
);
/** liên từ sau gạch treo ("pre- and post-war"); "và", "hoặc" viết escape (NFC) */
const DANGLING = new Set([
  "and",
  "or",
  "und",
  "oder",
  "et",
  "ou",
  "v\u00E0",
  "ho\u1EB7c",
]);
/** chỉ xét đuôi chuỗi — đoạn dài không làm regex chạy lại trên toàn bộ (O(1) mỗi dòng, như 112) */
const TAIL = 120;

const norm = (s: string): string =>
  s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\u2010\u2011]/g, "-");
const isVietnamese = (s: string): boolean =>
  VIETNAMESE_MARK.test(s.normalize("NFD"));

/** Dòng kết thúc bằng gạch nối từ (gạch sát chữ / số, hoặc gạch mềm) — không tính gạch đứng riêng hay en dash. */
export function endsWithHyphenBreak(line: string): boolean {
  const t = line.slice(-2);
  return SOFT_HYPHEN.test(t) || BREAK_END.test(t);
}

export function decideHyphen(
  prevWord: string,
  nextWord: string,
  lexicon?: Lexicon,
): HyphenDecision {
  const p = norm(prevWord);
  const n = norm(nextWord);
  if (p === "" || n === "") return "default";
  if (DANGLING.has(n)) return "suspend";
  // Tiếng Việt: giữ gạch, nối liền — thắng mọi bằng chứng (không bao giờ nối dính chữ, clarify #18).
  if (isVietnamese(prevWord) || isVietnamese(nextWord)) return "keep";
  if (STARTS_UPPER_OR_DIGIT.test(nextWord) || HAS_DIGIT.test(prevWord))
    return "keep";
  if (!lexicon) return "default";
  const hyphenated = lexicon.hyphenated.has(`${p}-${n}`);
  const plain = lexicon.plain.has(`${p}${n}`);
  if (hyphenated && !plain) return "keep";
  if (plain && !hyphenated) return "join";
  return "default";
}

function safeDecide(
  prev: string,
  next: string,
  lexicon?: Lexicon,
): HyphenDecision {
  try {
    return decideHyphen(prev, next, lexicon);
  } catch (e) {
    logEvent("pdf.layout.fallback", {
      feature: "hyphen",
      errorType: e instanceof Error ? e.constructor.name : typeof e,
    });
    return "default";
  }
}

/** Nối dòng `next` vào `acc` khi `acc` kết thúc bằng gạch nối từ; null nếu không (caller nối bằng dấu cách). */
export function joinAcrossLines(
  acc: string,
  next: string,
  lexicon?: Lexicon,
): { text: string; decision: HyphenDecision } | null {
  const tail = acc.slice(-TAIL);
  if (SOFT_HYPHEN.test(tail))
    return { text: acc.slice(0, -1) + next, decision: "join" };
  const m = BREAK.exec(tail);
  if (!m) return null;
  const lead = LEAD.exec(next)?.[0] ?? "";
  const decision = safeDecide(m[1], lead, lexicon);
  const dropped = acc.slice(0, -1) + next;
  const kept = acc + next;
  switch (decision) {
    case "join":
      return { text: dropped, decision };
    case "keep":
      return { text: kept, decision };
    case "suspend":
      return { text: `${acc} ${next}`, decision };
    default:
      return {
        text: STARTS_LOWER.test(next) ? dropped : kept,
        decision,
      };
  }
}

/** Tập bằng chứng có thể cộng dồn (vd cả tài liệu, trang nối trang) — tra cứu O(1). */
export interface MutableLexicon extends Lexicon {
  hyphenated: Set<string>;
  plain: Set<string>;
}

export function createLexicon(): MutableLexicon {
  return { hyphenated: new Set(), plain: new Set() };
}

/** Thêm bằng chứng từ các dòng văn bản vào `lex`; mảnh từ bị ngắt ở cuối dòng không tính. */
export function addLines(lex: MutableLexicon, lines: Iterable<string>): void {
  for (const line of lines) {
    let t = norm(line);
    if (SOFT_HYPHEN.test(t)) t = t.slice(0, -1).replace(PLAIN_TAIL, "");
    else if (BREAK.test(t.slice(-TAIL))) t = t.replace(BREAK_TAIL, "");
    for (const w of t.match(HYPHENATED) ?? []) lex.hyphenated.add(w);
    for (const w of t.match(PLAIN) ?? []) lex.plain.add(w);
  }
}

/** Tập bằng chứng mới từ các dòng văn bản. */
export function buildLexicon(lines: Iterable<string>): Lexicon {
  const lex = createLexicon();
  addLines(lex, lines);
  return lex;
}

/** Hợp vài tập bằng chứng (tài liệu + trang hiện tại) — không sao chép; tra O(số tập). */
export function mergeLexicons(...lexicons: readonly Lexicon[]): Lexicon {
  return {
    hyphenated: { has: (w) => lexicons.some((l) => l.hyphenated.has(w)) },
    plain: { has: (w) => lexicons.some((l) => l.plain.has(w)) },
  };
}
