import type { LanguageMode } from "@shared/ipc/types";
import type { Segment } from "../ingestion/audio/audio-transcript";
import type { AsrLanguage } from "./asr-protocol";
import { FINAL_OVERLAP_SEC } from "./meeting-constants";
import type { MeetingRepo, MeetingSession } from "./meeting-repo";
import { buildMeetingTranscript } from "./meeting-transcript";
import type { MeetingServiceDeps } from "./meeting-service";
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
}

function finalLanguage(mode: LanguageMode): AsrLanguage {
  return mode === "vi" || mode === "en" ? mode : null;
}

/** Nhận dạng chốt các phân đoạn có audio; trả kết quả theo thứ tự, hoặc null nếu ASR lỗi / nguồn bị xoá. */
async function recognizeAll(
  d: FinalizerDeps,
  s: MeetingSession,
  notebookId: string,
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
    const abs = await recognizeOne(d, s, seg, withAudio[k - 1], startSec);
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
      language: finalLanguage(s.languageMode),
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

export async function finalizeSession(
  d: FinalizerDeps,
  sourceId: string,
): Promise<void> {
  const s = d.repo.get(sourceId);
  const src = d.sources.getById(sourceId);
  if (!s || !src || d.isRemoved(sourceId) || s.phase !== "finalizing") return;
  try {
    const rec = await recognizeAll(d, s, src.notebookId);
    if (!rec || d.isRemoved(sourceId)) return;
    await d.enqueueIo(() => d.files.mergeSegments(s.sessionId, s.segments));
    if (d.isRemoved(sourceId)) return;
    const transcript = rec.failed
      ? { text: "", spans: [], timeMap: [] }
      : buildMeetingTranscript(
          stitchTranscriptSegments(rec.results, FINAL_OVERLAP_SEC),
        );
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
      rec.failed
        ? { type: "finalizeFailed" }
        : { type: "finalized", quality: "final" },
    );
    if (next.ok) {
      d.repo.update(sourceId, {
        phase: next.state.phase,
        transcriptQuality: rec.failed ? null : "final",
      });
    }
    if (rec.failed) return; // S3: chưa có transcript ⇒ không báo "sẵn sàng"; giữ phân đoạn cho "Hoàn tất transcript".
    await d.enqueueIo(() => d.files.deleteSegments(s.sessionId, s.segments));
    d.notifyReady(sourceId, src.notebookId, src.title);
  } finally {
    // M2: xoá nguồn trong lúc hoàn tất ⇒ xoá thư mục lần cuối SAU mọi lần ghi của bước này.
    if (d.isRemoved(sourceId))
      await d.enqueueIo(() => d.files.deleteSession(s.sessionId));
  }
}
