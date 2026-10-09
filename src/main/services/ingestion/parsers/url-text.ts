import TurndownService from "turndown";

// 150: HTML bài viết (đầu ra Readability) → văn bản thuần dễ đọc. Hàm thuần — unit-test được.
// Văn bản này là văn bản CHÍNH TẮC (sau cleanText) mà chunker tính locator lên (Constitution II),
// nên mọi phần "rác" phải bỏ NGAY ở đây, trước khi chunk: liên kết chỉ giữ chữ (bỏ href/title),
// bỏ ảnh, bỏ dấu chú thích [n] / liên kết quay lại ↑ / permalink ¶, bỏ [edit] (sửa mục) của MediaWiki,
// không escape Markdown.
// Giữ cấu trúc đọc được: tiêu đề `##`, đoạn, danh sách.

/** Thẻ không mang nội dung đọc — bỏ hẳn (kể cả chữ bên trong). */
const DROPPED_TAGS = new Set([
  "IMG",
  "PICTURE",
  "SVG",
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
]);

/** Liên kết "sửa mục" của MediaWiki: `index.php?…action=edit…section=N` (liên kết đỏ `redlink=1` là nội dung — giữ). */
const EDIT_SECTION_HREF =
  /[?&]action=edit\b.*[?&]section=|[?&]section=.*[?&]action=edit\b/;

/** Chữ của liên kết sửa mục — kèm href ở trên, tránh bỏ nhầm "edit this section". */
const EDIT_SECTION_LABEL = /^edit(?: source)?$/i;

/** Vỏ "[edit]" / "[edit | edit source]" bọc liên kết sửa mục (Readability đã bỏ class `mw-editsection`). */
const EDIT_SECTION_TEXT = /^\[\s*edit(?:\s*\|\s*edit source)?\s*\]$/i;

/** Neo chú thích: Wikipedia `#cite_note-…`/`#cite_ref-…`, pandoc/markdown-it `#fn1`/`#fnref1`, Word `#_ftn1`/`#_edn1`. */
const FOOTNOTE_HREF = /^#(?:cite[_-]|fn|footnote|endnote|note|ref|_ftn|_edn)/i;

/** Dấu chú thích có ngoặc: `[7]`, `[a]`, `[note 1]`. */
const BRACKET_MARKER = /^\[[^\]]{1,15}\]$/;

/** Dấu chú thích trần / liên kết quay lại: `7`, `b`, `↑`, `^`, `↩` — CHỈ khi href là neo chú thích. */
const BARE_MARKER = /^(?:\d{1,3}|[a-z]|[↑^↩])$/i;

/** Liên kết neo tiêu đề (permalink) cạnh tiêu đề mục. */
const PERMALINK_MARKER = /^[#¶§]$/;

function isEditSectionLink(node: HTMLElement): boolean {
  return (
    node.nodeName === "A" &&
    EDIT_SECTION_HREF.test(node.getAttribute("href") ?? "") &&
    EDIT_SECTION_LABEL.test((node.textContent ?? "").trim())
  );
}

/** Con được phép của vỏ "[edit]": chữ, liên kết, span (vỏ có ≤ 5 con: `[` a `|` a `]`). */
const WRAPPER_CHILD = new Set(["#text", "A", "SPAN"]);
const WRAPPER_MAX_CHILDREN = 5;

/** Phần tử chỉ chứa "[edit]" quanh liên kết sửa mục → bỏ cả ngoặc. */
function isEditSectionWrapper(node: HTMLElement): boolean {
  // Lọc rẻ trước khi đọc textContent — tránh duyệt cả cây con của mọi khối lớn (O(n²) trên trang dài).
  const children = Array.from(node.childNodes);
  if (children.length === 0 || children.length > WRAPPER_MAX_CHILDREN) {
    return false;
  }
  if (!children.every((c) => WRAPPER_CHILD.has(c.nodeName))) return false;
  if (!EDIT_SECTION_TEXT.test((node.textContent ?? "").trim())) return false;
  return Array.from(node.getElementsByTagName("a")).some(isEditSectionLink);
}

/**
 * Liên kết nội trang (`#…`) chỉ là dấu chú thích hoặc permalink → bỏ cả liên kết. Thận trọng để không bỏ nhầm
 * chữ thật (văn bản chính tắc!): dấu trần (`1`, `a`, `↑`) cần href là neo chú thích; dấu có ngoặc `[1]` cần
 * thêm href neo chú thích HOẶC nằm trong `<sup>`.
 */
function isFootnoteLink(node: HTMLElement): boolean {
  if (node.nodeName !== "A") return false;
  const href = node.getAttribute("href") ?? "";
  if (!href.startsWith("#")) return false;
  const text = (node.textContent ?? "").trim();
  if (PERMALINK_MARKER.test(text)) return true;
  const footnoteHref = FOOTNOTE_HREF.test(href);
  if (BARE_MARKER.test(text)) return footnoteHref;
  if (BRACKET_MARKER.test(text)) {
    return footnoteHref || node.parentNode?.nodeName === "SUP";
  }
  return false;
}

function createService(): TurndownService {
  const service = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    // cleanText gộp khoảng trắng ⇒ khối mã thụt 4 dấu cách sẽ mất thụt; dùng rào ``` cho rõ ranh giới.
    codeBlockStyle: "fenced",
  });
  // Văn bản hiển thị thô (không render Markdown) ⇒ escape `\[` `\*` `\_` chỉ là nhiễu.
  service.escape = (text: string): string => text;
  service.addRule("plainLink", {
    filter: "a",
    replacement: (content) => content,
  });
  service.addRule("plainEmphasis", {
    filter: ["em", "i", "strong", "b"],
    replacement: (content) => content,
  });
  // addRule chèn lên ĐẦU danh sách ⇒ rule thêm SAU CÙNG thắng (cả rule CommonMark image/link) —
  // "drop" phải đứng cuối để thắng "plainLink" với dấu chú thích.
  service.addRule("drop", {
    filter: (node) =>
      DROPPED_TAGS.has(node.nodeName.toUpperCase()) ||
      isFootnoteLink(node) ||
      isEditSectionLink(node) ||
      isEditSectionWrapper(node),
    replacement: () => "",
  });
  return service;
}

/** HTML bài viết → văn bản thuần (chưa cleanText — pipeline làm sạch sau, như mọi loại nguồn). */
export function articleHtmlToText(html: string): string {
  return createService().turndown(html);
}
