import { useState } from "react";
import { CrashReportDialog } from "./crash-report/CrashReportDialog";
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
export function ErrorFallback({
  onRetry,
  resetRoute,
}: ErrorFallbackProps): JSX.Element {
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
        <h2>Đã xảy ra lỗi ở phần này</h2>
        <p>
          Dữ liệu của bạn vẫn an toàn trên máy. Hãy thử lại; nếu lỗi lặp lại, mở
          thư mục nhật ký và gửi tệp <code>main.log</code> khi báo lỗi — nhật ký
          không chứa nội dung tài liệu.
        </p>
        <div className="error-fallback-actions">
          {onRetry && (
            <button type="button" className="btn-primary-sm" onClick={onRetry}>
              Thử lại
            </button>
          )}
          <button type="button" className="btn-outline-sm" onClick={reload}>
            Tải lại ứng dụng
          </button>
          {/* 093: gửi báo cáo ngay từ màn hình lỗi (người dùng xem/sửa rồi tự gửi). */}
          <button
            type="button"
            className="error-fallback-link error-fallback-push"
            onClick={() => setReporting(true)}
          >
            Báo lỗi…
          </button>
          <button
            type="button"
            className="error-fallback-link"
            disabled={open === "opening"}
            onClick={() => void openLogs()}
          >
            Mở thư mục nhật ký
          </button>
        </div>
        {open === "failed" && (
          <p className="error-fallback-note">Không mở được thư mục nhật ký.</p>
        )}
      </div>
      {reporting && <CrashReportDialog onClose={() => setReporting(false)} />}
    </div>
  );
}
