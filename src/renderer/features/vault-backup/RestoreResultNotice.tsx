import { useEffect, useRef, useState } from "react";
import type { RestoreResult } from "@shared/ipc/types";
import { formatDateTime } from "@shared/i18n";
import { useLang, useT } from "../../shared/i18n/i18n-context";
import "./vault-backup.css";

// Thông báo kết quả khôi phục ở lần mở app đầu tiên sau khi hoán đổi (085 FR-016a). Đọc 1 lần (one-shot ở main).
export function RestoreResultNotice(): JSX.Element | null {
  const t = useT();
  const lang = useLang();
  const [result, setResult] = useState<RestoreResult | null>(null);

  // getRestoreResult là one-shot (main xoá sau khi đọc) ⇒ gọi đúng 1 lần, kể cả khi StrictMode chạy effect 2 lần.
  const fetched = useRef(false);
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    window.api
      .getRestoreResult()
      .then(setResult)
      .catch(() => undefined);
  }, []);

  if (!result) return null;
  return (
    <div
      className={result.ok ? "vb-result" : "vb-result failed"}
      role="status"
      data-testid="restore-result"
    >
      <p>
        {result.ok ? (
          <>
            {t.t("backup.result.okBefore")}{" "}
            <strong>
              {formatDateTime(Date.parse(result.backupCreatedAt), lang)}
            </strong>
            {t.t("backup.result.okEnd")}
            {result.preRestorePath && (
              <>
                {" "}
                {t.t("backup.result.previousSavedAt")}{" "}
                <code>{result.preRestorePath}</code>
                {t.t("backup.result.okEnd")}
              </>
            )}
          </>
        ) : (
          t.t("backup.result.failed")
        )}
      </p>
      <button
        type="button"
        className="btn-sm"
        onClick={() => setResult(null)}
        data-testid="restore-result-close"
      >
        {t.t("common.close")}
      </button>
    </div>
  );
}
