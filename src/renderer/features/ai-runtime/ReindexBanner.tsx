import { useEffect, useState } from "react";
import type { ReindexStatus } from "@shared/ipc/types";

// 059: dải báo "đang tái lập chỉ mục" (đổi engine embedding). Hiện tiến độ ở nền, không chặn thao tác.
// Ẩn khi không chạy. Trong lúc chạy, hỏi đáp trả thông báo tạm (rag-service reindex guard).
export function ReindexBanner(): JSX.Element | null {
  const [status, setStatus] = useState<ReindexStatus | null>(null);

  useEffect(() => {
    void window.api
      .embedReindexStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
    const off = window.api.onReindexProgress(setStatus);
    return off;
  }, []);

  if (!status || !status.inProgress) return null;

  const pct =
    status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;

  return (
    <div className="reindex-banner" data-testid="reindex-banner" role="status">
      <span className="reindex-spinner" aria-hidden="true" />
      <span>
        Đang tái lập chỉ mục nguồn (cập nhật công cụ tìm kiếm cục bộ)
        {status.total > 0 && (
          <>
            {" "}
            — {status.done}/{status.total} ({pct}%)
          </>
        )}
        …
      </span>
    </div>
  );
}
