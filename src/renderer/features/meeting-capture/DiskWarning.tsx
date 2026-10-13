import { useEffect, useRef } from "react";
import type { MeetingState } from "@shared/ipc/types";
import { announce } from "../../shared/a11y/announcer";
import { useT } from "../../shared/i18n/i18n-context";

// 186 PR C1 (T119, FR-043) — cảnh báo đĩa khi đang ghi: vàng < 30 phút, khẩn < 5 phút (main tự kết thúc khi < 1 phút —
// màn hoàn tất báo lý do). Mỗi mức chỉ đọc cho trình đọc màn hình một lần.

export function DiskWarning({
  level,
  minutes,
}: {
  level: MeetingState["diskLevel"];
  minutes: number;
}): JSX.Element | null {
  const t = useT();
  const announced = useRef<string>("ok");
  const text =
    level === "ok"
      ? null
      : t.t(`meeting.disk.${level}`, { minutes: Math.floor(minutes) });
  useEffect(() => {
    if (level !== "ok" && announced.current !== level && text) {
      announce(text, level === "urgent" ? "assertive" : "polite");
    }
    announced.current = level;
  }, [level, text]);
  if (!text) return null;
  return (
    <p
      className={level === "urgent" ? "disk-warn urgent" : "disk-warn"}
      data-testid="disk-warning"
    >
      {text}
    </p>
  );
}
