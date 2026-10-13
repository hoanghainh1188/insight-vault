import { Fragment, useEffect, useRef, useState } from "react";
import type { MeetingDraftLine, MeetingState } from "@shared/ipc/types";
import { formatDuration } from "@shared/meeting/format-duration";
import { announce } from "../../shared/a11y/announcer";
import { useT } from "../../shared/i18n/i18n-context";
import {
  INITIAL_FOLLOW,
  nextFollow,
  shouldAutoScroll,
  type FollowState,
} from "./auto-scroll";
import { applyDraftEvent, playbackAt, selectionRange } from "./draft-view";
import { useModelDownload } from "./useModelDownload";

// 186 PR B (US3, FR-020..FR-025) — transcript nháp gần thời gian thực: dòng có timestamp lề trái (bấm ⇒ nghe lại đoạn đó từ
// phân đoạn đang ghi), dòng "Đang nhận dạng" cập nhật tại chỗ (key = id), tự cuộn khi người dùng đang ở đáy + nút "Quay về
// hiện tại", phân cách "Tạm dừng N phút", trạng thái chậm / thiếu model. Không đọc từng câu cho trình đọc màn hình.

export interface DraftTranscriptProps {
  state: MeetingState;
  modelSizeMb: number;
  onSelectRange(range: { tStart: number; tEnd: number } | null): void;
}

/** Id các dòng nằm trong vùng bôi chọn hiện tại của trang (giữa hai đầu mút, theo thứ tự hiển thị). */
function selectedLineIds(list: HTMLElement): string[] {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return [];
  const lineOf = (n: Node | null): HTMLElement | null =>
    (n instanceof HTMLElement ? n : n?.parentElement)?.closest<HTMLElement>(
      "[data-line-id]",
    ) ?? null;
  const a = lineOf(sel.anchorNode);
  const b = lineOf(sel.focusNode);
  if (!a || !b || !list.contains(a) || !list.contains(b)) return [];
  const all = [...list.querySelectorAll<HTMLElement>("[data-line-id]")];
  const [i, j] = [all.indexOf(a), all.indexOf(b)].sort((x, y) => x - y);
  return all
    .slice(i, (j ?? i) + 1)
    .map((el) => el.dataset["lineId"] ?? "")
    .filter((id) => id !== "");
}

export function DraftTranscript({
  state,
  modelSizeMb,
  onSelectRange,
}: DraftTranscriptProps): JSX.Element {
  const t = useT();
  const [lines, setLines] = useState<readonly MeetingDraftLine[]>([]);
  const [follow, setFollow] = useState<FollowState>(INITIAL_FOLLOW);
  const [playing, setPlaying] = useState<string | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const list = useRef<HTMLOListElement | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const model = useModelDownload();
  const sessionId = state.sessionId;

  useEffect(() => {
    setLines([]);
    const off = window.api.onMeetingDraft((ev) => {
      if (ev.sessionId === sessionId)
        setLines((prev) => applyDraftEvent(prev, ev));
    });
    // Gắn lại (đổi notebook / tải lại trang): main đẩy lại đủ dòng nháp khi được hỏi trạng thái.
    void window.api.meetingStatus().catch(() => undefined);
    return off;
  }, [sessionId]);

  // Nội dung mới: bám đáy nếu đang theo dõi, không thì hiện nút "Quay về hiện tại".
  useEffect(() => {
    const el = box.current;
    if (!el || lines.length === 0) return;
    if (follow.following) el.scrollTop = el.scrollHeight;
    else setFollow((f) => nextFollow(f, { type: "content" }));
  }, [lines]);

  const lagging = state.transcriptLagging;
  const announcedLag = useRef(false);
  useEffect(() => {
    if (lagging && !announcedLag.current) announce(t.t("meeting.a11y.lagging"));
    announcedLag.current = lagging;
  }, [lagging, t]);

  const play = (line: MeetingDraftLine): void => {
    const el = audio.current;
    if (!el) return;
    if (playing === line.id) {
      el.pause();
      setPlaying(null);
      return;
    }
    const at = playbackAt(state.segments, line.tStart);
    if (!at) return;
    el.src = `iv-media://source/${encodeURIComponent(state.sourceId)}?seg=${at.seg}`;
    el.onloadedmetadata = () => {
      el.currentTime = at.offsetSec;
      void el.play().catch(() => setPlaying(null));
    };
    setPlaying(line.id);
  };

  const gaps = state.pauseGaps.filter((g) => g.reason !== "interrupted");
  const gapBefore = (i: number): typeof gaps =>
    gaps.filter(
      (g) =>
        g.atSec <= (lines[i]?.tStart ?? 0) &&
        (i === 0 || g.atSec > (lines[i - 1]?.tStart ?? 0)),
    );

  const updateSelection = (): void => {
    const el = list.current;
    onSelectRange(el ? selectionRange(lines, selectedLineIds(el)) : null);
  };

  return (
    <div className="draft-wrap">
      {!state.modelReady && (
        <div
          className="draft-notice"
          role="status"
          data-testid="draft-model-missing"
        >
          <p>{t.t("meeting.draft.modelMissing", { size: modelSizeMb })}</p>
          <button
            type="button"
            className="btn-outline-sm"
            disabled={model.downloading}
            onClick={() => void model.download()}
            data-testid="draft-download-model"
          >
            {model.downloading
              ? t.t("meeting.draft.downloading")
              : t.t("meeting.draft.download", { size: modelSizeMb })}
          </button>
          {model.error && (
            <p className="form-error" role="alert">
              {model.error}
            </p>
          )}
        </div>
      )}
      {lagging && (
        <p className="draft-notice" data-testid="draft-lagging">
          {t.t("meeting.draft.lagging")}
        </p>
      )}
      <div
        ref={box}
        className="draft-scroll"
        onScroll={(e) =>
          setFollow((f) =>
            nextFollow(f, {
              type: "scroll",
              atBottom: shouldAutoScroll(e.currentTarget),
            }),
          )
        }
      >
        {lines.length === 0 ? (
          <p className="rec-placeholder">{t.t("meeting.draft.empty")}</p>
        ) : (
          <ol
            ref={list}
            className="draft-list"
            aria-label={t.t("meeting.draft.title")}
            onMouseUp={updateSelection}
            onKeyUp={updateSelection}
            data-testid="draft-list"
          >
            {lines.map((l, i) => (
              <Fragment key={l.id}>
                {gapBefore(i).map((g) => (
                  <li
                    key={`gap-${g.atSec}`}
                    className="draft-gap"
                    aria-hidden="true"
                  >
                    {t.t("meeting.draft.pausedGap", {
                      duration: formatDuration(g.wallSeconds),
                    })}
                  </li>
                ))}
                <li
                  className={l.pending ? "draft-line pending" : "draft-line"}
                  data-line-id={l.id}
                  data-testid="draft-line"
                >
                  <button
                    type="button"
                    className={
                      playing === l.id ? "draft-time playing" : "draft-time"
                    }
                    aria-label={
                      playing === l.id
                        ? t.t("meeting.draft.stopPlayback")
                        : t.t("meeting.draft.playAt", {
                            time: formatDuration(l.tStart),
                          })
                    }
                    onClick={() => play(l)}
                  >
                    {formatDuration(l.tStart)}
                  </button>
                  <span className="draft-text">{l.text}</span>
                  {l.pending && (
                    <span className="draft-pending">
                      {t.t("meeting.draft.pending")}
                    </span>
                  )}
                </li>
              </Fragment>
            ))}
          </ol>
        )}
      </div>
      {follow.showJump && (
        <button
          type="button"
          className="draft-jump btn-sm"
          onClick={() => {
            setFollow((f) => nextFollow(f, { type: "jump" }));
            const el = box.current;
            if (el) el.scrollTop = el.scrollHeight;
          }}
          data-testid="draft-jump"
        >
          {t.t("meeting.draft.jumpToNow")}
        </button>
      )}
      <p className="draft-foot">{t.t("meeting.draft.note")}</p>
      <audio ref={audio} onEnded={() => setPlaying(null)} hidden />
    </div>
  );
}
