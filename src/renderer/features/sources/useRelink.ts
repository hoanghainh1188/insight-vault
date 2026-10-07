import { useCallback, useState } from "react";
import type { SourceRelinkResult } from "@shared/ipc/types";
import { announce } from "../../shared/a11y/announcer";
import { relinkMessage } from "./relink-messages";

// 101 — hook "chọn lại tệp gốc" dùng chung cho trình xem nguồn + cột Nguồn. Hộp thoại + kiểm nội dung ở main;
// renderer chỉ gửi id. Kết quả được báo cho trình đọc màn hình (091).
export function useRelink(): {
  relink: (sourceId: string) => Promise<SourceRelinkResult["status"]>;
  busy: boolean;
  message: string | null;
  clear: () => void;
} {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const relink = useCallback(async (sourceId: string) => {
    setBusy(true);
    setMessage(null);
    let status: SourceRelinkResult["status"];
    try {
      status = (await window.api.sourceRelink(sourceId)).status;
    } catch {
      status = "error";
    }
    setBusy(false);
    const msg = relinkMessage(status);
    if (status !== "ok") setMessage(msg);
    if (msg) announce(msg, status === "ok" ? "polite" : "assertive");
    return status;
  }, []);

  const clear = useCallback(() => setMessage(null), []);

  return { relink, busy, message, clear };
}
