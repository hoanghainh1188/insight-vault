import { useCallback, useEffect, useState } from "react";
import type { RuntimeStatus } from "@shared/ipc/types";

// Đọc trạng thái runtime AI (check-on-demand — A2). refresh() gọi lại khi mở Cài đặt / bấm kiểm tra.
// 123: IPC lỗi ⇒ readFailed=true + reason=null (nơi hiển thị dịch "ai.runtime.statusUnreadable" lúc render).
export function useRuntimeStatus(): {
  status: RuntimeStatus | null;
  readFailed: boolean;
  loading: boolean;
  refresh: () => void;
} {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    window.api
      .aiGetRuntimeStatus()
      .then((s) => {
        setStatus(s);
        setReadFailed(false);
      })
      .catch(() => {
        setStatus({ reachable: false, ollamaReady: false, reason: null });
        setReadFailed(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, readFailed, loading, refresh };
}
