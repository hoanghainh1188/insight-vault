import { useEffect, useSyncExternalStore } from "react";
import type { RuntimeStatus } from "@shared/ipc/types";
import { runtimeStatusStore } from "./runtime-status-store";

// Đọc trạng thái runtime AI từ kho dùng chung (#135): banner, Cài đặt, Chat, Studio thấy cùng một trạng thái; khi
// chưa sẵn sàng kho tự kiểm tra lại. Mount ⇒ kiểm tra ngay (mở Cài đặt / banner). refresh() = "Kiểm tra lại".
// 123: IPC lỗi ⇒ readFailed=true + reason=null (nơi hiển thị dịch "ai.runtime.statusUnreadable" lúc render).
export function useRuntimeStatus(): {
  status: RuntimeStatus | null;
  readFailed: boolean;
  loading: boolean;
  refresh: () => void;
} {
  const snap = useSyncExternalStore(
    runtimeStatusStore.subscribe,
    runtimeStatusStore.getSnapshot,
  );
  useEffect(() => {
    runtimeStatusStore.refresh();
  }, []);
  return { ...snap, refresh: runtimeStatusStore.refresh };
}
