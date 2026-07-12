import { useEffect, useState } from "react";
import type { StorageInfo } from "@shared/ipc/types";
import { formatBytes } from "../../shared/format-bytes";

// Section "Lưu trữ cục bộ" ở Cài đặt (037, prototype S5). Hiển thị đường dẫn thư mục dữ liệu + dung lượng
// đã dùng + còn trống — củng cố minh bạch local-first (Constitution I). Chỉ đọc, không xoá/di chuyển.
export function SettingsStorageSection(): JSX.Element {
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
        <h3>Lưu trữ cục bộ</h3>
      </div>

      {failed ? (
        <div className="ai-note" data-testid="storage-error">
          Không đọc được thông tin lưu trữ.
        </div>
      ) : !info ? (
        <div className="ai-note" data-testid="storage-loading">
          Đang tính dung lượng…
        </div>
      ) : (
        <>
          <p className="storage-path" data-testid="storage-path">
            Thư mục dữ liệu: <code>{info.path}</code>
          </p>
          <div className="storage-bar" aria-hidden="true">
            <div
              className="storage-bar-fill"
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <p className="storage-meta" data-testid="storage-meta">
            Đã dùng <strong>{formatBytes(info.usedBytes)}</strong> · Còn trống{" "}
            {formatBytes(info.freeBytes)}
          </p>
        </>
      )}
    </section>
  );
}
