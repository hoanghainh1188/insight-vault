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
  /** 147 (c): thuộc tính /Rotate của trang (xoay khi HIỂN THỊ, theo chiều kim đồng hồ). */
  rotate?: 0 | 90 | 180 | 270;
  /** 147 (c): gốc MediaBox lệch khỏi (0,0) — toạ độ chữ / đường vẫn tính trong hộp [0..width]×[0..height]. */
  origin?: { x: number; y: number };
  texts: FixtureText[];
  lines?: FixtureLine[];
}

/**
 * 147 (c): dựng trang `/Rotate r` mà khi HIỂN THỊ trông giống hệt `page` (trang thẳng): toạ độ hiển thị (gốc trên-trái, kích thước
 * width×height) được đổi sang hệ chưa xoay của trang, và chữ được vẽ xoay `r` độ để sau khi xoay trang thì đứng thẳng.
 */
export function rotateForDisplay(
  page: FixturePage,
  r: 90 | 180 | 270,
): FixturePage {
  const W = page.width;
  const H = page.height;
  // Hộp trang chưa xoay: 90/270 ⇒ hoán đổi rộng/cao.
  const [wu, hu] = r === 180 ? [W, H] : [H, W];
  // (dx, dy) hiển thị (dy tính từ trên) ⇒ (ux, uy) người dùng (gốc dưới-trái).
  const toUser = (dx: number, dy: number): [number, number] =>
    r === 90 ? [dy, dx] : r === 180 ? [W - dx, dy] : [H - dy, W - dx];
  // FixtureText/Line dùng toạ độ trên-trái của hộp CHƯA xoay: (x = ux, y = hu − uy).
  const toFixture = (dx: number, dy: number): [number, number] => {
    const [ux, uy] = toUser(dx, dy);
    return [ux, hu - uy];
  };
  return {
    width: wu,
    height: hu,
    rotate: r,
    ...(page.origin ? { origin: page.origin } : {}),
    texts: page.texts.map((t) => {
      const [x, y] = toFixture(t.x, t.y);
      return { ...t, x, y, angle: (t.angle ?? 0) + r };
    }),
    lines: page.lines?.map((l) => {
      const [x1, y1] = toFixture(l.x1, l.y1);
      const [x2, y2] = toFixture(l.x2, l.y2);
      return { x1, y1, x2, y2 };
    }),
  };
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
    const [ox, oy] = [page.origin?.x ?? 0, page.origin?.y ?? 0];
    ops.push(
      `${num(ox + l.x1)} ${num(oy + page.height - l.y1)} m ${num(ox + l.x2)} ${num(oy + page.height - l.y2)} l S`,
    );
  }
  for (const t of page.texts) {
    const a = ((t.angle ?? 0) * Math.PI) / 180;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    ops.push(
      `BT /F1 ${num(t.size)} Tf ${num(c)} ${num(s)} ${num(-s)} ${num(c)} ${num((page.origin?.x ?? 0) + t.x)} ${num((page.origin?.y ?? 0) + page.height - t.y)} Tm <${encodeText(t.text, enc)}> Tj ET`,
    );
  }
  return ops.join("\n");
}

const mediaBox = (p: FixturePage): string => {
  const [ox, oy] = [p.origin?.x ?? 0, p.origin?.y ?? 0];
  return `${num(ox)} ${num(oy)} ${num(ox + p.width)} ${num(oy + p.height)}`;
};

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
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [${mediaBox(p)}] ` +
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
