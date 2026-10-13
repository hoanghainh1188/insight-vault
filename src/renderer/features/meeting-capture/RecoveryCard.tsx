import { useCallback, useEffect, useState } from "react";
import type {
  MeetingRecoverAction,
  RecoverableSession,
} from "@shared/ipc/types";
import { formatDuration } from "@shared/meeting/format-duration";
import { announce } from "../../shared/a11y/announcer";
import { useT } from "../../shared/i18n/i18n-context";
import {
  describeIpcError,
  toParsedError,
} from "../../shared/i18n/describe-error";

// 186 PR C1 (T120, US5) — thẻ phục hồi ở đầu cột Nguồn: mỗi phiên bị gián đoạn của notebook một thẻ với 3 lựa chọn. "Xoá bản
// ghi" xoá vĩnh viễn ⇒ hỏi xác nhận. Danh sách làm mới khi main đẩy meeting:recoverable.

export function RecoveryCards({
  notebookId,
  onChanged,
}: {
  notebookId: string;
  onChanged?: () => void;
}): JSX.Element | null {
  const t = useT();
  const [items, setItems] = useState<readonly RecoverableSession[]>([]);
  const [confirm, setConfirm] = useState<RecoverableSession | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void window.api
      .meetingListRecoverable({ notebookId })
      .then(setItems, () => setItems([]));
  }, [notebookId]);

  useEffect(() => {
    load();
    return window.api.onMeetingRecoverable(load);
  }, [load]);

  const act = async (
    s: RecoverableSession,
    action: MeetingRecoverAction,
  ): Promise<void> => {
    setBusy(s.sessionId);
    setError(null);
    try {
      await window.api.meetingRecover({ sessionId: s.sessionId, action });
      announce(t.t("meeting.recovery.done"));
      load();
      onChanged?.();
    } catch (e) {
      setError(describeIpcError(toParsedError(e), t));
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) return null;
  return (
    <div className="recovery-list" data-testid="recovery-cards">
      {items.map((s) => (
        <section
          key={s.sessionId}
          className="recovery-card"
          aria-labelledby={`rec-${s.sessionId}`}
          data-testid="recovery-card"
        >
          <h3 id={`rec-${s.sessionId}`}>{t.t("meeting.recovery.title")}</h3>
          <p>
            {t.t("meeting.recovery.body", {
              title: s.title,
              duration: formatDuration(s.durationSec),
            })}
          </p>
          <div className="recovery-actions">
            <button
              type="button"
              className="btn-primary-sm"
              disabled={busy !== null}
              onClick={() => void act(s, "finalize")}
              data-testid="recovery-finalize"
            >
              {t.t("meeting.recovery.finalize")}
            </button>
            <button
              type="button"
              className="btn-sm"
              disabled={busy !== null}
              onClick={() => void act(s, "keepIncomplete")}
              data-testid="recovery-keep"
            >
              {t.t("meeting.recovery.keep")}
            </button>
            <button
              type="button"
              className="btn-danger-sm"
              disabled={busy !== null}
              onClick={() => setConfirm(s)}
              data-testid="recovery-discard"
            >
              {t.t("meeting.recovery.discard")}
            </button>
          </div>
        </section>
      ))}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {confirm && (
        <div
          className="nb-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="recovery-discard-title"
          data-testid="recovery-discard-confirm"
        >
          <div className="nb-modal">
            <h3 id="recovery-discard-title">
              {t.t("meeting.recovery.discardConfirmTitle")}
            </h3>
            <p>
              {t.t("meeting.recovery.discardConfirmBody", {
                title: confirm.title,
              })}
            </p>
            <div className="nb-modal-actions">
              <button
                type="button"
                className="btn-sm"
                onClick={() => setConfirm(null)}
              >
                {t.t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn-danger-sm"
                onClick={() => {
                  const s = confirm;
                  setConfirm(null);
                  void act(s, "discard");
                }}
                data-testid="recovery-discard-ok"
              >
                {t.t("meeting.recovery.discardConfirmOk")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
