import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { runtimeStatusStore } from "../ai-runtime/runtime-status-store";
import type {
  AiTarget,
  Source,
  StudioKind,
  StudioResult,
} from "@shared/ipc/types";
import type { ParsedIpcError } from "@shared/online-error-tag";
import { toParsedError } from "../../shared/i18n/describe-error";
import { useLang } from "../../shared/i18n/i18n-context";
import {
  applyStudioProgress,
  type ActiveGenerationIds,
  type StudioProgressMap,
} from "./studio-progress";

// Hook cột Studio: nạp kết quả đã lưu khi mở notebook (studio:list) + sinh mới theo loại (studio:generate).
// State theo TỪNG loại (results/loading/error) để 4 nút độc lập (US2). Đổi notebook → nạp lại.

export type StudioResultMap = Partial<Record<StudioKind, StudioResult>>;
export type StudioFlagMap = Partial<Record<StudioKind, boolean>>;
// 123: lưu lỗi dạng ParsedIpcError (mã) — dịch lúc render bằng describeIpcError.
export type StudioErrorMap = Partial<Record<StudioKind, ParsedIpcError>>;

export function useStudio(notebookId: string) {
  // 123 (FR-018): Studio tạo nội dung theo ngôn ngữ giao diện TẠI THỜI ĐIỂM bấm tạo.
  const lang = useLang();
  const [results, setResults] = useState<StudioResultMap>({});
  const [loading, setLoading] = useState<StudioFlagMap>({});
  const [errors, setErrors] = useState<StudioErrorMap>({});
  // 098: loại nào vừa lỗi do provider online (hiện nút "Tạo bằng AI cục bộ") / kết quả nào tạo bằng AI cục bộ (nhãn).
  const [onlineFailed, setOnlineFailed] = useState<StudioFlagMap>({});
  const [localKinds, setLocalKinds] = useState<StudioFlagMap>({});
  // #135: trạng thái runtime dùng chung (tự kiểm tra lại khi chưa sẵn sàng; "Kiểm tra lại" ở banner cập nhật cả đây).
  const runtime = useSyncExternalStore(
    runtimeStatusStore.subscribe,
    runtimeStatusStore.getSnapshot,
  );
  const ollamaReady: boolean | null = runtime.status
    ? runtime.status.ollamaReady
    : null;
  const [readySources, setReadySources] = useState<Source[]>([]);
  const hasReadySources = readySources.length > 0;
  // 091 (review S3): notebook hiện tại — kết quả của lượt tạo cũ về muộn sau khi chuyển notebook thì bỏ.
  const notebookRef = useRef(notebookId);
  // 146: tiến độ theo loại + generationId của lượt đang chạy (sự kiện lượt khác / notebook khác bị bỏ).
  const [progress, setProgress] = useState<StudioProgressMap>({});
  const activeIds = useRef<ActiveGenerationIds>({});

  useEffect(() => {
    // Mock cũ trong test có thể thiếu kênh này — không có thì chỉ là không hiện tiến độ.
    const off = window.api.onStudioProgress?.((e) =>
      setProgress((p) =>
        applyStudioProgress(p, activeIds.current, notebookRef.current, e),
      ),
    );
    return off;
  }, []);

  // Trạng thái sẵn sàng (mirror useChat): model + danh sách nguồn ready (cho dropdown lọc — US2).
  const refreshReadiness = useCallback(() => {
    runtimeStatusStore.refresh();
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
    activeIds.current = {};
    setProgress({});
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
      // 146: mỗi lần bấm Tạo/Tạo lại/Tạo bằng AI cục bộ = một lượt mới ⇒ id mới; sự kiện của lượt trước bị bỏ.
      const generationId = crypto.randomUUID();
      activeIds.current = { ...activeIds.current, [kind]: generationId };
      setProgress((p) => ({ ...p, [kind]: undefined }));
      setLoading((p) => ({ ...p, [kind]: true }));
      setErrors((p) => ({ ...p, [kind]: undefined }));
      setOnlineFailed((p) => ({ ...p, [kind]: false }));
      try {
        const res = await window.api.studioGenerate({
          notebookId,
          kind,
          sourceId,
          outputLanguage: lang,
          generationId,
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
        // 146: xong/lỗi ⇒ xoá tiến độ — chỉ khi vẫn là lượt đang chạy của loại này.
        if (activeIds.current[kind] === generationId) {
          activeIds.current = { ...activeIds.current, [kind]: undefined };
          setProgress((p) => ({ ...p, [kind]: undefined }));
        }
      }
    },
    [notebookId, lang],
  );

  return {
    results,
    loading,
    errors,
    onlineFailed,
    localKinds,
    progress,
    generate,
    ollamaReady,
    hasReadySources,
    readySources,
  };
}

export type StudioState = ReturnType<typeof useStudio>;
