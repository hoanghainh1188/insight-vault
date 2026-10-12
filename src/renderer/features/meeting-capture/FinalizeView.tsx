import { useEffect, useState } from "react";
import { formatDuration } from "@shared/meeting/format-duration";
import { useT } from "../../shared/i18n/i18n-context";
import { useRecording } from "./RecordingProvider";

// 186 — màn hoàn tất sau Kết thúc ghi (FR-011): tiêu đề sửa được (= đổi tên nguồn), tổng thời lượng, "Đang chốt transcript
// và lập chỉ mục" + tiến độ, Về notebook (việc hoàn tất chạy nền), Mở khi hoàn tất (D15: còn ở màn này ⇒ tự mở trình xem).

export function FinalizeView({
  onOpenSource,
}: {
  onOpenSource: (sourceId: string) => void;
}): JSX.Element | null {
  const t = useT();
  const rec = useRecording();
  const f = rec.finalizing;
  const [title, setTitle] = useState(f?.title ?? "");
  const [pct, setPct] = useState(0);
  // S4 / S3: kết cục ngoài "sẵn sàng có transcript" — lỗi lập chỉ mục (sẽ thử lại khi mở app) hoặc chưa có transcript.
  const [outcome, setOutcome] = useState<"ok" | "incomplete" | "failed">("ok");

  // Đồng bộ ô tiêu đề khi chuyển sang phiên khác (không ghi đè khi người dùng đang gõ cùng phiên).
  const sourceId = f?.sourceId;
  const initialTitle = f?.title ?? "";
  useEffect(() => setTitle(initialTitle), [sourceId]);

  useEffect(() => {
    if (!f) return;
    return window.api.onSourceProgress((e) => {
      if (e.sourceId !== f.sourceId) return;
      if (e.status === "error") setOutcome("failed");
      else if (e.status !== "ready") setPct(Math.round(e.progress * 100));
    });
  }, [f]);

  // Sẵn sàng ⇒ phân biệt có transcript hay chỉ có audio (phase incomplete).
  useEffect(() => {
    if (!f?.ready) return;
    void window.api.sourceGet(f.sourceId).then((src) => {
      if (src?.meetingPhase === "incomplete") setOutcome("incomplete");
    });
  }, [f?.ready, f?.sourceId]);

  // Xong + đã chọn "Mở khi hoàn tất" ⇒ mở trình xem và rời màn hoàn tất.
  useEffect(() => {
    if (f?.ready && f.openWhenDone) {
      onOpenSource(f.sourceId);
      rec.dismissFinalizing();
    }
  }, [f, onOpenSource, rec]);

  if (!f) return null;

  const commitTitle = (): void => {
    const v = title.trim();
    if (v && v !== f.title) void rec.rename(v);
    else setTitle(f.title);
  };

  return (
    <section
      className="rec-view rec-finalize"
      aria-labelledby="fin-title"
      data-testid="finalize-view"
    >
      <header className="rec-head">
        <label className="ms-field">
          <span id="fin-title">{t.t("meeting.finalize.titleLabel")}</span>
          <input
            className="nb-input"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
            }}
            data-testid="finalize-title"
          />
        </label>
        <p className="rec-status">
          {t.t("meeting.finalize.duration", {
            duration: formatDuration(f.durationSec),
          })}
        </p>
      </header>

      <div className="rec-body">
        {f.endReason && (
          <p
            className="form-notice"
            role="status"
            data-testid="finalize-end-reason"
          >
            {t.t(`meeting.ended.${f.endReason}`)}
          </p>
        )}
        {outcome === "failed" ? (
          <p className="form-error" role="alert" data-testid="finalize-failed">
            {t.t("meeting.finalize.failed")}
          </p>
        ) : f.ready && outcome === "incomplete" ? (
          <p data-testid="finalize-incomplete">
            {t.t("meeting.finalize.incomplete")}
          </p>
        ) : f.ready ? (
          <p className="rec-ready" data-testid="finalize-ready">
            {t.t("meeting.finalize.ready")}
          </p>
        ) : (
          <>
            <p data-testid="finalize-status">
              {t.t("meeting.finalize.status")}
            </p>
            <div
              className="src-progress rec-progress"
              role="progressbar"
              aria-label={t.t("meeting.finalize.status")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <span
                className="rec-progress-fill"
                style={{ transform: `scaleX(${pct / 100})` }}
              />
            </div>
          </>
        )}
      </div>

      <footer className="rec-controls">
        <button
          type="button"
          className="btn-sm"
          onClick={rec.dismissFinalizing}
          data-testid="finalize-back"
        >
          {t.t("meeting.finalize.backToNotebook")}
        </button>
        <span className="rec-spacer" />
        {f.ready ? (
          <button
            type="button"
            className="btn-primary-sm"
            onClick={() => {
              onOpenSource(f.sourceId);
              rec.dismissFinalizing();
            }}
            data-testid="finalize-open"
          >
            {t.t("meeting.finalize.open")}
          </button>
        ) : (
          <label className="vb-check">
            <input
              type="checkbox"
              checked={f.openWhenDone}
              onChange={(e) => rec.setOpenWhenDone(e.target.checked)}
              data-testid="finalize-open-when-done"
            />
            {t.t("meeting.finalize.openWhenDone")}
          </label>
        )}
      </footer>
    </section>
  );
}
