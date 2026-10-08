import { useCallback, useState } from "react";

// Độ rộng 2 cột biên của Workspace (Nguồn + Studio); cột Chat co giãn (1fr). Lưu localStorage toàn cục
// (025-workspace-enhance). clampWidths/parseWidths THUẦN — unit-test. Kéo bằng pointer events.

export interface ColWidths {
  src: number;
  studio: number;
}

const KEY = "workspace-col-widths";
const DEFAULT: ColWidths = { src: 300, studio: 260 };
const SRC_MIN = 220;
const SRC_MAX = 460;
const STUDIO_MIN = 200;
const STUDIO_MAX = 420;

/** Giới hạn độ rộng vào [min,max] mỗi cột (THUẦN). */
export function clampWidths(w: ColWidths): ColWidths {
  return {
    src: Math.min(SRC_MAX, Math.max(SRC_MIN, Math.round(w.src))),
    studio: Math.min(STUDIO_MAX, Math.max(STUDIO_MIN, Math.round(w.studio))),
  };
}

/** #128: Chat phải còn ít nhất chừng này (ô nhập, chọn chế độ, nút gửi không bị bóp). */
export const CHAT_MIN_WIDTH = 320;
const SPLITTERS = 10; // 2 splitter × 5px

/**
 * Độ rộng HIỂN THỊ theo chỗ trống thật của Workspace (THUẦN): đủ chỗ ⇒ giữ nguyên; thiếu ⇒ co Nguồn + Studio theo tỉ lệ
 * phần dư trên mức tối thiểu để Chat còn CHAT_MIN_WIDTH; không co dưới mức tối thiểu mỗi cột. available ≤ 0 (chưa
 * đo) ⇒ giữ nguyên. Không đổi độ rộng người dùng đã lưu — cửa sổ rộng lại thì trở về như cũ.
 */
export function fitWidths(w: ColWidths, available: number): ColWidths {
  if (available <= 0) return w;
  const room = available - SPLITTERS - CHAT_MIN_WIDTH;
  const excess = w.src + w.studio - room;
  if (excess <= 0) return w;
  const slackSrc = Math.max(0, w.src - SRC_MIN);
  const slackStudio = Math.max(0, w.studio - STUDIO_MIN);
  const slack = slackSrc + slackStudio;
  if (excess >= slack) return { src: SRC_MIN, studio: STUDIO_MIN };
  const cutSrc = Math.ceil((excess * slackSrc) / slack);
  return { src: w.src - cutSrc, studio: w.studio - (excess - cutSrc) };
}

/** Parse localStorage an toàn → clamp; thiếu/hỏng → mặc định (THUẦN). */
export function parseWidths(raw: string | null): ColWidths {
  if (!raw) return { ...DEFAULT };
  try {
    const v = JSON.parse(raw) as Partial<ColWidths>;
    if (typeof v?.src === "number" && typeof v?.studio === "number") {
      return clampWidths({ src: v.src, studio: v.studio });
    }
  } catch {
    // hỏng → mặc định
  }
  return { ...DEFAULT };
}

export function useColumnWidths() {
  const [widths, setWidths] = useState<ColWidths>(() =>
    parseWidths(
      typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null,
    ),
  );

  const startDrag = useCallback(
    (col: keyof ColWidths, sign: 1 | -1) =>
      (e: React.PointerEvent): void => {
        e.preventDefault();
        const startX = e.clientX;
        const startW = widths[col];
        const onMove = (ev: PointerEvent): void => {
          const next = clampWidths({
            ...widths,
            [col]: startW + sign * (ev.clientX - startX),
          });
          setWidths(next);
        };
        const onUp = (): void => {
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          setWidths((w) => {
            localStorage.setItem(KEY, JSON.stringify(w));
            return w;
          });
        };
        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
      },
    [widths],
  );

  // Splitter Nguồn|Chat: kéo phải → Nguồn rộng ra (sign +1).
  // Splitter Chat|Studio: kéo phải → Studio hẹp lại (sign -1).
  return {
    widths,
    onDragSrc: startDrag("src", 1),
    onDragStudio: startDrag("studio", -1),
  };
}
