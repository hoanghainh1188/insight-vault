import { useCallback, useEffect, useRef, useState } from "react";
import type { BackupSummary, VaultBackupStep } from "@shared/ipc/types";
import { useModalA11y } from "../../shared/useModalA11y";
import { errorMessage, stepLabel } from "./messages";

type Phase =
  | { kind: "password"; error: string | null }
  | { kind: "working"; step: VaultBackupStep | null }
  | { kind: "summary"; summary: BackupSummary }
  | { kind: "fatal"; message: string };

const dateTime = (iso: string): string =>
  new Date(iso).toLocaleString("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

interface RestoreDialogProps {
  token: string;
  encrypted: boolean;
  onClose: () => void;
}

// Hộp thoại khôi phục (085 US2/US3): (mật khẩu) → giải mã + kiểm tra → tóm tắt + cảnh báo ghi đè → xác nhận
// ⇒ main tự sao lưu vault hiện tại rồi khởi động lại app. Huỷ bất kỳ lúc nào trước xác nhận ⇒ vault không đổi.
export function RestoreDialog({
  token,
  encrypted,
  onClose,
}: RestoreDialogProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>(
    encrypted
      ? { kind: "password", error: null }
      : { kind: "working", step: null },
  );
  const [pw, setPw] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const working = phase.kind === "working";

  const cancel = useCallback(() => {
    if (working) return;
    void window.api.restoreCancel(token).finally(onClose);
  }, [working, token, onClose]);
  useModalA11y({ active: true, onClose: cancel, containerRef: ref });

  useEffect(
    () =>
      window.api.onBackupProgress((e) => {
        if (e.op === "restore") setPhase({ kind: "working", step: e.step });
      }),
    [],
  );

  const prepare = useCallback(
    async (password?: string): Promise<void> => {
      setPhase({ kind: "working", step: null });
      try {
        const r = await window.api.restorePrepare(
          password ? { token, password } : { token },
        );
        if (r.status === "ok") {
          setPhase({ kind: "summary", summary: r.summary });
        } else if (encrypted && r.code === "badPasswordOrCorrupt") {
          setPhase({ kind: "password", error: errorMessage(r.code) });
        } else {
          setPhase({ kind: "fatal", message: errorMessage(r.code) });
        }
      } catch {
        setPhase({ kind: "fatal", message: errorMessage("ioError") });
      }
    },
    [token, encrypted],
  );

  // Chỉ chạy 1 lần kể cả khi React StrictMode gọi effect 2 lần (main cũng chặn gọi chồng).
  const started = useRef(false);
  useEffect(() => {
    if (encrypted || started.current) return;
    started.current = true;
    void prepare();
  }, [encrypted, prepare]);

  async function confirm(): Promise<void> {
    setPhase({ kind: "working", step: "preBackup" });
    try {
      const r = await window.api.restoreConfirm(token);
      // Thành công ⇒ app thoát + mở lại; chỉ còn nhánh lỗi cần xử lý ở đây.
      if (r.status === "error")
        setPhase({ kind: "fatal", message: errorMessage(r.code) });
    } catch {
      // Kênh IPC đứt vì app đang khởi động lại — bình thường.
    }
  }

  function submitPassword(): void {
    const value = pw;
    setPw("");
    void prepare(value);
  }

  return (
    <div
      className="nb-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vb-restore-title"
      data-testid="restore-dialog"
    >
      <div className="nb-modal vb-modal" ref={ref}>
        <h3 id="vb-restore-title">Khôi phục vault</h3>

        {phase.kind === "password" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pw) submitPassword();
            }}
          >
            <p className="vb-desc">
              File sao lưu này được bảo vệ bằng mật khẩu.
            </p>
            <div className="nb-field-label">Mật khẩu</div>
            <input
              className="nb-input"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              data-testid="restore-password"
            />
            {phase.error && (
              <div
                className="nb-error"
                role="alert"
                data-testid="restore-error"
              >
                {phase.error}
              </div>
            )}
            <div className="nb-modal-actions">
              <button type="button" className="btn-sm" onClick={cancel}>
                Huỷ
              </button>
              <button
                type="submit"
                className="btn-primary-sm"
                disabled={!pw}
                data-testid="restore-unlock"
              >
                Mở bản sao lưu
              </button>
            </div>
          </form>
        )}

        {phase.kind === "working" && (
          <div
            className="vb-progress"
            role="status"
            aria-live="polite"
            data-testid="restore-progress"
          >
            <span className="vb-spinner" aria-hidden="true" />
            {phase.step ? stepLabel(phase.step) : "Đang đọc bản sao lưu…"}
          </div>
        )}

        {phase.kind === "summary" && (
          <>
            <dl className="vb-summary" data-testid="restore-summary">
              <dt>Ngày tạo</dt>
              <dd>{dateTime(phase.summary.createdAt)}</dd>
              <dt>Nội dung</dt>
              <dd>
                {phase.summary.notebookCount} notebook ·{" "}
                {phase.summary.sourceCount} nguồn
              </dd>
              <dt>Phiên bản</dt>
              <dd>InsightVault {phase.summary.appVersion}</dd>
              <dt>Mã hoá</dt>
              <dd>{phase.summary.encrypted ? "Có mật khẩu" : "Không"}</dd>
            </dl>
            {phase.summary.needsReindex && (
              <p className="vb-hint">
                Bản sao lưu dùng mô hình lập chỉ mục khác — sau khi khôi phục,
                app sẽ tái lập chỉ mục ở nền.
              </p>
            )}
            <div
              className="vb-callout danger"
              data-testid="restore-overwrite-warning"
            >
              <strong>Toàn bộ vault hiện tại sẽ bị thay thế</strong> bằng bản
              sao lưu này. Vault hiện tại sẽ được tự sao lưu (không mã hoá, nằm
              cùng thư mục dữ liệu) vào <code>backups</code> trước, sau đó app
              khởi động lại.
            </div>
            <div className="nb-modal-actions">
              <button
                type="button"
                className="btn-sm"
                onClick={cancel}
                data-testid="restore-cancel"
              >
                Huỷ
              </button>
              <button
                type="button"
                className="btn-danger-sm"
                onClick={() => void confirm()}
                data-testid="restore-confirm"
              >
                Khôi phục và khởi động lại
              </button>
            </div>
          </>
        )}

        {phase.kind === "fatal" && (
          <>
            <div className="nb-error" role="alert" data-testid="restore-error">
              {phase.message}
            </div>
            <div className="nb-modal-actions">
              <button
                type="button"
                className="btn-sm"
                onClick={cancel}
                autoFocus
              >
                Đóng
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
