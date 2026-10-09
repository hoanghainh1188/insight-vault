import type { ReactNode } from "react";
import type { StudioKind } from "@shared/ipc/types";
import { useT } from "../../shared/i18n/i18n-context";
import { progressText, type StudioProgressState } from "./studio-progress";

// 146 (clarify #4): dòng pha + thanh tiến độ của MỘT loại Studio. Pha đọc ⇒ xác định (i/N); pha rút gọn / viết ⇒ bất định
// (chỉ aria-valuetext). Thông báo trình đọc màn hình nằm ở StudioColumn (không để progressbar tự đọc liên tục).

interface StudioProgressProps {
  kind: StudioKind;
  progress: StudioProgressState;
  /** Đặt trên card kết quả cũ (đang Tạo lại) — gọn hơn. */
  onCard?: boolean;
  /** 149: nút cùng hàng dòng pha (Huỷ). */
  action?: ReactNode;
}

export function StudioProgress({
  kind,
  progress,
  onCard = false,
  action,
}: StudioProgressProps): JSX.Element {
  const t = useT();
  const text = progressText(progress, t);
  const determinate =
    progress.phase === "reading" &&
    progress.index !== undefined &&
    progress.total !== undefined &&
    progress.total > 0;
  const ratio = determinate
    ? Math.min(1, progress.index! / progress.total!)
    : 0;
  return (
    <div
      className={`studio-progress${onCard ? " on-card" : ""}`}
      data-testid={`studio-progress-${kind}`}
    >
      <div className="studio-progress-head">
        <p className="studio-progress-text">{text}</p>
        {action}
      </div>
      <div
        role="progressbar"
        className={`studio-progress-bar${determinate ? "" : " indeterminate"}`}
        aria-label={t.t("studio.progress.label", {
          kind: t.t(`studio.kind.${kind}`),
        })}
        aria-valuetext={text}
        {...(determinate
          ? {
              "aria-valuemin": 0,
              "aria-valuemax": progress.total,
              "aria-valuenow": progress.index,
            }
          : {})}
      >
        <span
          className="studio-progress-fill"
          style={determinate ? { transform: `scaleX(${ratio})` } : undefined}
        />
      </div>
    </div>
  );
}
