import { useEffect, useState } from "react";
import type { RerankerStatus } from "@shared/ipc/types";

// 109 (FR-016): trạng thái bộ chấm độ liên quan cho Cài đặt. Đọc khi mở; còn "chưa tải"/"đang tải" ⇒ đọc lại mỗi 3 s tới khi
// xong; "lỗi" ⇒ đọc lại thưa (30 s) vì main sẽ tự thử lại (chỉ đọc qua IPC — main tự tải nền). IPC lỗi ⇒ null (ẩn dòng).
const POLL_MS = 3000;
const ERROR_POLL_MS = 30_000;

export function useRerankerStatus(): RerankerStatus | null {
  const [status, setStatus] = useState<RerankerStatus | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = (): void => {
      window.api
        .getRerankerStatus()
        .then((s) => {
          if (!alive) return;
          setStatus(s);
          if (s === "idle" || s === "downloading") {
            timer = setTimeout(read, POLL_MS);
          } else if (s === "error") {
            timer = setTimeout(read, ERROR_POLL_MS);
          }
        })
        .catch(() => {
          if (alive) setStatus(null);
        });
    };
    read();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  return status;
}
