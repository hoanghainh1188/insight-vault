import type { Translator } from "@shared/i18n";
import type {
  MeetingMarkerKind,
  MeetingTranscript,
  StudioExportResult,
} from "@shared/ipc/types";
import { UserFacingError } from "@shared/codes/user-error";
import { buildMeetingMarkdown, markerExcerpt } from "./meeting-markdown";
import type { MeetingRepo } from "./meeting-repo";
import type { MeetingServiceDeps } from "./meeting-service";

// 186 PR C2 (US7, contract meeting-ipc PR C2) — trình xem cuộc họp: transcript theo câu + đánh dấu (có trích đoạn) + khoảng ngừng,
// đổi nhãn / xoá đánh dấu, xuất Markdown dựng ở MAIN (renderer không gửi nội dung — D12). Chỉ nguồn kind="meeting". Không log
// nội dung (tiêu đề, transcript).

export interface MeetingViewerDeps {
  repo: MeetingRepo;
  sources: MeetingServiceDeps["sources"];
  /** Toàn văn đã lập chỉ mục (source:getContent) — null nếu chưa có. */
  getText(sourceId: string): string | null;
  translator(): Translator;
  formatDate(ms: number): string;
  saveMarkdown(
    content: string,
    suggestedName: string,
  ): Promise<StudioExportResult>;
  log(event: string, meta?: Record<string, string | number | boolean>): void;
}

export interface MeetingViewerApi {
  getTranscript(input: unknown): MeetingTranscript;
  updateMarker(input: unknown): { ok: true };
  deleteMarker(input: unknown): { ok: true };
  exportMarkdown(input: unknown): Promise<StudioExportResult>;
}

const KINDS: readonly MeetingMarkerKind[] = [
  "decision",
  "actionItem",
  "question",
];

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const str = (v: unknown): string | null =>
  typeof v === "string" && v !== "" ? v : null;

export function createMeetingViewerApi(d: MeetingViewerDeps): MeetingViewerApi {
  const meetingOf = (input: unknown) => {
    const sourceId = isObj(input) ? str(input["sourceId"]) : null;
    const src = sourceId ? d.sources.getById(sourceId) : null;
    const s = src && src.kind === "meeting" ? d.repo.get(src.id) : null;
    if (!src || !s) throw new UserFacingError("meetingNotFound");
    return { src, s };
  };

  /** Đánh dấu thuộc một nguồn cuộc họp còn tồn tại (không đụng hàng của nguồn khác). */
  const markerOf = (input: unknown) => {
    const markerId = isObj(input) ? str(input["markerId"]) : null;
    const ref = markerId ? d.repo.getMarkerSource(markerId) : null;
    const src = ref ? d.sources.getById(ref) : null;
    if (!markerId || !src || src.kind !== "meeting")
      throw new UserFacingError("meetingNotFound");
    return markerId;
  };

  const transcript = (
    input: unknown,
  ): MeetingTranscript & { title: string } => {
    const { src, s } = meetingOf(input);
    const text = d.getText(src.id) ?? "";
    const spans = d.repo.listSpans(src.id);
    const markers = d.repo.listMarkers(src.id).map((m) => ({
      ...m,
      excerpt: markerExcerpt(text, spans, m),
    }));
    return {
      title: src.title,
      spans,
      markers,
      pauseGaps: s.pauseGaps,
      language: s.language,
      quality: s.transcriptQuality,
      durationSec: s.durationMs / 1000,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
    };
  };

  return {
    getTranscript(input) {
      const t = transcript(input);
      return {
        spans: t.spans,
        markers: t.markers,
        pauseGaps: t.pauseGaps,
        language: t.language,
        quality: t.quality,
        durationSec: t.durationSec,
        startedAt: t.startedAt,
        endedAt: t.endedAt,
      };
    },

    updateMarker(input) {
      const id = markerOf(input);
      const kind = isObj(input) ? input["kind"] : null;
      if (!KINDS.includes(kind as MeetingMarkerKind))
        throw new UserFacingError("meetingInvalidInput");
      d.repo.updateMarker(id, kind as MeetingMarkerKind);
      return { ok: true as const };
    },

    deleteMarker(input) {
      d.repo.deleteMarker(markerOf(input));
      return { ok: true as const };
    },

    async exportMarkdown(input) {
      const t = transcript(input);
      const { src } = meetingOf(input);
      const tr = d.translator();
      const content = buildMeetingMarkdown(
        {
          title: t.title,
          dateLabel: d.formatDate(t.startedAt),
          durationSec: t.durationSec,
          language: t.language,
        },
        d.getText(src.id) ?? "",
        t.spans,
        t.markers,
        t.pauseGaps,
        tr,
      );
      d.log("meeting.exportMarkdown");
      return d.saveMarkdown(content, t.title);
    },
  };
}
