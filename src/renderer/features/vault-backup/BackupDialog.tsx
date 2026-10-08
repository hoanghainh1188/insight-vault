import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BackupCreateResult,
  VaultBackupErrorCode,
  VaultBackupStep,
} from "@shared/ipc/types";
import { formatBytes } from "@shared/i18n";
import { useModalA11y } from "../../shared/useModalA11y";
import { useLang, useT } from "../../shared/i18n/i18n-context";
import { validatePassword } from "./password-rules";
import { errorMessage, stepLabel } from "./messages";

type Phase =
  | { kind: "options" }
  | { kind: "running"; step: VaultBackupStep | null }
  | { kind: "done"; result: Extract<BackupCreateResult, { status: "ok" }> }
  | { kind: "error"; code: VaultBackupErrorCode };

// 123: gợi ý mật khẩu theo lý do → khoá dịch (dịch lúc render).
const PW_HINT = {
  tooShort: "backup.dialog.pwTooShort",
  mismatch: "backup.dialog.pwMismatch",
} as const;

// Hộp thoại sao lưu (085 US1/US3): tuỳ chọn mật khẩu → main mở hộp thoại lưu file → tiến trình theo bước.
export function BackupDialog({
  onClose,
}: {
  onClose: () => void;
}): JSX.Element {
  const t = useT();
  const lang = useLang();
  const [phase, setPhase] = useState<Phase>({ kind: "options" });
  const [protect, setProtect] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const running = phase.kind === "running";

  const close = useCallback(() => {
    if (!running) onClose();
  }, [running, onClose]);
  useModalA11y({ active: true, onClose: close, containerRef: ref });

  useEffect(
    () =>
      window.api.onBackupProgress((e) => {
        if (e.op === "backup") setPhase({ kind: "running", step: e.step });
      }),
    [],
  );

  const check = validatePassword(pw, pw2);
  const canStart = !protect || check.ok;

  async function start(): Promise<void> {
    const password = protect ? pw : undefined;
    // Không giữ mật khẩu trong state lâu hơn cần thiết.
    setPw("");
    setPw2("");
    setPhase({ kind: "running", step: null });
    try {
      const r = await window.api.backupCreate(password ? { password } : {});
      if (r.status === "ok") setPhase({ kind: "done", result: r });
      else if (r.status === "cancelled") setPhase({ kind: "options" });
      else setPhase({ kind: "error", code: r.code });
    } catch {
      setPhase({ kind: "error", code: "ioError" });
    }
  }

  return (
    <div
      className="nb-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vb-backup-title"
      data-testid="backup-dialog"
    >
      <div className="nb-modal vb-modal" ref={ref}>
        <h3 id="vb-backup-title">{t.t("backup.dialog.title")}</h3>

        {phase.kind === "options" && (
          <>
            <p className="vb-desc">
              {t.t("backup.dialog.descBefore")}
              <code> .ivbackup</code>
              {t.t("backup.dialog.descAfter")}
            </p>
            <label className="vb-check">
              <input
                type="checkbox"
                checked={protect}
                onChange={(e) => setProtect(e.target.checked)}
                data-testid="backup-protect"
              />
              {t.t("backup.dialog.protect")}
            </label>
            {protect ? (
              <>
                <div className="nb-field-label">
                  {t.t("backup.dialog.password")}
                </div>
                <input
                  className="nb-input"
                  type="password"
                  autoComplete="new-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  data-testid="backup-password"
                />
                <div className="nb-field-label">
                  {t.t("backup.dialog.passwordConfirm")}
                </div>
                <input
                  className="nb-input"
                  type="password"
                  autoComplete="new-password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  data-testid="backup-password-confirm"
                />
                {!check.ok && (pw || pw2) && (
                  <p className="vb-hint" data-testid="backup-password-hint">
                    {t.t(PW_HINT[check.reason])}
                  </p>
                )}
                <div className="vb-callout">
                  <strong>{t.t("backup.dialog.noRecoveryStrong")}</strong>{" "}
                  {t.t("backup.dialog.noRecoveryRest")}
                </div>
              </>
            ) : (
              <div
                className="vb-callout"
                data-testid="backup-unencrypted-warning"
              >
                {t.t("backup.dialog.unencryptedWarning")}
              </div>
            )}
            <div className="nb-modal-actions">
              <button type="button" className="btn-sm" onClick={onClose}>
                {t.t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn-primary-sm"
                disabled={!canStart}
                onClick={() => void start()}
                data-testid="backup-start"
              >
                {t.t("backup.dialog.chooseLocation")}
              </button>
            </div>
          </>
        )}

        {phase.kind === "running" && (
          <div
            className="vb-progress"
            role="status"
            aria-live="polite"
            data-testid="backup-progress"
          >
            <span className="vb-spinner" aria-hidden="true" />
            {phase.step
              ? stepLabel(phase.step, t)
              : t.t("backup.dialog.waitingLocation")}
          </div>
        )}

        {phase.kind === "done" && (
          <>
            <p className="vb-done" role="status" data-testid="backup-done">
              {t.t("backup.dialog.doneBefore")}{" "}
              <strong>{phase.result.fileName}</strong>{" "}
              {t.t("backup.dialog.doneSize", {
                size: formatBytes(phase.result.sizeBytes, lang),
              })}{" "}
              <code>{phase.result.dir}</code>
              {t.t("backup.dialog.doneEnd")}
            </p>
            <div className="nb-modal-actions">
              <button
                type="button"
                className="btn-primary-sm"
                onClick={onClose}
                data-testid="backup-close"
              >
                {t.t("backup.dialog.finish")}
              </button>
            </div>
          </>
        )}

        {phase.kind === "error" && (
          <>
            <div className="nb-error" role="alert" data-testid="backup-error">
              {errorMessage(phase.code, t)}
            </div>
            <div className="nb-modal-actions">
              <button type="button" className="btn-sm" onClick={onClose}>
                {t.t("common.close")}
              </button>
              <button
                type="button"
                className="btn-primary-sm"
                onClick={() => setPhase({ kind: "options" })}
              >
                {t.t("common.retry")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
