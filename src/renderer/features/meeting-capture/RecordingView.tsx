import { useState } from "react";
import { MEETING_MODEL_SIZE_MB } from "@shared/meeting/constants";
import { formatDuration } from "@shared/meeting/format-duration";
import { useT } from "../../shared/i18n/i18n-context";
import { needsEndConfirm } from "./meeting-ui";
import { useRecording } from "./RecordingProvider";
import { DraftTranscript } from "./DraftTranscript";
import { LanguageControl } from "./LanguageControl";
import { LevelMeter } from "./LevelMeter";
import { MarkerMenu } from "./MarkerMenu";

// 186 — chế độ tập trung khi đang ghi (FR-008..FR-010): thanh đầu "● Đang ghi · hh:mm:ss · Lưu trên máy" (trạng thái bằng
// chữ, đồng hồ nổi bật nhất), vùng nội dung = transcript nháp (PR B), thanh dưới: mức âm, ngôn ngữ, Đánh dấu, Tạm
// dừng↔Tiếp tục; Kết thúc ghi tách biệt + xác nhận khi phiên ≥ 5 phút. Đồng hồ KHÔNG nằm trong live region (FR-049).

export function RecordingView(): JSX.Element | null {
  const t = useT();
  const rec = useRecording();
  const [confirming, setConfirming] = useState(false);
  const [range, setRange] = useState<{ tStart: number; tEnd: number } | null>(
    null,
  );
  const s = rec.state;
  if (!s) return null;
  const paused = s.phase === "paused";
  const duration = formatDuration(s.durationSec);

  const end = (): void => {
    if (needsEndConfirm(s.durationSec)) setConfirming(true);
    else void rec.stop();
  };

  return (
    <section
      className="rec-view"
      aria-labelledby="rec-title"
      data-testid="recording-view"
    >
      <header className="rec-head">
        <h2 id="rec-title" className="rec-title">
          {s.title}
        </h2>
        <p className="rec-status" data-testid="recording-status">
          <span
            className={paused ? "rec-dot paused" : "rec-dot"}
            aria-hidden="true"
          />
          <span className="rec-state">
            {paused
              ? t.t("meeting.recording.paused")
              : t.t("meeting.recording.recording")}
          </span>
          <span aria-hidden="true"> · </span>
          <span
            className="rec-clock"
            aria-label={`${t.t("meeting.recording.durationLabel")}: ${duration}`}
            data-testid="recording-clock"
          >
            {duration}
          </span>
          <span aria-hidden="true"> · </span>
          <span className="rec-local">
            {t.t("meeting.recording.savedLocally")}
          </span>
        </p>
      </header>

      <div className="rec-body rec-body-draft">
        <DraftTranscript
          state={s}
          modelSizeMb={MEETING_MODEL_SIZE_MB}
          onSelectRange={setRange}
        />
      </div>

      <div className="rec-tools" data-testid="recording-tools">
        <LevelMeter active={!paused} />
        <LanguageControl state={s} />
        <MarkerMenu
          sessionId={s.sessionId}
          sourceId={s.sourceId}
          durationSec={s.durationSec}
          range={range}
          onMarked={() => {
            setRange(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      </div>

      <footer
        className="rec-controls"
        role="group"
        aria-label={t.t("meeting.recording.controls")}
      >
        <button
          type="button"
          className="btn-primary-sm rec-main"
          disabled={rec.busy}
          onClick={() => void (paused ? rec.resume() : rec.pause())}
          data-testid={paused ? "recording-resume" : "recording-pause"}
        >
          {paused
            ? t.t("meeting.recording.resume")
            : t.t("meeting.recording.pause")}
        </button>
        <span className="rec-spacer" />
        <button
          type="button"
          className="btn-danger-sm"
          disabled={rec.busy}
          onClick={end}
          data-testid="recording-end"
        >
          {t.t("meeting.recording.end")}
        </button>
      </footer>

      {confirming && (
        <div
          className="nb-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rec-end-title"
          data-testid="recording-end-confirm"
        >
          <div className="nb-modal">
            <h3 id="rec-end-title">
              {t.t("meeting.recording.endConfirmTitle")}
            </h3>
            <p>{t.t("meeting.recording.endConfirmBody", { duration })}</p>
            <div className="nb-modal-actions">
              <button
                type="button"
                className="btn-sm"
                onClick={() => setConfirming(false)}
              >
                {t.t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn-danger-sm"
                onClick={() => {
                  setConfirming(false);
                  void rec.stop();
                }}
                data-testid="recording-end-confirm-btn"
              >
                {t.t("meeting.recording.endConfirmOk")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
