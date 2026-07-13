import type { Bbox } from "@shared/ipc/types";

// Ghép dòng OCR thành 1 transcript + map char↔bbox (053). THUẦN — unit-test kỹ (crux, đối xứng
// audio-transcript.ts 045). Chunker chunk theo char như thường; bboxForCharRange gắn bbox mỗi chunk.

/** 1 dòng OCR: text + vùng bao pixel {x0,y0,x1,y1}. */
export interface OcrLine {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface BoxMapEntry {
  charStart: number;
  charEnd: number;
  bbox: Bbox; // chuẩn hoá 0..1
}

export interface ImageTranscript {
  text: string;
  boxMap: BoxMapEntry[];
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Chuẩn hoá bbox pixel → 0..1 theo kích thước ảnh (imgW/imgH > 0). */
function normalize(b: OcrLine["bbox"], imgW: number, imgH: number): Bbox {
  const w = imgW > 0 ? imgW : 1;
  const h = imgH > 0 ? imgH : 1;
  return {
    x: clamp01(b.x0 / w),
    y: clamp01(b.y0 / h),
    w: clamp01((b.x1 - b.x0) / w),
    h: clamp01((b.y1 - b.y0) / h),
  };
}

/** Nối các dòng (không rỗng) bằng 1 khoảng trắng; ghi char-range + bbox chuẩn hoá mỗi dòng. */
export function buildImageTranscript(
  lines: OcrLine[],
  imgW: number,
  imgH: number,
): ImageTranscript {
  let text = "";
  const boxMap: BoxMapEntry[] = [];
  for (const ln of lines) {
    // Chuẩn hoá whitespace → khớp cleanText (pipeline) để char-offset locator bảo toàn (như 045).
    const t = ln.text.replace(/\s+/g, " ").trim();
    if (t === "") continue;
    if (text.length > 0) text += " ";
    const charStart = text.length;
    text += t;
    boxMap.push({
      charStart,
      charEnd: text.length,
      bbox: normalize(ln.bbox, imgW, imgH),
    });
  }
  return { text, boxMap };
}

/**
 * Vùng bao (0..1) phủ 1 char-range [charStart,charEnd) — HỢP mọi dòng GIAO với range → 1 khối chữ nhật.
 * null nếu không dòng nào giao (VD range rơi vào khoảng trắng ghép).
 */
export function bboxForCharRange(
  boxMap: BoxMapEntry[],
  charStart: number,
  charEnd: number,
): Bbox | null {
  let x0: number | null = null;
  let y0 = 0;
  let x1 = 0;
  let y1 = 0;
  for (const e of boxMap) {
    if (e.charEnd <= charStart || e.charStart >= charEnd) continue; // không giao
    const ex1 = e.bbox.x + e.bbox.w;
    const ey1 = e.bbox.y + e.bbox.h;
    if (x0 === null) {
      x0 = e.bbox.x;
      y0 = e.bbox.y;
      x1 = ex1;
      y1 = ey1;
    } else {
      if (e.bbox.x < x0) x0 = e.bbox.x;
      if (e.bbox.y < y0) y0 = e.bbox.y;
      if (ex1 > x1) x1 = ex1;
      if (ey1 > y1) y1 = ey1;
    }
  }
  if (x0 === null) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
