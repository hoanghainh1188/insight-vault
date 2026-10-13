import type { Segment } from "../ingestion/audio/audio-transcript";

// 186 PR B — khử ảo giác Whisper (research R6). THUẦN, không mutate. (1) bỏ segment rỗng / chỉ dấu câu, ký hiệu; (2) ≥ 3 segment
// liên tiếp cùng nội dung ⇒ giữ segment đầu, kéo dài tới tEnd của segment cuối; (3) trong một segment, cụm 1–6 từ lặp ≥ 3 lần
// liên tiếp ⇒ còn một lần. Lặp 2 lần được coi là hợp lệ ("rất rất", "Đúng rồi. Đúng rồi.").

const MIN_REPEAT = 3;
const MAX_PHRASE_WORDS = 6;

const norm = (s: string): string =>
  s
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const isNoise = (text: string): boolean => norm(text) === "";

/** Gộp cụm từ lặp ≥ 3 lần liên tiếp trong câu (so theo từ đã chuẩn hoá, giữ nguyên chữ của lần đầu). */
function collapsePhrases(text: string): string {
  let words = text.trim().split(/\s+/);
  let changed = true;
  while (changed) {
    changed = false;
    const keys = words.map(norm);
    for (let n = 1; n <= MAX_PHRASE_WORDS && !changed; n++) {
      for (let i = 0; i + n * MIN_REPEAT <= words.length; i++) {
        const key = keys.slice(i, i + n).join(" ");
        if (key === "") continue;
        let reps = 1;
        while (keys.slice(i + reps * n, i + (reps + 1) * n).join(" ") === key)
          reps++;
        if (reps >= MIN_REPEAT) {
          const kept = words.slice(i, i + n);
          // Lần lặp cuối mang dấu câu kết thúc của cả cụm (vd. "vâng," ... "vâng" ⇒ giữ "vâng,").
          words = [...words.slice(0, i), ...kept, ...words.slice(i + reps * n)];
          changed = true;
          break;
        }
      }
    }
  }
  return words.join(" ");
}

export function dedupeHallucination(segments: readonly Segment[]): Segment[] {
  const clean = segments.filter((s) => !isNoise(s.text));
  const out: Segment[] = [];
  for (let i = 0; i < clean.length;) {
    const first = clean[i] as Segment;
    const key = norm(first.text);
    let j = i + 1;
    while (j < clean.length && norm((clean[j] as Segment).text) === key) j++;
    const run = j - i;
    if (run >= MIN_REPEAT) {
      out.push({
        ...first,
        text: collapsePhrases(first.text),
        tEnd: (clean[j - 1] as Segment).tEnd,
      });
    } else {
      for (let k = i; k < j; k++) {
        const s = clean[k] as Segment;
        const text = collapsePhrases(s.text);
        out.push(text === s.text ? s : { ...s, text });
      }
    }
    i = j;
  }
  return out;
}
