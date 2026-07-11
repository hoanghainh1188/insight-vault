import { useCallback, useEffect, useState } from "react";
import type { RuntimeStatus } from "@shared/ipc/types";

// Đọc trạng thái runtime AI (check-on-demand — A2). refresh() gọi lại khi mở Cài đặt / bấm kiểm tra.
export function useRuntimeStatus(): {
  status: RuntimeStatus | null;
  loading: boolean;
  refresh: () => void;
} {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    window.api
      .aiGetRuntimeStatus()
      .then((s) => setStatus(s))
      .catch(() =>
        setStatus({
          reachable: false,
          ollamaReady: false,
          reason: "Không đọc được trạng thái runtime.",
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, refresh };
}
