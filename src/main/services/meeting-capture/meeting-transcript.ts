import type {
  Segment,
  TimeMapEntry,
} from "../ingestion/audio/audio-transcript";

// 186 — transcript cuộc họp (R8, D2, D3). THUẦN. Mỗi segment một dòng (nối "\n"), khoảng trắng nội bộ gộp 1 và trim
// ⇒ cleanText(text) === text nên offset locator/span không lệch. Khoảng ngừng KHÔNG vào văn bản (metadata riêng).

export interface MeetingTranscript {
  text: string;
  /** Map char ↔ thời gian mức segment (lưu bảng transcript_span). */
  spans: TimeMapEntry[];
  /** Cùng dữ liệu với spans — dùng cho timeForCharRange khi gắn tStart/tEnd chunk (045). */
  timeMap: TimeMapEntry[];
}

export function buildMeetingTranscript(
  segments: readonly Segment[],
): MeetingTranscript {
  const ordered = [...segments].sort((a, b) => a.tStart - b.tStart);
  let text = "";
  const spans: TimeMapEntry[] = [];
  for (const seg of ordered) {
    const line = seg.text.replace(/\s+/g, " ").trim();
    if (line === "") continue;
    if (text.length > 0) text += "\n";
    const charStart = text.length;
    text += line;
    spans.push({
      charStart,
      charEnd: text.length,
      tStart: seg.tStart,
      tEnd: seg.tEnd,
    });
  }
  return { text, spans, timeMap: spans.map((s) => ({ ...s })) };
}
