import { useEffect, useState } from "react";
import type { StorageInfo } from "@shared/ipc/types";
import { formatBytes } from "../../shared/format-bytes";
import { VaultBackupPanel } from "../vault-backup/VaultBackupPanel";
import { LogsFolderRow } from "./LogsFolderRow";
import { useLang, useT } from "../../shared/i18n/i18n-context";

// Section "Lưu trữ cục bộ" ở Cài đặt (037, prototype S5). Hiển thị đường dẫn thư mục dữ liệu + dung lượng
// đã dùng + còn trống — củng cố minh bạch local-first (Constitution I). 085: kèm khối Sao lưu & khôi phục.
// 088: kèm dòng Nhật ký lỗi (mở thư mục nhật ký).
export function SettingsStorageSection(): JSX.Element {
  const t = useT();
  const lang = useLang();
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    window.api
      .getStorageInfo()
      .then((s) => alive && setInfo(s))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const usedPct =
    info && info.usedBytes + info.freeBytes > 0
      ? Math.min(
          100,
          Math.round(
            (info.usedBytes / (info.usedBytes + info.freeBytes)) * 100,
          ),
        )
      : 0;

  return (
    <section
      className="settings-ai settings-storage"
      data-testid="settings-storage"
    >
      <div className="settings-ai-head">
        <h3>{t.t("app.storage.title")}</h3>
      </div>

      {failed ? (
        <div className="ai-note" data-testid="storage-error">
          {t.t("app.storage.error")}
        </div>
      ) : !info ? (
        <div className="ai-note" data-testid="storage-loading">
          {t.t("app.storage.loading")}
        </div>
      ) : (
        <>
          <p className="storage-path" data-testid="storage-path">
            {t.t("app.storage.path")} <code>{info.path}</code>
          </p>
          <div className="storage-bar" aria-hidden="true">
            <div
              className="storage-bar-fill"
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <p className="storage-meta" data-testid="storage-meta">
            {t.t("app.storage.used")}{" "}
            <strong>{formatBytes(info.usedBytes, lang)}</strong> ·{" "}
            {t.t("app.storage.free")} {formatBytes(info.freeBytes, lang)}
          </p>
        </>
      )}
      <VaultBackupPanel />
      <LogsFolderRow />
    </section>
  );
}
