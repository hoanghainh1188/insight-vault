// Ghép segment bóc băng thành 1 transcript + map char↔time (045). THUẦN — unit-test kỹ (crux). Chunker
// chunk theo char như thường; sau đó dùng timeForCharRange để gắn tStart/tEnd cho mỗi chunk.

export interface Segment {
  text: string;
  tStart: number; // giây
  tEnd: number;
}

export interface TimeMapEntry {
  charStart: number;
  charEnd: number;
  tStart: number;
  tEnd: number;
}

export interface Transcript {
  text: string;
  timeMap: TimeMapEntry[];
}

/** Nối các segment (không rỗng) bằng 1 khoảng trắng; ghi lại khoảng char + time mỗi segment. */
export function buildTranscript(segments: Segment[]): Transcript {
  let text = "";
  const timeMap: TimeMapEntry[] = [];
  for (const seg of segments) {
    // Chuẩn hoá khoảng trắng nội bộ → khớp cleanText (pipeline) để char-offset locator bảo toàn.
    const t = seg.text.replace(/\s+/g, " ").trim();
    if (t === "") continue;
    if (text.length > 0) text += " ";
    const charStart = text.length;
    text += t;
    timeMap.push({
      charStart,
      charEnd: text.length,
      tStart: seg.tStart,
      tEnd: seg.tEnd,
    });
  }
  return { text, timeMap };
}

/**
 * Khoảng thời gian phủ 1 char-range [charStart,charEnd) — gộp mọi segment GIAO với range. null nếu không
 * segment nào giao (VD range rơi vào khoảng trắng ghép).
 */
export function timeForCharRange(
  timeMap: TimeMapEntry[],
  charStart: number,
  charEnd: number,
): { tStart: number; tEnd: number } | null {
  let tStart: number | null = null;
  let tEnd: number | null = null;
  for (const e of timeMap) {
    if (e.charEnd <= charStart || e.charStart >= charEnd) continue; // không giao
    if (tStart === null || e.tStart < tStart) tStart = e.tStart;
    if (tEnd === null || e.tEnd > tEnd) tEnd = e.tEnd;
  }
  return tStart === null ? null : { tStart, tEnd: tEnd as number };
}
