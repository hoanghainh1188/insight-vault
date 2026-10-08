import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AiTarget,
  Source,
  StudioKind,
  StudioResult,
} from "@shared/ipc/types";
import type { ParsedIpcError } from "@shared/online-error-tag";
import { toParsedError } from "../../shared/i18n/describe-error";

// Hook cột Studio: nạp kết quả đã lưu khi mở notebook (studio:list) + sinh mới theo loại (studio:generate).
// State theo TỪNG loại (results/loading/error) để 4 nút độc lập (US2). Đổi notebook → nạp lại.

export type StudioResultMap = Partial<Record<StudioKind, StudioResult>>;
export type StudioFlagMap = Partial<Record<StudioKind, boolean>>;
// 123: lưu lỗi dạng ParsedIpcError (mã) — dịch lúc render bằng describeIpcError.
export type StudioErrorMap = Partial<Record<StudioKind, ParsedIpcError>>;

export function useStudio(notebookId: string) {
  const [results, setResults] = useState<StudioResultMap>({});
  const [loading, setLoading] = useState<StudioFlagMap>({});
  const [errors, setErrors] = useState<StudioErrorMap>({});
  // 098: loại nào vừa lỗi do provider online (hiện nút "Tạo bằng AI cục bộ") / kết quả nào tạo bằng AI cục bộ (nhãn).
  const [onlineFailed, setOnlineFailed] = useState<StudioFlagMap>({});
  const [localKinds, setLocalKinds] = useState<StudioFlagMap>({});
  const [ollamaReady, setOllamaReady] = useState<boolean | null>(null);
  const [readySources, setReadySources] = useState<Source[]>([]);
  const hasReadySources = readySources.length > 0;
  // 091 (review S3): notebook hiện tại — kết quả của lượt tạo cũ về muộn sau khi chuyển notebook thì bỏ.
  const notebookRef = useRef(notebookId);

  // Trạng thái sẵn sàng (mirror useChat): model + danh sách nguồn ready (cho dropdown lọc — US2).
  const refreshReadiness = useCallback(() => {
    window.api
      .aiGetRuntimeStatus()
      .then((s) => setOllamaReady(s.ollamaReady))
      .catch(() => setOllamaReady(false));
    window.api
      .sourceListByNotebook(notebookId)
      .then((list) => setReadySources(list.filter((s) => s.status === "ready")))
      .catch(() => setReadySources([]));
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
    notebookRef.current = notebookId;
    setResults({});
    setErrors({});
    setLoading({});
    setOnlineFailed({});
    setLocalKinds({});
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
    // 091: trả true khi tạo xong (để tầng UI báo trình đọc màn hình); lỗi đã nằm ở errors[kind].
    // 098: target "local" = tạo bằng Ollama sau lỗi online (người dùng bấm).
    async (
      kind: StudioKind,
      sourceId?: string,
      target?: AiTarget,
    ): Promise<boolean> => {
      const stale = (): boolean => notebookRef.current !== notebookId;
      const local = target === "local";
      setLoading((p) => ({ ...p, [kind]: true }));
      setErrors((p) => ({ ...p, [kind]: undefined }));
      setOnlineFailed((p) => ({ ...p, [kind]: false }));
      try {
        const res = await window.api.studioGenerate({
          notebookId,
          kind,
          sourceId,
          ...(local ? { target: "local" as const } : {}),
        });
        if (stale()) return false;
        setResults((p) => ({ ...p, [kind]: res }));
        setLocalKinds((p) => ({ ...p, [kind]: local }));
        return true;
      } catch (e) {
        if (stale()) return false;
        const parsed = toParsedError(e);
        setErrors((p) => ({ ...p, [kind]: parsed }));
        setOnlineFailed((p) => ({
          ...p,
          [kind]: parsed.onlineKind !== null && !local,
        }));
        return false;
      } finally {
        if (!stale()) setLoading((p) => ({ ...p, [kind]: false }));
      }
    },
    [notebookId],
  );

  return {
    results,
    loading,
    errors,
    onlineFailed,
    localKinds,
    generate,
    ollamaReady,
    hasReadySources,
    readySources,
  };
}

export type StudioState = ReturnType<typeof useStudio>;
