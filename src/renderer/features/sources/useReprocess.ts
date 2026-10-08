import { useCallback, useEffect, useRef, useState } from "react";
import type { ParsedIpcError } from "@shared/online-error-tag";
import type { Translator } from "@shared/i18n";
import { announce } from "../../shared/a11y/announcer";
import { sourceErrorText } from "../../shared/a11y/messages";
import { useT } from "../../shared/i18n/i18n-context";
import {
  describeIpcError,
  toParsedError,
} from "../../shared/i18n/describe-error";
import { useRelink } from "./useRelink";

// 112 (FR-012..FR-016): hook "Xử lý lại" một nguồn PDF ở cột Nguồn. Renderer chỉ gửi id; main kiểm khoá kho, tệp
// gốc còn + cùng nội dung. Tiến độ/kết quả theo sự kiện source:progress có cờ `reprocess` (nguồn vẫn `ready`).
// 123: state giữ MÔ TẢ thông báo (mã/lỗi đã tách) — dịch lúc render theo ngôn ngữ hiện tại.

/** Mô tả thông báo (không phải chuỗi đã dịch). */
export type ReprocessNotice =
  | { kind: "mismatch" }
  | { kind: "progressError"; label: string }
  | { kind: "ipcError"; error: ParsedIpcError };

export function reprocessNoticeText(
  n: ReprocessNotice,
  tr: Translator,
): string {
  switch (n.kind) {
    case "mismatch":
      return tr.t("sources.reprocess.mismatch");
    case "progressError":
      return sourceErrorText(n.label, tr);
    case "ipcError":
      return describeIpcError(n.error, tr);
  }
}

export interface ReprocessState {
  running: boolean;
  /** 0..100 */
  pct: number;
  /** Thông báo đã dịch theo ngôn ngữ hiện tại (tính lúc render). */
  message: string | null;
  start: () => Promise<void>;
  cancel: () => Promise<void>;
}

export function useReprocess(sourceId: string, title: string): ReprocessState {
  const t = useT();
  const trRef = useRef(t);
  trRef.current = t;
  const [running, setRunning] = useState(false);
  const [pct, setPct] = useState(0);
  const [notice, setNotice] = useState<ReprocessNotice | null>(null);
  const { relink } = useRelink();

  const report = useCallback((n: ReprocessNotice): void => {
    setNotice(n);
    announce(reprocessNoticeText(n, trRef.current), "assertive");
  }, []);

  useEffect(() => {
    const off = window.api.onSourceProgress((e) => {
      if (e.sourceId !== sourceId || !e.reprocess) return;
      if (e.step === "done") {
        setRunning(false);
        setPct(0);
        if (e.errorCode) {
          report({ kind: "progressError", label: e.errorCode });
        } else {
          announce(
            trRef.current.t("sources.reprocess.done", { title }),
            "polite",
          );
        }
        return;
      }
      setRunning(true);
      setPct(Math.round(e.progress * 100));
    });
    return off;
  }, [sourceId, title, report]);

  const request = useCallback(async (): Promise<void> => {
    const res = await window.api.sourceReprocess(sourceId);
    if (res.status === "queued") {
      setRunning(true);
      return;
    }
    if (res.status === "mismatch") {
      report({ kind: "mismatch" });
      return;
    }
    // missing ⇒ dẫn sang "Chọn lại tệp gốc…" (101); chọn đúng tệp ⇒ xử lý lại tiếp.
    if ((await relink(sourceId)) === "ok") {
      const again = await window.api.sourceReprocess(sourceId);
      if (again.status === "queued") setRunning(true);
    }
  }, [sourceId, relink, report]);

  const start = useCallback(async (): Promise<void> => {
    setNotice(null);
    try {
      await request();
    } catch (e) {
      report({ kind: "ipcError", error: toParsedError(e) });
    }
  }, [request, report]);

  const cancel = useCallback(async (): Promise<void> => {
    await window.api.sourceReprocessCancel(sourceId).catch(() => undefined);
  }, [sourceId]);

  const message = notice ? reprocessNoticeText(notice, t) : null;
  return { running, pct, message, start, cancel };
}
