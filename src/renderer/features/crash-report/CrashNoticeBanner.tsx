import { useEffect, useRef, useState } from "react";
import type { CrashNotice } from "@shared/ipc/types";
import type { Translator } from "@shared/i18n";
import { useT } from "../../shared/i18n/i18n-context";
import { CrashReportDialog } from "../../shared/crash-report/CrashReportDialog";
import "./crash-report.css";

function noticeText(n: CrashNotice, t: Translator): string {
  const crashes = n.newNativeCrashes;
  if (n.abnormalExit && crashes > 0)
    return t.plural("crash.notice.abnormalWithCrashes", crashes);
  if (n.abnormalExit) return t.t("crash.notice.abnormal");
  return t.plural("crash.notice.crashes", crashes);
}

// 093 — dải báo lúc mở app khi phiên trước đóng bất thường / có crash native mới. Mời gửi báo cáo (opt-in, bỏ qua
// được, không chặn thao tác). Đọc 1 lần kể cả khi StrictMode chạy effect 2 lần.
export function CrashNoticeBanner(): JSX.Element | null {
  const t = useT();
  const [notice, setNotice] = useState<CrashNotice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    window.api
      .crashGetNotice()
      .then(setNotice)
      .catch(() => setNotice(null));
  }, []);

  const dismiss = (): void => {
    setNotice(null);
    void window.api.crashDismissNotice().catch(() => undefined);
  };

  const show =
    notice !== null && (notice.abnormalExit || notice.newNativeCrashes > 0);

  return (
    <>
      {show && (
        <div className="crash-notice" role="status" data-testid="crash-notice">
          <p>
            {noticeText(notice, t)} {t.t("crash.notice.invite")}
          </p>
          <button
            type="button"
            className="btn-sm"
            onClick={() => setDialogOpen(true)}
            data-testid="crash-notice-open"
          >
            {t.t("crash.notice.open")}
          </button>
          <button
            type="button"
            className="btn-sm crash-notice-dismiss"
            onClick={dismiss}
            data-testid="crash-notice-dismiss"
          >
            {t.t("crash.notice.dismiss")}
          </button>
        </div>
      )}
      {dialogOpen && (
        <CrashReportDialog
          onClose={(sent) => {
            setDialogOpen(false);
            // Gửi xong: main đã ghi nhận lúc mở issue ⇒ chỉ ẩn. Huỷ: giữ dải để người dùng chủ động "Bỏ qua".
            if (sent) setNotice(null);
          }}
        />
      )}
    </>
  );
}
