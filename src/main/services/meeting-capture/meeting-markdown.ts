import type { Translator } from "@shared/i18n";
import type { MeetingMarker, PauseGap } from "@shared/ipc/types";
import { formatDuration } from "@shared/meeting/format-duration";
import { spanAtTime } from "@shared/meeting/span-at-time";
import type { TimeMapEntry } from "../ingestion/audio/audio-transcript";

// 186 PR C2 (R18, D12) — dựng Markdown xuất cuộc họp ở MAIN (renderer không gửi nội dung). THUẦN. Mỗi câu (span) một đoạn có
// `[hh:mm:ss]`; khoảng ngừng chèn đúng vị trí trên trục thời gian; tiêu đề escape Markdown; chuỗi theo ngôn ngữ giao diện.

export interface MeetingMarkdownMeta {
  title: string;
  /** Ngày giờ bắt đầu đã định dạng theo ngôn ngữ giao diện (formatDateTime ở nơi gọi). */
  dateLabel: string;
  durationSec: number;
  /** Ngôn ngữ transcript; null ⇒ bỏ dòng. */
  language: "vi" | "en" | null;
}

const EXCERPT_MAX = 160;
const MD_SPECIAL = /[\\`*_{}[\]()#+\-.!|<>~]/g;

export function escapeMarkdownInline(s: string): string {
  // Giữ "." "-" "(" ")" "+" "!" giữa câu (không có nghĩa Markdown ở giữa dòng) — chỉ escape ký tự gây định dạng/liên kết/HTML.
  return s.replace(MD_SPECIAL, (c) => (".-()+!".includes(c) ? c : `\\${c}`));
}

const clean = (s: string): string => s.replace(/\s+/g, " ").trim();

function truncateAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 0 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

/** Trích đoạn cho một đánh dấu: câu chứa thời điểm (đánh dấu điểm) hoặc mọi câu giao với khoảng. */
export function markerExcerpt(
  text: string,
  spans: readonly TimeMapEntry[],
  marker: MeetingMarker,
  max = EXCERPT_MAX,
): string {
  const picked =
    marker.tEnd > marker.tStart
      ? spans.filter((s) => s.tStart < marker.tEnd && s.tEnd > marker.tStart)
      : [spans[spanAtTime(spans, marker.tStart)]].filter(
          (s): s is TimeMapEntry => s !== undefined,
        );
  if (picked.length === 0) return "";
  const from = Math.min(...picked.map((s) => s.charStart));
  const to = Math.max(...picked.map((s) => s.charEnd));
  return truncateAtWord(clean(text.slice(from, to)), max);
}

const stamp = (sec: number): string => `[${formatDuration(sec)}]`;

function gapLine(g: PauseGap, tr: Translator): string {
  return `_— ${tr.t(`meeting.export.gap.${g.reason}`, {
    duration: formatDuration(g.wallSeconds),
  })} —_`;
}

function transcriptBlocks(
  text: string,
  spans: readonly TimeMapEntry[],
  gaps: readonly PauseGap[],
  tr: Translator,
): string[] {
  const pending = [...gaps].sort((a, b) => a.atSec - b.atSec);
  const blocks: string[] = [];
  for (const s of [...spans].sort((a, b) => a.tStart - b.tStart)) {
    while (pending.length > 0 && (pending[0]?.atSec ?? 0) <= s.tStart)
      blocks.push(gapLine(pending.shift() as PauseGap, tr));
    // Review bảo mật C2: lời nói chép ra có thể chứa <html>, [link](javascript:…) ⇒ escape như tiêu đề trước khi vào .md.
    const line = escapeMarkdownInline(
      clean(text.slice(s.charStart, s.charEnd)),
    );
    if (line !== "") blocks.push(`${stamp(s.tStart)} ${line}`);
  }
  for (const g of pending) blocks.push(gapLine(g, tr));
  return blocks;
}

export function buildMeetingMarkdown(
  meta: MeetingMarkdownMeta,
  text: string,
  spans: readonly TimeMapEntry[],
  markers: readonly MeetingMarker[],
  gaps: readonly PauseGap[],
  tr: Translator,
): string {
  const lines: string[] = [
    `# ${escapeMarkdownInline(clean(meta.title))}`,
    "",
    `- ${tr.t("meeting.export.date")}: ${meta.dateLabel}`,
    `- ${tr.t("meeting.export.duration")}: ${formatDuration(meta.durationSec)}`,
  ];
  if (meta.language)
    lines.push(
      `- ${tr.t("meeting.export.language")}: ${tr.t(`meeting.language.${meta.language}`)}`,
    );
  lines.push("");
  if (markers.length > 0) {
    lines.push(`## ${tr.t("meeting.export.markers")}`, "");
    for (const m of [...markers].sort((a, b) => a.tStart - b.tStart)) {
      const excerpt = escapeMarkdownInline(markerExcerpt(text, spans, m));
      lines.push(
        `- ${stamp(m.tStart)} **${tr.t(`meeting.marker.${m.kind}`)}**${excerpt ? ` — ${excerpt}` : ""}`,
      );
    }
    lines.push("");
  }
  lines.push(`## ${tr.t("meeting.export.transcript")}`, "");
  const blocks = transcriptBlocks(text, spans, gaps, tr);
  const body =
    spans.length > 0 ? blocks : [`_${tr.t("meeting.export.noTranscript")}_`];
  for (const b of body) lines.push(b, "");
  return lines.join("\n");
}
