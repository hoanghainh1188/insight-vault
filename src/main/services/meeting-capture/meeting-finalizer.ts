import type { Segment } from "../ingestion/audio/audio-transcript";
import type { AsrLanguage } from "./asr-protocol";
import { FINAL_OVERLAP_SEC } from "./meeting-constants";
import type { MeetingRepo, MeetingSession } from "./meeting-repo";
import { buildMeetingTranscript } from "./meeting-transcript";
import type { MeetingServiceDeps } from "./meeting-service";
import {
  resolveFinalLanguage,
  type DetectedLanguageCode,
} from "./language-detect";
import { languageForSegment } from "./language-policy";
import { AsrError, type AsrFinalClient, type MeetingFiles } from "./meeting-io";
import { segmentOffsets, type CaptureSegment } from "./segments";
import { sessionTransition } from "./session-state";
import {
  shiftTranscriptSegments,
  stitchTranscriptSegments,
  type CaptureSegmentResult,
} from "./stitch";

// 186 — bước HOÀN TẤT một phiên ghi (research R8, D5; review PR A B2/M2/S3/S8). Nhận dạng lại từng phân đoạn bằng model
// chốt (chồng lấn 5 s), checkpoint `final/seg-N.json` ⇒ chạy lại không làm lại phần đã xong. Phase chỉ rời `finalizing` khi
// lập chỉ mục THÀNH CÔNG — thoát/lỗi giữa chừng thì lần khởi động sau chạy lại (idempotent). Nguồn bị xoá giữa chừng ⇒
// dừng và xoá thư mục phiên LẦN CUỐI qua chuỗi I/O (không để tệp mồ côi). Không log nội dung.

export interface FinalizerDeps {
  repo: MeetingRepo;
  files: MeetingFiles;
  asr: AsrFinalClient;
  pipeline: MeetingServiceDeps["pipeline"];
  sources: MeetingServiceDeps["sources"];
  emitProgress: MeetingServiceDeps["emitProgress"];
  notifyReady: MeetingServiceDeps["notifyReady"];
  sampleRate: number;
  isRemoved(sourceId: string): boolean;
  /** Chuỗi I/O dùng chung với service (deleteSession đi cùng chuỗi ⇒ không chạy xen với ghi tệp). */
  enqueueIo(fn: () => Promise<void>): Promise<void>;
  log(event: string, meta?: Record<string, string | number | boolean>): void;
  now(): number;
}

/** Ngôn ngữ truyền cho bản chốt của một phân đoạn [startSec, endSec). */
type LanguagePlan = (startSec: number, endSec: number) => AsrLanguage | "perWindow";

/**
 * Ngôn ngữ cho bản chốt (ADR spike S2): chế độ khoá thắng; auto/multi dùng ngôn ngữ đã lưu của phiên, chưa có thì phát hiện
 * MỘT lần trên phân đoạn đầu có audio rồi lưu (chạy lại hoàn tất không phát hiện lại). Phát hiện lỗi ⇒ null (vẫn hoàn tất).
 */
async function sessionLanguage(
  d: FinalizerDeps,
  s: MeetingSession,
): Promise<AsrLanguage> {
  // (PR B: chỉ dùng khi phiên KHÔNG có lịch sử đổi ngôn ngữ — xem languagePlan.)
  const known = resolveFinalLanguage(s.languageMode, s.language);
  if (known) return known;
  const first = s.segments.find((seg) => seg.samples > 0);
  if (!first) return null;
  let detected: DetectedLanguageCode;
  try {
    detected = (
      await d.asr.detectLanguage({
        segmentPath: d.files.segmentPath(s.sessionId, first.index),
      })
    ).language;
  } catch (e) {
    d.log("meeting.languageDetectFailed", {
      code: e instanceof AsrError ? e.code : "asrFailed",
    });
    return null;
  }
  if (!d.isRemoved(s.sourceId))
    d.repo.update(s.sourceId, { language: detected });
  d.log("meeting.languageDetected", { language: detected });
  return detected;
}

/**
 * PR B (R7, ADR spike mục 6): có lịch sử đổi ngôn ngữ khi ghi ⇒ mỗi phân đoạn dùng ngôn ngữ chiếm phần lớn; Đa ngôn ngữ ⇒ worker
 * phát hiện theo từng cửa sổ 30 s; còn lại như PR A (khoá ⇒ ngôn ngữ đó; auto chưa phát hiện ⇒ phát hiện một lần).
 */
async function languagePlan(
  d: FinalizerDeps,
  s: MeetingSession,
): Promise<LanguagePlan> {
  if (s.languageChanges.length > 0)
    return (start, end) => languageForSegment(s.languageChanges, start, end);
  if (s.languageMode === "multi") return () => "perWindow";
  const lang = await sessionLanguage(d, s);
  return () => lang;
}

/** Nhận dạng chốt các phân đoạn có audio; trả kết quả theo thứ tự, hoặc null nếu ASR lỗi / nguồn bị xoá. */
async function recognizeAll(
  d: FinalizerDeps,
  s: MeetingSession,
  notebookId: string,
  plan: LanguagePlan,
): Promise<{ results: CaptureSegmentResult[]; failed: boolean } | null> {
  const offsets = segmentOffsets(s.segments, d.sampleRate);
  const offsetOf = new Map(
    s.segments.map((seg, i) => [seg.index, offsets[i] ?? 0]),
  );
  const withAudio = s.segments.filter((seg) => seg.samples > 0);
  const results: CaptureSegmentResult[] = [];
  for (let k = 0; k < withAudio.length; k++) {
    if (d.isRemoved(s.sourceId)) return null;
    const seg = withAudio[k] as CaptureSegment;
    const startSec = offsetOf.get(seg.index) ?? 0;
    const abs = await recognizeOne(
      d,
      s,
      seg,
      withAudio[k - 1],
      startSec,
      plan(startSec, startSec + seg.samples / d.sampleRate),
    );
    if (abs === "removed") return null;
    if (abs === "failed") return { results, failed: true };
    results.push({ startSec, segments: abs });
    d.repo.update(s.sourceId, { finalProgress: k + 1 });
    d.emitProgress(s.sourceId, notebookId, (0.8 * (k + 1)) / withAudio.length);
  }
  return { results, failed: false };
}

async function recognizeOne(
  d: FinalizerDeps,
  s: MeetingSession,
  seg: CaptureSegment,
  prev: CaptureSegment | undefined,
  startSec: number,
  language: AsrLanguage | "perWindow",
): Promise<Segment[] | "failed" | "removed"> {
  const cached = await d.files.readFinal(s.sessionId, seg.index);
  if (cached) return cached;
  try {
    const rel = await d.asr.final({
      segmentPath: d.files.segmentPath(s.sessionId, seg.index),
      ...(prev
        ? { prevSegmentPath: d.files.segmentPath(s.sessionId, prev.index) }
        : {}),
      overlapSec: prev ? FINAL_OVERLAP_SEC : 0,
      language,
    });
    if (d.isRemoved(s.sourceId)) return "removed";
    const abs = shiftTranscriptSegments(rel, startSec);
    await d.enqueueIo(() => d.files.writeFinal(s.sessionId, seg.index, abs));
    return abs;
  } catch (e) {
    if (d.isRemoved(s.sourceId)) return "removed";
    d.log("meeting.asrFailed", {
      code: e instanceof AsrError ? e.code : "asrFailed",
    });
    return "failed";
  }
}

/** Dòng chẩn đoán RTF bản chốt (ADR meeting-asr-spike mục 7) — không nội dung. */
function logFinalPerf(d: FinalizerDeps, s: MeetingSession, elapsedMs: number): void {
  const audioSec = s.segments.reduce((t, seg) => t + seg.samples, 0) / d.sampleRate;
  if (audioSec <= 0) return;
  d.log("meeting.finalPerf", {
    rtf: Math.round((elapsedMs / 1000 / audioSec) * 1000) / 1000,
    audioMin: Math.round(audioSec / 6) / 10,
  });
}

export async function finalizeSession(
  d: FinalizerDeps,
  sourceId: string,
): Promise<void> {
  const s = d.repo.get(sourceId);
  const src = d.sources.getById(sourceId);
  if (!s || !src || d.isRemoved(sourceId) || s.phase !== "finalizing") return;
  try {
    const plan = await languagePlan(d, s);
    if (d.isRemoved(sourceId)) return;
    const started = d.now();
    const rec = await recognizeAll(d, s, src.notebookId, plan);
    if (!rec || d.isRemoved(sourceId)) return;
    if (!rec.failed) logFinalPerf(d, s, d.now() - started);
    await d.enqueueIo(() => d.files.mergeSegments(s.sessionId, s.segments));
    if (d.isRemoved(sourceId)) return;
    // PR B: bản chốt lỗi / thiếu model chốt mà có nháp ⇒ dùng nháp (quality "draft", "Chốt lại" ở PR C1).
    const drafts = rec.failed ? await d.files.readDrafts(s.sessionId) : [];
    const quality: "final" | "draft" | null = !rec.failed
      ? "final"
      : drafts.length > 0
        ? "draft"
        : null;
    const transcript =
      quality === "final"
        ? buildMeetingTranscript(
            stitchTranscriptSegments(rec.results, FINAL_OVERLAP_SEC),
          )
        : quality === "draft"
          ? buildMeetingTranscript(drafts)
          : { text: "", spans: [], timeMap: [] };
    d.repo.replaceSpans(sourceId, transcript.spans);
    const ok = await d.pipeline.ingestParsed(sourceId, {
      pages: [{ page: null, text: transcript.text }],
      pageCount: null,
      timeMap: transcript.timeMap,
    });
    // B2: chưa lập chỉ mục được ⇒ giữ `finalizing` (khởi động lại sẽ chạy lại — checkpoint làm việc này rẻ).
    if (!ok || d.isRemoved(sourceId)) return;
    const next = sessionTransition(
      { phase: s.phase, endedByUser: s.endedByUser },
      quality ? { type: "finalized", quality } : { type: "finalizeFailed" },
    );
    if (next.ok) {
      d.repo.update(sourceId, {
        phase: next.state.phase,
        transcriptQuality: quality,
      });
    }
    if (!quality) return; // S3: chưa có transcript ⇒ không báo "sẵn sàng"; giữ phân đoạn cho "Hoàn tất transcript".
    // Bản nháp: giữ phân đoạn WAV để "Chốt lại" (PR C1) — chỉ bản chốt mới dọn.
    if (quality === "final")
      await d.enqueueIo(() => d.files.deleteSegments(s.sessionId, s.segments));
    d.notifyReady(sourceId, src.notebookId, src.title);
  } finally {
    // M2: xoá nguồn trong lúc hoàn tất ⇒ xoá thư mục lần cuối SAU mọi lần ghi của bước này.
    if (d.isRemoved(sourceId))
      await d.enqueueIo(() => d.files.deleteSession(s.sessionId));
  }
}
