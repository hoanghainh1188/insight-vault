import { useCallback, useRef, useState } from "react";
import type { SourceRelinkResult } from "@shared/ipc/types";
import { announce } from "../../shared/a11y/announcer";
import { useT } from "../../shared/i18n/i18n-context";
import { relinkMessage } from "./relink-messages";

type RelinkStatus = SourceRelinkResult["status"];

// 101 — hook "chọn lại tệp gốc" dùng chung cho trình xem nguồn + cột Nguồn. Hộp thoại + kiểm nội dung ở main;
// renderer chỉ gửi id. Kết quả được báo cho trình đọc màn hình (091).
// 123: state giữ MÃ kết quả (không giữ chuỗi đã dịch) ⇒ đổi ngôn ngữ thì câu giải thích dịch lại khi render.
export function useRelink(): {
  relink: (sourceId: string) => Promise<RelinkStatus>;
  busy: boolean;
  message: string | null;
  clear: () => void;
} {
  const t = useT();
  const trRef = useRef(t);
  trRef.current = t;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<RelinkStatus | null>(null);

  const relink = useCallback(async (sourceId: string) => {
    setBusy(true);
    setFailed(null);
    let status: RelinkStatus;
    try {
      status = (await window.api.sourceRelink(sourceId)).status;
    } catch {
      status = "error";
    }
    setBusy(false);
    if (status !== "ok") setFailed(status);
    const msg = relinkMessage(status, trRef.current);
    if (msg) announce(msg, status === "ok" ? "polite" : "assertive");
    return status;
  }, []);

  const clear = useCallback(() => setFailed(null), []);
  const message = failed ? relinkMessage(failed, t) : null;

  return { relink, busy, message, clear };
}
