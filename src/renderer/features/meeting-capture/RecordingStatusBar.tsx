import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatDuration } from "@shared/meeting/format-duration";
import { useT } from "../../shared/i18n/i18n-context";
import { useRecording } from "./RecordingProvider";

// 186 — thanh "● Đang ghi 00:12:03 — Quay lại" (FR-041, FR-048): luôn cho thấy micro đang hoạt động khi người dùng ở màn
// khác; bấm Quay lại về notebook đang ghi. Ẩn khi đang ở chính notebook đó (màn ghi đã hiển thị trạng thái).
// Sau khi hoàn tất xong mà người dùng đã rời màn hoàn tất ⇒ toast "Cuộc họp … đã sẵn sàng — Mở" (D15).

export function RecordingStatusBar(): JSX.Element | null {
  const t = useT();
  const rec = useRecording();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [toast, setToast] = useState<{
    sourceId: string;
    notebookId: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (rec.finalizing || toast) return;
    return window.api.onSourceProgress((e) => {
      if (e.status !== "ready") return;
      void window.api.sourceGet(e.sourceId).then((s) => {
        if (s?.kind === "meeting" && s.meetingPhase === "done") {
          setToast({
            sourceId: s.id,
            notebookId: s.notebookId,
            title: s.title,
          });
        }
      });
    });
  }, [rec.finalizing, toast]);

  const s = rec.state;
  const onItsNotebook = s ? pathname === `/workspace/${s.notebookId}` : false;
  const live =
    s && (s.phase === "recording" || s.phase === "paused") && !onItsNotebook;

  if (!live && !toast) return null;
  return (
    <div className="rec-bar-wrap">
      {live && s && (
        <div className="rec-bar" role="status" data-testid="recording-bar">
          <span
            className={s.phase === "paused" ? "rec-dot paused" : "rec-dot"}
            aria-hidden="true"
          />
          <span>
            {t.t(
              s.phase === "paused"
                ? "meeting.recording.statusBarPaused"
                : "meeting.recording.statusBar",
              {
                duration: formatDuration(s.durationSec),
              },
            )}
          </span>
          <button
            type="button"
            className="btn-outline-sm"
            onClick={() => nav(`/workspace/${s.notebookId}`)}
            data-testid="recording-bar-back"
          >
            {t.t("meeting.recording.backToRecording")}
          </button>
        </div>
      )}
      {toast && (
        <div
          className="rec-bar rec-toast"
          role="status"
          data-testid="meeting-ready-toast"
        >
          <span>
            {t.t("meeting.finalize.readyToast", { title: toast.title })}
          </span>
          <button
            type="button"
            className="btn-outline-sm"
            onClick={() => {
              nav(`/workspace/${toast.notebookId}`);
              setToast(null);
            }}
          >
            {t.t("meeting.finalize.open")}
          </button>
          <button
            type="button"
            className="modal-x"
            onClick={() => setToast(null)}
            aria-label={t.t("common.close")}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
