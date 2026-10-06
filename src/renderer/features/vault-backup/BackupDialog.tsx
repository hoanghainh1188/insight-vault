import { useCallback, useEffect, useRef, useState } from "react";
import type { BackupCreateResult, VaultBackupStep } from "@shared/ipc/types";
import { useModalA11y } from "../../shared/useModalA11y";
import { formatBytes } from "../../shared/format-bytes";
import { validatePassword } from "./password-rules";
import { errorMessage, stepLabel } from "./messages";

type Phase =
  | { kind: "options" }
  | { kind: "running"; step: VaultBackupStep | null }
  | { kind: "done"; result: Extract<BackupCreateResult, { status: "ok" }> }
  | { kind: "error"; message: string };

const PW_HINT = {
  tooShort: "Mật khẩu cần tối thiểu 8 ký tự.",
  mismatch: "Hai lần nhập chưa khớp.",
} as const;

// Hộp thoại sao lưu (085 US1/US3): tuỳ chọn mật khẩu → main mở hộp thoại lưu file → tiến trình theo bước.
export function BackupDialog({
  onClose,
}: {
  onClose: () => void;
}): JSX.Element {
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
      else setPhase({ kind: "error", message: errorMessage(r.code) });
    } catch {
      setPhase({ kind: "error", message: errorMessage("ioError") });
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
        <h3 id="vb-backup-title">Sao lưu vault</h3>

        {phase.kind === "options" && (
          <>
            <p className="vb-desc">
              Lưu toàn bộ notebook, nguồn đã xử lý, lịch sử chat, kết quả Studio
              và cấu hình vào một file
              <code> .ivbackup</code>. Không gồm file gốc (PDF, audio, video,
              ảnh) và khoá API.
            </p>
            <label className="vb-check">
              <input
                type="checkbox"
                checked={protect}
                onChange={(e) => setProtect(e.target.checked)}
                data-testid="backup-protect"
              />
              Bảo vệ bằng mật khẩu
            </label>
            {protect ? (
              <>
                <div className="nb-field-label">Mật khẩu</div>
                <input
                  className="nb-input"
                  type="password"
                  autoComplete="new-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  data-testid="backup-password"
                />
                <div className="nb-field-label">Nhập lại mật khẩu</div>
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
                    {PW_HINT[check.reason]}
                  </p>
                )}
                <div className="vb-callout">
                  <strong>Không có cách lấy lại mật khẩu.</strong> Quên mật khẩu
                  đồng nghĩa không mở được bản sao lưu này.
                </div>
              </>
            ) : (
              <div
                className="vb-callout"
                data-testid="backup-unencrypted-warning"
              >
                File không mã hoá: ai có file đều đọc được nội dung tài liệu của
                bạn. Hãy cất ở nơi an toàn hoặc bật mật khẩu.
              </div>
            )}
            <div className="nb-modal-actions">
              <button type="button" className="btn-sm" onClick={onClose}>
                Huỷ
              </button>
              <button
                type="button"
                className="btn-primary-sm"
                disabled={!canStart}
                onClick={() => void start()}
                data-testid="backup-start"
              >
                Chọn nơi lưu…
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
            {phase.step ? stepLabel(phase.step) : "Đang chờ chọn nơi lưu…"}
          </div>
        )}

        {phase.kind === "done" && (
          <>
            <p className="vb-done" role="status" data-testid="backup-done">
              Đã sao lưu <strong>{phase.result.fileName}</strong> (
              {formatBytes(phase.result.sizeBytes)}) vào{" "}
              <code>{phase.result.dir}</code>.
            </p>
            <div className="nb-modal-actions">
              <button
                type="button"
                className="btn-primary-sm"
                onClick={onClose}
                data-testid="backup-close"
              >
                Xong
              </button>
            </div>
          </>
        )}

        {phase.kind === "error" && (
          <>
            <div className="nb-error" role="alert" data-testid="backup-error">
              {phase.message}
            </div>
            <div className="nb-modal-actions">
              <button type="button" className="btn-sm" onClick={onClose}>
                Đóng
              </button>
              <button
                type="button"
                className="btn-primary-sm"
                onClick={() => setPhase({ kind: "options" })}
              >
                Thử lại
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
