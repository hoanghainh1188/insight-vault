import { describe, it, expect } from "vitest";
import { articleHtmlToText } from "../../src/main/services/ingestion/parsers/url-text";
import { cleanText } from "../../src/main/services/ingestion/cleaning";
import {
  chunkPages,
  joinPages,
} from "../../src/main/services/ingestion/chunker";

// 150: HTML bài viết (sau Readability) → văn bản thuần dễ đọc — không cú pháp liên kết/ảnh Markdown,
// không dấu chú thích. Văn bản này là văn bản CHÍNH TẮC mà chunker tính locator lên.

describe("articleHtmlToText — liên kết", () => {
  it("giữ chữ của liên kết, bỏ href và title", () => {
    const html =
      '<p>Pho is from <a href="https://en.wikipedia.org/wiki/Northern_Vietnam" title="Northern Vietnam">Northern Vietnam</a>.</p>';
    expect(articleHtmlToText(html)).toBe("Pho is from Northern Vietnam.");
  });

  it("liên kết có ngoặc/ký tự đặc biệt trong URL không để lại rác", () => {
    const html =
      '<p>See <a href="https://en.wikipedia.org/wiki/PHO_(disambiguation)">PHO</a> for other uses.</p>';
    expect(articleHtmlToText(html)).toBe("See PHO for other uses.");
  });

  it("liên kết nội trang (mục lục) vẫn giữ chữ", () => {
    const html = '<p>Jump to <a href="#History">History of pho</a>.</p>';
    expect(articleHtmlToText(html)).toBe("Jump to History of pho.");
  });
});

describe("articleHtmlToText — ảnh", () => {
  it("bỏ ảnh, kể cả ảnh bọc trong liên kết; giữ chú thích ảnh", () => {
    const html =
      '<figure><a href="https://en.wikipedia.org/wiki/File:Bowl.jpg"><img src="https://upload.wikimedia.org/a%20b.jpg" alt="Bowl"></a>' +
      "<figcaption>A bowl of meatball pho</figcaption></figure><p>Text.</p>";
    const out = articleHtmlToText(html);
    expect(out).not.toContain("![");
    expect(out).not.toContain("upload.wikimedia.org");
    expect(out).not.toContain("File:Bowl");
    expect(out).toContain("A bowl of meatball pho");
    expect(out).toContain("Text.");
  });
});

describe("articleHtmlToText — chú thích", () => {
  it("bỏ dấu tham chiếu chú thích [n] trong thân bài", () => {
    const html =
      '<p>Served nationwide<sup id="cite_ref-9" class="reference"><a href="#cite_note-9"><span>[</span>7<span>]</span></a></sup> in Vietnam.</p>';
    expect(articleHtmlToText(html)).toBe("Served nationwide in Vietnam.");
  });

  it("bỏ dấu chú thích có nhãn chữ ([a], [note 1]) và nhiều dấu liền nhau", () => {
    const html =
      '<p>Pho<sup><a href="#cite_note-3">[a]</a></sup><sup><a href="#cite_note-x">[note 1]</a></sup><sup><a href="#cite_note-4">[2]</a></sup> is a soup.</p>';
    expect(articleHtmlToText(html)).toBe("Pho is a soup.");
  });

  it("bỏ liên kết quay lại (↑, ^, 1 2) trong danh sách tài liệu tham khảo, giữ nội dung tham khảo", () => {
    const html =
      '<ol class="references">' +
      '<li><a href="#cite_ref-3">↑</a> Smith (2010). <a href="https://example.com/a">"Title A"</a>.</li>' +
      '<li><a href="#cite_ref-x_1-0">1</a> <a href="#cite_ref-x_1-1">2</a> Doe. "Title B".</li>' +
      '<li><a href="#cite_ref-y">^</a> Roe.</li>' +
      "</ol>";
    const out = articleHtmlToText(html);
    expect(out).not.toContain("↑");
    expect(out).not.toContain("^");
    expect(out).not.toContain("cite_ref");
    expect(out).toContain('Smith (2010). "Title A".');
    expect(out).toMatch(/2\.\s+Doe\. "Title B"\./);
    expect(out).toContain("Roe.");
  });

  it("bỏ liên kết sửa mục [edit] (MediaWiki, sau Readability — không còn class)", () => {
    const html =
      '<h2>History</h2><p><span><span>[</span><a href="https://en.wikipedia.org/w/index.php?title=Pho&amp;action=edit&amp;section=5" title="Edit section: History"><span>edit</span></a><span>]</span></span></p>' +
      '<h2>Usage</h2><p><span>[<a href="https://w.example/index.php?title=X&amp;action=edit&amp;section=6">edit</a> | <a href="https://w.example/index.php?title=X&amp;action=edit&amp;section=6&amp;veaction=editsource">edit source</a>]</span></p><p>Body.</p>';
    const out = articleHtmlToText(html);
    expect(out).not.toMatch(/edit|\[\]/);
    expect(out).toContain("History");
    expect(out).toContain("Body.");
  });

  it("giữ chữ của liên kết đỏ (action=edit&redlink=1 — trang chưa có, vẫn là nội dung)", () => {
    const html =
      '<p>Try <a href="https://en.wikipedia.org/wiki/Ph%E1%BB%9F_t%C3%A1i?action=edit&amp;redlink=1">phở tái</a> today.</p>';
    expect(articleHtmlToText(html)).toBe("Try phở tái today.");
  });
});

describe("articleHtmlToText — không bỏ nhầm nội dung", () => {
  it("giữ liên kết nội trang có chữ ngắn khi href không phải neo chú thích", () => {
    const html =
      '<p>Vitamin <a href="#v">c</a>, version <a href="#v">12</a>, see <a href="#S2">2</a> and <a href="#x">[i]</a>.</p>';
    expect(articleHtmlToText(html)).toBe(
      "Vitamin c, version 12, see 2 and [i].",
    );
  });

  it("dấu [n] trong <sup> bị bỏ dù href lạ; neo chú thích kiểu pandoc/Word cũng bỏ", () => {
    const html =
      '<p>A<sup><a href="#x1">[1]</a></sup> B<sup><a href="#fn2">2</a></sup> C<a href="#_ftn3">[3]</a> D.</p>' +
      '<ol><li>Note. <a href="#fnref2">↩</a></li></ol>';
    expect(cleanText(articleHtmlToText(html))).toBe("A B C D.\n\n1. Note.");
  });

  it("giữ liên kết 'edit this section' không phải liên kết sửa mục [edit]", () => {
    const html =
      '<p><a href="/w/index.php?title=X&amp;action=edit&amp;section=2">edit this section</a> now.</p>';
    expect(articleHtmlToText(html)).toBe("edit this section now.");
  });

  it("bỏ liên kết neo tiêu đề (permalink #, ¶, §)", () => {
    const html =
      '<h2>Title <a href="#t">#</a></h2><h3>Sub<a href="#s" title="Permalink">¶</a></h3><p>Body.</p>';
    expect(cleanText(articleHtmlToText(html))).toBe(
      "## Title\n\n### Sub\n\nBody.",
    );
  });

  it("bỏ <picture>/<svg>; giữ nguyên khối mã <pre>", () => {
    const html =
      '<picture><source srcset="a.webp"><img src="a.jpg"></picture><svg><text>logo</text></svg>' +
      "<pre><code>arr[1] = *b* _c_</code></pre>";
    expect(articleHtmlToText(html)).toBe("```\narr[1] = *b* _c_\n```");
  });
});

describe("articleHtmlToText — định dạng", () => {
  it("không escape Markdown và không để dấu nhấn mạnh", () => {
    const html =
      "<p>The word is given as <i>pho</i> and <b>phở</b> [sic] 1. not a list * star_name.</p>";
    expect(articleHtmlToText(html)).toBe(
      "The word is given as pho and phở [sic] 1. not a list * star_name.",
    );
  });

  it("giữ tiêu đề, đoạn và danh sách", () => {
    const html =
      "<h2>Ingredients</h2><p>Broth and noodles.</p><ul><li>Beef</li><li>Chicken</li></ul>";
    const out = articleHtmlToText(html);
    expect(out).toMatch(/^## Ingredients\n\nBroth and noodles\.\n\n/);
    expect(out).toMatch(/-\s+Beef\n-\s+Chicken$/);
  });

  it("bỏ phần tử không phải nội dung (script/style/noscript)", () => {
    const html =
      "<p>A</p><script>alert(1)</script><style>p{}</style><noscript>x</noscript><p>B</p>";
    expect(articleHtmlToText(html)).toBe("A\n\nB");
  });
});

describe("articleHtmlToText — locator nhất quán", () => {
  it("chunk của văn bản đã trích map đúng về văn bản chính tắc, không còn URL", () => {
    const para = (i: number): string =>
      `<p>Paragraph ${i} mentions <a href="https://en.wikipedia.org/wiki/Topic_${i}" title="Topic ${i}">topic ${i}</a>` +
      `<sup><a href="#cite_note-${i}">[${i}]</a></sup> and more words about pho broth.</p>`;
    const html = Array.from({ length: 80 }, (_, i) => para(i)).join("");
    const pages = [{ page: null, text: cleanText(articleHtmlToText(html)) }];
    const full = joinPages(pages);
    const chunks = chunkPages(pages);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(full.slice(c.locator.charStart, c.locator.charEnd)).toBe(c.text);
      expect(c.text).not.toMatch(/\]\(|https?:|cite_note/);
    }
  });
});
