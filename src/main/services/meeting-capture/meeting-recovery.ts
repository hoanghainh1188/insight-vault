import type { RecoverableSession } from "@shared/ipc/types";
import { UserFacingError } from "@shared/codes/user-error";
import type { MeetingCheckpoint } from "./checkpoint";
import type { MeetingFiles } from "./meeting-io";
import type { MeetingRepo, MeetingSession } from "./meeting-repo";
import type { MeetingServiceDeps } from "./meeting-service";
import { classifyOnStartup } from "./recovery";
import { totalDurationSec } from "./segments";
import { sessionTransition, type SessionEvent } from "./session-state";

// 186 PR C1 — phiên dang dở (research R12, data-model §5, US5). Không đụng phiên ĐANG ghi (service giữ). Lúc khởi động:
// người dùng đã kết thúc / đang hoàn tất ⇒ tự hoàn tất tiếp; bị gián đoạn ngoài ý muốn ⇒ `interrupted` + thẻ phục hồi
// (Hoàn tất transcript / Giữ như nguồn chưa hoàn thiện / Xoá bản ghi). Cũng lo "Hoàn tất transcript" (incomplete) và "Chốt lại"
// (transcript nháp). Không log nội dung.

export interface RecoveryDeps {
  repo: MeetingRepo;
  files: MeetingFiles;
  pipeline: MeetingServiceDeps["pipeline"];
  sources: MeetingServiceDeps["sources"];
  sampleRate: number;
  /** Xoá nguồn như kênh source:remove (DB + vector + thư mục phiên). */
  removeSource(sourceId: string): Promise<void>;
  /** Báo mọi cửa sổ số phiên cần phục hồi (huy hiệu Notebooks, thẻ ở cột Nguồn). */
  pushRecoverable(count: number): void;
  queueFinalize(sourceId: string): void;
  enqueueIo(fn: () => Promise<void>): Promise<void>;
  log(event: string, meta?: Record<string, string | number | boolean>): void;
}

export interface MeetingRecovery {
  recoverOnStartup(): Promise<void>;
  listRecoverable(input: unknown): RecoverableSession[];
  recover(input: unknown): Promise<{ ok: true }>;
  finalizeAgain(input: unknown): Promise<{ ok: true }>;
  /** Đẩy lại số phiên cần phục hồi (sau khi một phiên bị gián đoạn khi đang chạy). */
  notify(): void;
}

const UNFINISHED: MeetingSession["phase"][] = [
  "recording",
  "paused",
  "stopping",
  "finalizing",
  "interrupted",
];
/** Trần phân đoạn chấp nhận từ checkpoint (≈ 830 giờ ở phân đoạn 5 phút). */
const MAX_CHECKPOINT_SEGMENTS = 10_000;
const RECOVER_ACTIONS = ["finalize", "keepIncomplete", "discard"] as const;
type RecoverAction = (typeof RECOVER_ACTIONS)[number];

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const str = (v: unknown): string | null =>
  typeof v === "string" && v !== "" ? v : null;

/**
 * Checkpoint session.json là BẢN SAO DỰ PHÒNG của trạng thái phiên (ghi ngay sau DB mỗi lần lưu): chỉ dùng khi DB thiếu
 * (vd. DB khôi phục từ bản cũ / hàng bị hỏng) và checkpoint khớp phiên, dài hơn; DB vẫn là nguồn sự thật.
 */
function withCheckpoint(
  s: MeetingSession,
  cp: MeetingCheckpoint | null,
): Pick<MeetingSession, "segments" | "pauseGaps"> {
  // Review bảo mật: checkpoint là dữ liệu đĩa không tin cậy — chỉ nhận khi khớp phiên, có trần và chỉ số tăng dần không trùng.
  const sane =
    cp !== null &&
    cp.sessionId === s.sessionId &&
    cp.sourceId === s.sourceId &&
    cp.segments.length <= MAX_CHECKPOINT_SEGMENTS &&
    cp.pauseGaps.length <= MAX_CHECKPOINT_SEGMENTS &&
    cp.segments.every(
      (seg, i) => i === 0 || seg.index > (cp.segments[i - 1]?.index ?? -1),
    );
  if (!cp || !sane) return { segments: s.segments, pauseGaps: s.pauseGaps };
  return {
    segments: cp.segments.length > s.segments.length ? cp.segments : s.segments,
    pauseGaps:
      cp.pauseGaps.length > s.pauseGaps.length ? cp.pauseGaps : s.pauseGaps,
  };
}

export function createMeetingRecovery(d: RecoveryDeps): MeetingRecovery {
  const { repo } = d;

  const interruptedSessions = (): MeetingSession[] =>
    repo.listByPhase(["interrupted"]);

  const notify = (): void => d.pushRecoverable(interruptedSessions().length);

  const requireInterrupted = (input: unknown): MeetingSession => {
    const sid = isObj(input) ? str(input["sessionId"]) : null;
    const s = sid ? repo.getBySessionId(sid) : null;
    if (!s || s.phase !== "interrupted" || !d.sources.getById(s.sourceId))
      throw new UserFacingError("meetingNotFound");
    return s;
  };

  /** Review C1 B1: chỉ rời `interrupted` khi nguồn đã sẵn sàng (nghe được) — lỗi ⇒ giữ thẻ phục hồi để thử lại. */
  const keepIncomplete = async (s: MeetingSession): Promise<void> => {
    await d.enqueueIo(() => d.files.mergeSegments(s.sessionId, s.segments));
    // Nguồn nghe được, 0 chunk (FR-034: không tham gia hỏi đáp/Studio).
    const ok = await d.pipeline.ingestParsed(s.sourceId, {
      pages: [{ page: null, text: "" }],
      pageCount: null,
      timeMap: [],
    });
    if (!ok) throw new UserFacingError("meetingRecoverFailed");
    toPhase(s, { type: "recover", action: "keepIncomplete" });
    repo.update(s.sourceId, { transcriptQuality: null });
  };

  /** Đổi phase qua máy trạng thái (data-model §5) — không ghi tắt bằng repo.update. */
  const toPhase = (s: MeetingSession, e: SessionEvent): void => {
    const r = sessionTransition(
      { phase: s.phase, endedByUser: s.endedByUser },
      e,
    );
    if (!r.ok) throw new UserFacingError("meetingInvalidInput");
    repo.update(s.sourceId, {
      phase: r.state.phase,
      endedByUser: r.state.endedByUser,
    });
  };

  // Review C1 B2: một thao tác phục hồi mỗi phiên tại một thời điểm (hai cửa sổ / bấm lặp không chạy chồng).
  const inFlight = new Set<string>();

  return {
    async recoverOnStartup() {
      for (const s of repo.listByPhase(UNFINISHED)) {
        const merged = withCheckpoint(
          s,
          await d.files.readCheckpoint(s.sessionId).catch(() => null),
        );
        const segments = await d.files.repairSegments(
          s.sessionId,
          merged.segments,
        );
        const action = classifyOnStartup(s.phase, s.endedByUser);
        const phase =
          action === "autoFinalize"
            ? "finalizing"
            : action === "recoveryCard"
              ? "interrupted"
              : s.phase;
        repo.update(s.sourceId, {
          phase,
          ...(phase === "interrupted" ? { endedByUser: false } : {}),
          segments,
          pauseGaps: merged.pauseGaps,
          durationMs: Math.round(
            totalDurationSec(segments, d.sampleRate) * 1000,
          ),
        });
        d.log("meeting.recovered", { from: s.phase, action });
        if (action === "autoFinalize") d.queueFinalize(s.sourceId);
      }
      notify();
    },

    listRecoverable(input) {
      const notebookId = isObj(input) ? str(input["notebookId"]) : null;
      const out: RecoverableSession[] = [];
      for (const s of interruptedSessions()) {
        const src = d.sources.getById(s.sourceId);
        if (!src || (notebookId && src.notebookId !== notebookId)) continue;
        out.push({
          sessionId: s.sessionId,
          sourceId: s.sourceId,
          notebookId: src.notebookId,
          title: src.title,
          durationSec: s.durationMs / 1000,
          startedAt: s.startedAt,
        });
      }
      return out;
    },

    async recover(input) {
      const s = requireInterrupted(input);
      const action = isObj(input) ? input["action"] : null;
      if (!RECOVER_ACTIONS.includes(action as RecoverAction))
        throw new UserFacingError("meetingInvalidInput");
      // Cờ đồng bộ đặt TRƯỚC await đầu tiên ⇒ lệnh thứ hai cho cùng phiên bị từ chối.
      if (inFlight.has(s.sessionId))
        throw new UserFacingError("meetingNotFound");
      inFlight.add(s.sessionId);
      try {
        d.log("meeting.recover", { action: action as string });
        if (action === "discard") {
          await d.removeSource(s.sourceId);
        } else if (action === "finalize") {
          toPhase(s, { type: "recover", action: "finalize" });
          d.queueFinalize(s.sourceId);
        } else {
          await keepIncomplete(s);
        }
      } finally {
        inFlight.delete(s.sessionId);
        notify();
      }
      return { ok: true as const };
    },

    async finalizeAgain(input) {
      const sourceId = isObj(input) ? str(input["sourceId"]) : null;
      const s = sourceId ? repo.get(sourceId) : null;
      const src = sourceId ? d.sources.getById(sourceId) : null;
      if (!s || !src || src.kind !== "meeting")
        throw new UserFacingError("meetingNotFound");
      // Chỉ nguồn chưa có transcript chốt: chưa hoàn thiện, hoặc đang dùng transcript nháp.
      const eligible =
        s.phase === "incomplete" ||
        (s.phase === "done" && s.transcriptQuality === "draft");
      const next = sessionTransition(
        { phase: s.phase, endedByUser: s.endedByUser },
        { type: "finalizeAgain" },
      );
      if (!eligible || !next.ok)
        throw new UserFacingError("meetingInvalidInput");
      repo.update(sourceId as string, { phase: next.state.phase });
      d.log("meeting.finalizeAgain", { from: s.phase });
      d.queueFinalize(sourceId as string);
      return { ok: true as const };
    },

    notify,
  };
}
