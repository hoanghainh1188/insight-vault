import {
  useCallback,
  useEffect,
  useMemo,
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
import { useLang, useT } from "../../shared/i18n/i18n-context";
import { announce } from "../../shared/a11y/announcer";
import { studioCancelledMessage } from "../../shared/a11y/messages";
import {
  isCurrentGeneration,
  outcomeOf,
  type StudioGenerateOutcome,
} from "./studio-generation";
import {
  applyStudioProgress,
  withoutKind,
  type ActiveGenerationIds,
  type StudioProgressMap,
} from "./studio-progress";
import {
  afterDelete,
  currentVersion,
  groupVersions,
  withInserted,
  type StudioSelection,
  type StudioVersions,
} from "./studio-versions";

// Hook cột Studio: nạp kết quả đã lưu khi mở notebook (studio:list) + sinh mới theo loại (studio:generate).
// State theo TỪNG loại (versions/loading/error) để các nút độc lập (US2). Đổi notebook → nạp lại.
// 178: mỗi loại có nhiều PHIÊN BẢN (versions, mới nhất trước) + phiên bản đang xem (selected); `results` = bản đang xem.

export type StudioResultMap = Partial<Record<StudioKind, StudioResult>>;
export type StudioFlagMap = Partial<Record<StudioKind, boolean>>;
// 123: lưu lỗi dạng ParsedIpcError (mã) — dịch lúc render bằng describeIpcError.
export type StudioErrorMap = Partial<Record<StudioKind, ParsedIpcError>>;

export function useStudio(notebookId: string) {
  // 123 (FR-018): Studio tạo nội dung theo ngôn ngữ giao diện TẠI THỜI ĐIỂM bấm tạo.
  const lang = useLang();
  const [versions, setVersions] = useState<StudioVersions>({});
  const [selected, setSelected] = useState<StudioSelection>({});
  // 178: ref cho thao tác xoá (tính phiên bản kế tiếp trên state mới nhất, không closure cũ).
  const versionsRef = useRef(versions);
  versionsRef.current = versions;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const results = useMemo<StudioResultMap>(() => {
    const out: StudioResultMap = {};
    for (const k of Object.keys(versions) as StudioKind[]) {
      const v = currentVersion(versions, selected, k);
      if (v) out[k] = v;
    }
    return out;
  }, [versions, selected]);
  const [loading, setLoading] = useState<StudioFlagMap>({});
  const [errors, setErrors] = useState<StudioErrorMap>({});
  // 098: loại nào vừa lỗi do provider online (hiện nút "Tạo bằng AI cục bộ"). 178: nhãn AI cục bộ đọc từ phiên bản (`local`).
  const [onlineFailed, setOnlineFailed] = useState<StudioFlagMap>({});
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
  // 091 (review S3): notebook hiện tại (lọc sự kiện tiến độ). 149: "lượt cũ về muộn" xét theo generationId (isCurrentGeneration).
  const notebookRef = useRef(notebookId);
  // 149: loại vừa bấm Huỷ (UI tức thì "Đang huỷ…"); nguồn sự thật là kết cục của studio:generate.
  const [cancelling, setCancelling] = useState<StudioFlagMap>({});
  // 149: translator HIỆN TẠI cho câu huỷ khi rời notebook (chạy trong cleanup).
  const t = useT();
  const trRef = useRef(t);
  trRef.current = t;
  // 146: tiến độ theo loại + generationId của lượt đang chạy (sự kiện lượt khác / notebook khác bị bỏ).
  const [progress, setProgress] = useState<StudioProgressMap>({});
  const activeIds = useRef<ActiveGenerationIds>({});

  useEffect(() => {
    const off = window.api.onStudioProgress((e) =>
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
    setVersions({});
    setSelected({});
    setErrors({});
    setLoading({});
    setOnlineFailed({});
    window.api
      .studioList(notebookId)
      .then((list) => {
        if (!cancelled) setVersions(groupVersions(list));
      })
      .catch(() => {
        if (!cancelled) setVersions({});
      });
    return () => {
      cancelled = true;
      // 149 (clarify #10): rời notebook / Workspace ⇒ TỰ HUỶ mọi lượt đang chạy (không chạy ngầm) + báo trình đọc màn hình.
      const running = Object.entries(activeIds.current) as [
        StudioKind,
        string,
      ][];
      activeIds.current = {};
      setCancelling({});
      for (const [kind, id] of running) {
        void window.api.studioCancel(id, "navigate").catch(() => undefined);
        const tr = trRef.current;
        announce(studioCancelledMessage(tr.t(`studio.kind.${kind}`), tr));
      }
    };
  }, [notebookId]);

  const generate = useCallback(
    // 091 + 149: kết cục để tầng UI báo trình đọc màn hình — "done" | "failed" (lỗi ở errors[kind]) | "cancelled" | "stale".
    // 098: target "local" = tạo bằng Ollama sau lỗi online (người dùng bấm).
    async (
      kind: StudioKind,
      sourceId?: string,
      target?: AiTarget,
    ): Promise<StudioGenerateOutcome> => {
      const local = target === "local";
      // 146: mỗi lần bấm Tạo/Tạo lại/Tạo bằng AI cục bộ = một lượt mới ⇒ id mới; sự kiện của lượt trước bị bỏ.
      const generationId = crypto.randomUUID();
      // 149 (sửa race A→B→A): chỉ lượt HIỆN HÀNH của loại (theo generationId) được ghi kết quả / trạng thái.
      const current = (): boolean =>
        isCurrentGeneration(activeIds.current, kind, generationId);
      activeIds.current = { ...activeIds.current, [kind]: generationId };
      setProgress((p) => withoutKind(p, kind));
      setLoading((p) => ({ ...p, [kind]: true }));
      setErrors((p) => ({ ...p, [kind]: undefined }));
      setOnlineFailed((p) => ({ ...p, [kind]: false }));
      setCancelling((p) => withoutKind(p, kind));
      try {
        const res = await window.api.studioGenerate({
          notebookId,
          kind,
          sourceId,
          outputLanguage: lang,
          generationId,
          ...(local ? { target: "local" as const } : {}),
        });
        if (!current()) return "stale";
        // 178: phiên bản mới đứng đầu và được xem ngay (bỏ lựa chọn cũ của loại).
        setVersions((p) => withInserted(p, res));
        setSelected((p) => withoutKind(p, kind));
        return "done";
      } catch (e) {
        if (!current()) return "stale";
        const parsed = toParsedError(e);
        // 149: huỷ KHÔNG phải lỗi — không khối lỗi, không bật "Tạo bằng AI cục bộ"; kết quả cũ (nếu có) giữ nguyên.
        if (outcomeOf(parsed) === "cancelled") return "cancelled";
        setErrors((p) => ({ ...p, [kind]: parsed }));
        setOnlineFailed((p) => ({
          ...p,
          [kind]: parsed.onlineKind !== null && !local,
        }));
        return "failed";
      } finally {
        // 146 + 149: xong / lỗi / huỷ ⇒ về nghỉ — chỉ khi vẫn là lượt hiện hành của loại này.
        if (current()) {
          activeIds.current = withoutKind(activeIds.current, kind);
          setLoading((p) => ({ ...p, [kind]: false }));
          setProgress((p) => withoutKind(p, kind));
          setCancelling((p) => withoutKind(p, kind));
        }
      }
    },
    [notebookId, lang],
  );

  // 149: Huỷ lượt đang chạy của một loại (không hỏi xác nhận). Kết cục về qua generate (reject studioCancelled).
  const cancel = useCallback((kind: StudioKind): void => {
    const id = activeIds.current[kind];
    if (!id) return;
    setCancelling((p) => ({ ...p, [kind]: true }));
    void window.api.studioCancel(id, "user").catch(() => undefined);
  }, []);

  // 178: chọn phiên bản để xem.
  const select = useCallback((kind: StudioKind, id: string): void => {
    setSelected((p) => ({ ...p, [kind]: id }));
  }, []);

  // 178: xoá một phiên bản (sau khi người dùng xác nhận ở UI). Trả id phiên bản hiển thị tiếp theo (undefined ⇒ hết bản).
  // Không động tới lượt đang tạo của loại (nếu có) — lượt đó xong vẫn chèn bản mới.
  const deleteVersion = useCallback(
    async (kind: StudioKind, id: string): Promise<string | undefined> => {
      // `deleted:false` = bản không còn trong DB (đã bị dọn trần / xoá nơi khác) ⇒ vẫn gỡ khỏi UI, không để "bản ma".
      await window.api.studioDeleteVersion({ notebookId, id });
      if (notebookRef.current !== notebookId) return undefined;
      // Updater dạng hàm: không ghi đè bản vừa chèn bởi một lượt tạo xong xen giữa lúc chờ IPC (review #1).
      const sel = selectedRef.current;
      const next = afterDelete(versionsRef.current, sel, kind, id);
      setVersions((p) => afterDelete(p, sel, kind, id).versions);
      setSelected((p) => (p[kind] === id ? withoutKind(p, kind) : p));
      return next.nextId;
    },
    [notebookId],
  );

  return {
    results,
    versions,
    selected,
    select,
    deleteVersion,
    loading,
    errors,
    onlineFailed,
    progress,
    cancelling,
    generate,
    cancel,
    ollamaReady,
    hasReadySources,
    readySources,
  };
}

export type StudioState = ReturnType<typeof useStudio>;
