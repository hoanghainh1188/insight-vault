import { useCallback, useEffect, useState } from "react";
import type { StudioKind, StudioResult } from "@shared/ipc/types";

// Hook cột Studio: nạp kết quả đã lưu khi mở notebook (studio:list) + sinh mới theo loại (studio:generate).
// State theo TỪNG loại (results/loading/error) để 4 nút độc lập (US2). Đổi notebook → nạp lại.

export type StudioResultMap = Partial<Record<StudioKind, StudioResult>>;
export type StudioFlagMap = Partial<Record<StudioKind, boolean>>;
export type StudioErrorMap = Partial<Record<StudioKind, string>>;

export function useStudio(notebookId: string) {
  const [results, setResults] = useState<StudioResultMap>({});
  const [loading, setLoading] = useState<StudioFlagMap>({});
  const [errors, setErrors] = useState<StudioErrorMap>({});
  const [ollamaReady, setOllamaReady] = useState<boolean | null>(null);
  const [hasReadySources, setHasReadySources] = useState(false);

  // Trạng thái sẵn sàng (mirror useChat): model + có nguồn ready. Nút vô hiệu khi thiếu (FR-010/011).
  const refreshReadiness = useCallback(() => {
    window.api
      .aiGetRuntimeStatus()
      .then((s) => setOllamaReady(s.ollamaReady))
      .catch(() => setOllamaReady(false));
    window.api
      .sourceListByNotebook(notebookId)
      .then((list) =>
        setHasReadySources(list.some((s) => s.status === "ready")),
      )
      .catch(() => setHasReadySources(false));
  }, [notebookId]);

  useEffect(() => refreshReadiness(), [refreshReadiness]);

  // Nguồn vừa nạp xong → cập nhật lại "có nguồn ready".
  useEffect(() => {
    const off = window.api.onSourceProgress((e) => {
      if (e.notebookId === notebookId) refreshReadiness();
    });
    return off;
  }, [notebookId, refreshReadiness]);

  // Đổi notebook → nạp kết quả đã lưu (persist qua đóng/mở — US3).
  useEffect(() => {
    let cancelled = false;
    setResults({});
    setErrors({});
    window.api
      .studioList(notebookId)
      .then((list) => {
        if (cancelled) return;
        const map: StudioResultMap = {};
        for (const r of list) map[r.kind] = r;
        setResults(map);
      })
      .catch(() => {
        if (!cancelled) setResults({});
      });
    return () => {
      cancelled = true;
    };
  }, [notebookId]);

  const generate = useCallback(
    async (kind: StudioKind) => {
      setLoading((p) => ({ ...p, [kind]: true }));
      setErrors((p) => ({ ...p, [kind]: undefined }));
      try {
        const res = await window.api.studioGenerate({ notebookId, kind });
        setResults((p) => ({ ...p, [kind]: res }));
      } catch (e) {
        setErrors((p) => ({
          ...p,
          [kind]: e instanceof Error ? e.message : "Không tạo được Studio.",
        }));
      } finally {
        setLoading((p) => ({ ...p, [kind]: false }));
      }
    },
    [notebookId],
  );

  return { results, loading, errors, generate, ollamaReady, hasReadySources };
}

export type StudioState = ReturnType<typeof useStudio>;
