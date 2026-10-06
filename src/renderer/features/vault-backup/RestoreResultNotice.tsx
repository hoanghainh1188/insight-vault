import { useEffect, useRef, useState } from "react";
import type { RestoreResult } from "@shared/ipc/types";
import "./vault-backup.css";

const dateTime = (iso: string): string =>
  new Date(iso).toLocaleString("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

// Thông báo kết quả khôi phục ở lần mở app đầu tiên sau khi hoán đổi (085 FR-016a). Đọc 1 lần (one-shot ở main).
export function RestoreResultNotice(): JSX.Element | null {
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
            Đã khôi phục vault từ bản sao lưu ngày{" "}
            <strong>{dateTime(result.backupCreatedAt)}</strong>.
            {result.preRestorePath && (
              <>
                {" "}
                Vault trước đó được lưu tại <code>{result.preRestorePath}</code>
                .
              </>
            )}
          </>
        ) : (
          "Khôi phục không thành công — vault trước đó được giữ nguyên."
        )}
      </p>
      <button
        type="button"
        className="btn-sm"
        onClick={() => setResult(null)}
        data-testid="restore-result-close"
      >
        Đóng
      </button>
    </div>
  );
}
