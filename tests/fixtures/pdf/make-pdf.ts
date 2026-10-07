// 112: trình sinh PDF tối giản cho kiểm thử (research R13, FR-022) — thuần TS, không dependency, tất định.
// Một font duy nhất: Helvetica (không nhúng) + /Encoding /Differences cho ký tự ngoài ASCII (mã 128..255) +
// /ToUnicode CMap ⇒ pdf.js trích đúng chuỗi Unicode (kể cả tiếng Việt, kể cả dạng tổ hợp NFD). /Widths cố định
// (CHAR_WIDTH/1000 em mỗi ký tự) để bề rộng item tất định. Không vướng bản quyền font (không nhúng font nào).

export const CHAR_WIDTH = 500; // đơn vị 1/1000 em

export interface FixtureText {
  /** toạ độ tính từ GÓC TRÊN-TRÁI trang (điểm PDF); y là baseline */
  x: number;
  y: number;
  size: number;
  text: string;
  /** góc xoay chữ (độ, ngược chiều kim đồng hồ) */
  angle?: number;
}

export interface FixtureLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface FixturePage {
  width: number;
  height: number;
  rotate?: 0 | 90;
  texts: FixtureText[];
  lines?: FixtureLine[];
}

const hex2 = (n: number): string =>
  n.toString(16).toUpperCase().padStart(2, "0");
const hex4 = (n: number): string =>
  n.toString(16).toUpperCase().padStart(4, "0");
const num = (n: number): string => Number(n.toFixed(3)).toString();

/** Bảng mã: ASCII in được giữ nguyên mã; mỗi "ký tự" khác (grapheme đầu vào, có thể nhiều code point) ⇒ mã 128+. */
function buildEncoding(pages: FixturePage[]): Map<string, number> {
  const map = new Map<string, number>();
  let next = 128;
  for (const p of pages) {
    for (const t of p.texts) {
      for (const ch of graphemes(t.text)) {
        const cp = ch.codePointAt(0)!;
        if (ch.length === 1 && cp >= 32 && cp <= 126) continue;
        if (!map.has(ch)) {
          if (next > 255)
            throw new Error("make-pdf: quá 128 ký tự ngoài ASCII");
          map.set(ch, next++);
        }
      }
    }
  }
  return map;
}

/** Tách chuỗi thành "ký tự hiển thị": code point gốc + các dấu kết hợp đi theo (giữ dạng NFD nếu đầu vào là NFD). */
function graphemes(s: string): string[] {
  const out: string[] = [];
  for (const ch of Array.from(s)) {
    if (/\p{M}/u.test(ch) && out.length > 0) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

function encodeText(s: string, enc: Map<string, number>): string {
  return graphemes(s)
    .map((g) => {
      const code = enc.get(g);
      if (code !== undefined) return hex2(code);
      return hex2(g.codePointAt(0)!);
    })
    .join("");
}

function toUnicodeCMap(enc: Map<string, number>): string {
  const entries: string[] = [];
  for (let c = 32; c <= 126; c++) entries.push(`<${hex2(c)}> <${hex4(c)}>`);
  for (const [ch, code] of enc) {
    const utf16 = Array.from({ length: ch.length }, (_, i) =>
      hex4(ch.charCodeAt(i)),
    ).join("");
    entries.push(`<${hex2(code)}> <${utf16}>`);
  }
  const chunks: string[] = [];
  for (let i = 0; i < entries.length; i += 100) {
    const part = entries.slice(i, i + 100);
    chunks.push(`${part.length} beginbfchar\n${part.join("\n")}\nendbfchar`);
  }
  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<00> <FF>",
    "endcodespacerange",
    ...chunks,
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join("\n");
}

function contentStream(page: FixturePage, enc: Map<string, number>): string {
  const ops: string[] = [];
  for (const l of page.lines ?? []) {
    ops.push(
      `${num(l.x1)} ${num(page.height - l.y1)} m ${num(l.x2)} ${num(page.height - l.y2)} l S`,
    );
  }
  for (const t of page.texts) {
    const a = ((t.angle ?? 0) * Math.PI) / 180;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    ops.push(
      `BT /F1 ${num(t.size)} Tf ${num(c)} ${num(s)} ${num(-s)} ${num(c)} ${num(t.x)} ${num(page.height - t.y)} Tm <${encodeText(t.text, enc)}> Tj ET`,
    );
  }
  return ops.join("\n");
}

/** Sinh tệp PDF (byte) từ mô tả trang. */
export function makePdf(pages: FixturePage[]): Uint8Array {
  const enc = buildEncoding(pages);
  const objs: string[] = []; // objs[i] = nội dung object số i+1
  const add = (body: string): number => {
    objs.push(body);
    return objs.length;
  };
  const stream = (dict: string, data: string): string =>
    `<< ${dict} /Length ${Buffer.byteLength(data, "latin1")} >>\nstream\n${data}\nendstream`;

  const catalogId = add(""); // điền sau
  const pagesId = add("");
  const differences = [...enc.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(
      ([ch, code]) =>
        `${code} /uni${hex4(ch.normalize("NFC").codePointAt(0)!)}`,
    )
    .join(" ");
  const toUni = add(stream("", toUnicodeCMap(enc)));
  const widths = Array.from({ length: 224 }, () => CHAR_WIDTH).join(" ");
  const fontId = add(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /FirstChar 32 /LastChar 255 /Widths [${widths}] ` +
      `/Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [${differences}] >> /ToUnicode ${toUni} 0 R >>`,
  );
  const pageIds: number[] = [];
  for (const p of pages) {
    const contentId = add(stream("", contentStream(p, enc)));
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(p.width)} ${num(p.height)}] ` +
          `${p.rotate ? `/Rotate ${p.rotate} ` : ""}/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );
  }
  objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets)
    out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}
