import { useEffect, useState } from "react";

// 186 PR C1 (T120) — số bản ghi bị gián đoạn theo notebook (huy hiệu trang Notebooks). Làm mới khi main đẩy meeting:recoverable.

export function useRecoverableCounts(): ReadonlyMap<string, number> {
  const [counts, setCounts] = useState<ReadonlyMap<string, number>>(new Map());
  useEffect(() => {
    let alive = true;
    const load = (): void => {
      void window.api.meetingListRecoverable({}).then(
        (list) => {
          if (!alive) return;
          const next = new Map<string, number>();
          for (const s of list)
            next.set(s.notebookId, (next.get(s.notebookId) ?? 0) + 1);
          setCounts(next);
        },
        () => undefined,
      );
    };
    load();
    const off = window.api.onMeetingRecoverable(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return counts;
}
