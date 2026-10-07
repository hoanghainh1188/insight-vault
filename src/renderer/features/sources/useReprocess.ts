import { useCallback, useEffect, useState } from "react";
import { announce } from "../../shared/a11y/announcer";
import { useRelink } from "./useRelink";

// 112 (FR-012..FR-016): hook "Xử lý lại" một nguồn PDF ở cột Nguồn. Renderer chỉ gửi id; main kiểm khoá kho, tệp
// gốc còn + cùng nội dung. Tiến độ/kết quả theo sự kiện source:progress có cờ `reprocess` (nguồn vẫn `ready`).

export const REPROCESS_MISMATCH_MSG =
  "Tệp gốc đã bị sửa so với lúc nạp — không thể xử lý lại (trích dẫn sẽ lệch). Hãy nạp tệp như một nguồn mới.";
const DONE_MSG = (title: string) => `Đã xử lý lại “${title}”.`;

export interface ReprocessState {
  running: boolean;
  /** 0..100 */
  pct: number;
  message: string | null;
  start: () => Promise<void>;
  cancel: () => Promise<void>;
}

const errMsg = (e: unknown): string =>
  e instanceof Error && e.message ? e.message : "Không xử lý lại được.";

export function useReprocess(sourceId: string, title: string): ReprocessState {
  const [running, setRunning] = useState(false);
  const [pct, setPct] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const { relink } = useRelink();

  useEffect(() => {
    const off = window.api.onSourceProgress((e) => {
      if (e.sourceId !== sourceId || !e.reprocess) return;
      if (e.step === "done") {
        setRunning(false);
        setPct(0);
        if (e.errorLabel) {
          setMessage(e.errorLabel);
          announce(e.errorLabel, "assertive");
        } else {
          announce(DONE_MSG(title), "polite");
        }
        return;
      }
      setRunning(true);
      setPct(Math.round(e.progress * 100));
    });
    return off;
  }, [sourceId, title]);

  const request = useCallback(async (): Promise<void> => {
    const res = await window.api.sourceReprocess(sourceId);
    if (res.status === "queued") {
      setRunning(true);
      return;
    }
    if (res.status === "mismatch") {
      setMessage(REPROCESS_MISMATCH_MSG);
      announce(REPROCESS_MISMATCH_MSG, "assertive");
      return;
    }
    // missing ⇒ dẫn sang "Chọn lại tệp gốc…" (101); chọn đúng tệp ⇒ xử lý lại tiếp.
    if ((await relink(sourceId)) === "ok") {
      const again = await window.api.sourceReprocess(sourceId);
      if (again.status === "queued") setRunning(true);
    }
  }, [sourceId, relink]);

  const start = useCallback(async (): Promise<void> => {
    setMessage(null);
    try {
      await request();
    } catch (e) {
      const m = errMsg(e);
      setMessage(m);
      announce(m, "assertive");
    }
  }, [request]);

  const cancel = useCallback(async (): Promise<void> => {
    await window.api.sourceReprocessCancel(sourceId).catch(() => undefined);
  }, [sourceId]);

  return { running, pct, message, start, cancel };
}
