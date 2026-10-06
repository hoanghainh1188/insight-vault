import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AddSourceInput,
  IngestStep,
  Source,
  SourceStatus,
} from "@shared/ipc/types";
import { announce } from "../../shared/a11y/announcer";
import { sourceStatusMessage } from "../../shared/a11y/messages";

/** Tiến độ realtime của 1 nguồn đang xử lý (037). */
export interface SourceProgress {
  step: IngestStep;
  progress: number; // 0..1
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Đã xảy ra lỗi.";
}

// Hook nguồn của một notebook: snapshot listByNotebook + cập nhật realtime qua onSourceProgress (A12).
// Xử lý tuần tự nên số event ít → reload danh sách khi có event là đủ chính xác & đơn giản.
export function useSources(notebookId: string) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  // Tiến độ realtime theo sourceId (037) — tái dùng SourceProgressEvent{step,progress} (011). Xoá khi nguồn
  // đạt trạng thái cuối (ready/error) → thanh tiến độ biến mất.
  const [progress, setProgress] = useState<Record<string, SourceProgress>>({});
  // 091: tên nguồn (cho câu thông báo) + trạng thái THEO SỰ KIỆN gần nhất (chỉ báo khi đổi). Không lấy trạng
  // thái từ reload: reload bất đồng bộ có thể đọc "ready" từ DB trước khi sự kiện ready tới ⇒ nuốt mất câu báo.
  const titlesRef = useRef<Record<string, string>>({});
  const eventStatusRef = useRef<Record<string, SourceStatus>>({});

  const reload = useCallback(() => {
    window.api
      .sourceListByNotebook(notebookId)
      .then((list) => {
        // Gộp (không thay): reload khởi chạy trước sourceAdd có thể trả danh sách chưa có nguồn mới.
        titlesRef.current = {
          ...titlesRef.current,
          ...Object.fromEntries(list.map((s) => [s.id, s.title])),
        };
        setSources(list);
      })
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, [notebookId]);

  useEffect(() => reload(), [reload]);

  useEffect(() => {
    const off = window.api.onSourceProgress((e) => {
      if (e.notebookId !== notebookId) return;
      const msg = sourceStatusMessage(
        eventStatusRef.current[e.sourceId],
        e,
        titlesRef.current[e.sourceId],
      );
      eventStatusRef.current[e.sourceId] = e.status;
      if (msg) announce(msg, e.status === "error" ? "assertive" : "polite");
      setProgress((prev) => {
        const next = { ...prev };
        if (e.status === "ready" || e.status === "error") {
          delete next[e.sourceId];
        } else {
          next[e.sourceId] = { step: e.step, progress: e.progress };
        }
        return next;
      });
      reload();
    });
    return off;
  }, [notebookId, reload]);

  const add = useCallback(
    async (input: AddSourceInput): Promise<boolean> => {
      try {
        const res = await window.api.sourceAdd(input);
        // 091: biết tên ngay ⇒ sự kiện tiến độ đầu tiên (có thể tới trước reload) vẫn báo kèm tên.
        titlesRef.current = {
          ...titlesRef.current,
          [res.source.id]: res.source.title,
        };
        reload();
        return res.duplicateWarning;
      } catch (e) {
        throw new Error(message(e));
      }
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      try {
        await window.api.sourceDelete(id);
      } finally {
        reload();
      }
    },
    [reload],
  );

  const retry = useCallback(
    async (id: string): Promise<void> => {
      try {
        await window.api.sourceRetry(id);
      } finally {
        reload();
      }
    },
    [reload],
  );

  return { sources, loading, progress, reload, add, remove, retry };
}
