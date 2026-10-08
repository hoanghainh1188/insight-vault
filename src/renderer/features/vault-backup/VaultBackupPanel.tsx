import { useCallback, useEffect, useState } from "react";
import type { VaultBackupErrorCode, VaultBackupState } from "@shared/ipc/types";
import { useT } from "../../shared/i18n/i18n-context";
import { BackupDialog } from "./BackupDialog";
import { RestoreDialog } from "./RestoreDialog";
import { busyReasonLabel, errorMessage } from "./messages";
import "./vault-backup.css";

const POLL_MS = 2000;

type Open =
  | { kind: "none" }
  | { kind: "backup" }
  | { kind: "restore"; token: string; encrypted: boolean };

// Khối "Sao lưu & khôi phục" trong Cài đặt → Lưu trữ cục bộ (085 FR-001). Nút bị vô hiệu kèm lý do khi đang xử
// lý nguồn / tái lập chỉ mục / có thao tác khác (FR-026).
export function VaultBackupPanel(): JSX.Element {
  const t = useT();
  const [state, setState] = useState<VaultBackupState>({
    busy: false,
    reason: null,
  });
  const [open, setOpen] = useState<Open>({ kind: "none" });
  const [pickError, setPickError] = useState<VaultBackupErrorCode | null>(null);
  const [picking, setPicking] = useState(false);

  const refresh = useCallback(() => {
    window.api
      .backupGetState()
      .then(setState)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  async function startRestore(): Promise<void> {
    if (picking) return;
    setPicking(true);
    setPickError(null);
    try {
      const r = await window.api.restorePick();
      if (r.status === "ok")
        setOpen({ kind: "restore", token: r.token, encrypted: r.encrypted });
      else if (r.status === "error") setPickError(r.code);
    } catch {
      setPickError("ioError");
    } finally {
      setPicking(false);
    }
    refresh();
  }

  const closeDialog = (): void => {
    setOpen({ kind: "none" });
    refresh();
  };

  const disabled = state.busy || picking || open.kind !== "none";

  return (
    <div className="vb-panel" data-testid="vault-backup-panel">
      <h4>{t.t("backup.panel.title")}</h4>
      <p className="vb-desc">{t.t("backup.panel.desc")}</p>
      <div className="vb-actions">
        <button
          type="button"
          className="btn-primary-sm"
          disabled={disabled}
          onClick={() => setOpen({ kind: "backup" })}
          data-testid="backup-open"
        >
          {t.t("backup.panel.backup")}
        </button>
        <button
          type="button"
          className="btn-sm"
          disabled={disabled}
          onClick={() => void startRestore()}
          data-testid="restore-open"
        >
          {t.t("backup.panel.restore")}
        </button>
        {state.busy && open.kind === "none" && (
          <span
            className="vb-busy"
            role="status"
            data-testid="vault-backup-busy"
          >
            {busyReasonLabel(state.reason, t)}
          </span>
        )}
      </div>
      {pickError && (
        <div className="nb-error" role="alert" data-testid="restore-pick-error">
          {errorMessage(pickError, t)}
        </div>
      )}
      {open.kind === "backup" && <BackupDialog onClose={closeDialog} />}
      {open.kind === "restore" && (
        <RestoreDialog
          token={open.token}
          encrypted={open.encrypted}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
