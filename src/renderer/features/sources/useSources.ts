import { useCallback, useEffect, useState } from "react";
import type { AddSourceInput, Source } from "@shared/ipc/types";

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Đã xảy ra lỗi.";
}

// Hook nguồn của một notebook: snapshot listByNotebook + cập nhật realtime qua onSourceProgress (A12).
// Xử lý tuần tự nên số event ít → reload danh sách khi có event là đủ chính xác & đơn giản.
export function useSources(notebookId: string) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    window.api
      .sourceListByNotebook(notebookId)
      .then(setSources)
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, [notebookId]);

  useEffect(() => reload(), [reload]);

  useEffect(() => {
    const off = window.api.onSourceProgress((e) => {
      if (e.notebookId === notebookId) reload();
    });
    return off;
  }, [notebookId, reload]);

  const add = useCallback(
    async (input: AddSourceInput): Promise<boolean> => {
      try {
        const res = await window.api.sourceAdd(input);
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

  return { sources, loading, reload, add, remove, retry };
}
