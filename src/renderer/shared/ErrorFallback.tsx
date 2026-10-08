import { useState } from "react";
import { CrashReportDialog } from "./crash-report/CrashReportDialog";
import { useT } from "./i18n/i18n-context";
import "./error-fallback.css";

interface ErrorFallbackProps {
  /** Dựng lại vùng bị lỗi (không có ⇒ ẩn nút, chỉ còn tải lại ứng dụng). */
  onRetry?: () => void;
  /** Lỗi ở vỏ app: tải lại về màn Notebooks (HashRouter giữ hash ⇒ reload tại chỗ có thể gặp lại đúng lỗi). */
  resetRoute?: boolean;
}

type OpenState = "idle" | "opening" | "failed";

// Giao diện lỗi (088): thay màn trắng / trang lỗi mặc định khi 1 component ném lỗi. Không hiện chi tiết kỹ thuật
// (có thể dính nội dung tài liệu); chi tiết an toàn nằm ở thư mục nhật ký trên máy.
// 123: là function component ⇒ dùng useT() được (ErrorBoundary là class, chỉ render component này).
export function ErrorFallback({
  onRetry,
  resetRoute,
}: ErrorFallbackProps): JSX.Element {
  const t = useT();
  const [open, setOpen] = useState<OpenState>("idle");
  const [reporting, setReporting] = useState(false);

  function reload(): void {
    if (resetRoute) window.location.hash = "#/notebooks";
    window.location.reload();
  }

  async function openLogs(): Promise<void> {
    setOpen("opening");
    try {
      const r = await window.api.openLogsFolder();
      setOpen(r.ok ? "idle" : "failed");
    } catch {
      setOpen("failed");
    }
  }

  return (
    <div className="error-fallback" role="alert" data-testid="error-fallback">
      <div className="error-fallback-card">
        <span className="error-fallback-mark" aria-hidden="true">
          !
        </span>
        <h2>{t.t("app.errorFallback.title")}</h2>
        <p>
          {t.t("app.errorFallback.bodyBefore")}
          <code>main.log</code>
          {t.t("app.errorFallback.bodyAfter")}
        </p>
        <div className="error-fallback-actions">
          {onRetry && (
            <button type="button" className="btn-primary-sm" onClick={onRetry}>
              {t.t("common.retry")}
            </button>
          )}
          <button type="button" className="btn-outline-sm" onClick={reload}>
            {t.t("app.errorFallback.reload")}
          </button>
          {/* 093: gửi báo cáo ngay từ màn hình lỗi (người dùng xem/sửa rồi tự gửi). */}
          <button
            type="button"
            className="error-fallback-link error-fallback-push"
            onClick={() => setReporting(true)}
          >
            {t.t("app.logs.report")}
          </button>
          <button
            type="button"
            className="error-fallback-link"
            disabled={open === "opening"}
            onClick={() => void openLogs()}
          >
            {t.t("app.logs.open")}
          </button>
        </div>
        {open === "failed" && (
          <p className="error-fallback-note">{t.t("app.logs.openFailed")}</p>
        )}
      </div>
      {reporting && <CrashReportDialog onClose={() => setReporting(false)} />}
    </div>
  );
}
