import { useEffect, useRef, useState } from "react";
import type { ReindexStatus } from "@shared/ipc/types";
import { announce } from "../../shared/a11y/announcer";
import { reindexMessage } from "../../shared/a11y/messages";
import { useT } from "../../shared/i18n/i18n-context";

// 059: dải báo "đang tái lập chỉ mục" (đổi engine embedding). Hiện tiến độ ở nền, không chặn thao tác.
// Ẩn khi không chạy. Trong lúc chạy, hỏi đáp trả thông báo tạm (rag-service reindex guard).
export function ReindexBanner(): JSX.Element | null {
  const t = useT();
  // 123: translator HIỆN TẠI qua ref — đổi ngôn ngữ không kích hoạt báo lại.
  const tRef = useRef(t);
  tRef.current = t;
  const [status, setStatus] = useState<ReindexStatus | null>(null);
  // 091: chỉ báo lúc bắt đầu/kết thúc (null = chưa biết trạng thái trước).
  const prevRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!status) return;
    const msg = reindexMessage(
      prevRef.current,
      status.inProgress,
      tRef.current,
    );
    prevRef.current = status.inProgress;
    if (msg) announce(msg);
  }, [status]);

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
    // 091: KHÔNG role=status — dòng chữ đổi theo từng chunk sẽ bị đọc liên tục; mốc báo qua announce(). Dòng chữ
    // vẫn đọc được khi duyệt trang (số x/y + %), nên không bọc thêm progressbar (children bị coi là trình bày).
    <div className="reindex-banner" data-testid="reindex-banner">
      <span className="reindex-spinner" aria-hidden="true" />
      <span>
        {status.total > 0
          ? t.t("ai.reindex.runningProgress", {
              done: status.done,
              total: status.total,
              pct,
            })
          : t.t("ai.reindex.running")}
      </span>
    </div>
  );
}
