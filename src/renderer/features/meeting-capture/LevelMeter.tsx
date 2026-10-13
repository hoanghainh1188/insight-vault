import { useEffect, useRef, useState } from "react";
import { useT } from "../../shared/i18n/i18n-context";
import { subscribeLevel } from "./level-bus";
import { INITIAL_LEVEL, nextLevel, type LevelKind } from "./level";

// 186 PR B (FR-024) — chỉ báo âm lượng micro: thanh (cập nhật trực tiếp style, không render lại React mỗi 100 ms) + nhãn chữ
// 3 trạng thái có trễ (không nhấp nháy). Không là live region: trình đọc màn hình chỉ đọc khi người dùng tới nó.

/** dBFS ⇒ 0..1 cho thanh (−60 dB = rỗng). */
const toFill = (db: number): number =>
  Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 60) / 60)) : 0;

export function LevelMeter({ active }: { active: boolean }): JSX.Element {
  const t = useT();
  const [kind, setKind] = useState<LevelKind>("ok");
  const tracker = useRef(INITIAL_LEVEL);
  const fill = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!active) {
      if (fill.current) fill.current.style.transform = "scaleX(0)";
      return;
    }
    return subscribeLevel((m) => {
      if (fill.current)
        fill.current.style.transform = `scaleX(${toFill(m.rmsDbfs)})`;
      const next = nextLevel(tracker.current, m, performance.now());
      tracker.current = next;
      setKind((k) => (k === next.state ? k : next.state));
    });
  }, [active]);

  const label = t.t(`meeting.level.${kind}`);
  return (
    <p
      className="rec-level"
      data-level={active ? kind : "off"}
      aria-label={`${t.t("meeting.level.label")}: ${label}`}
      data-testid="recording-level"
    >
      <span className="rec-level-track" aria-hidden="true">
        <span ref={fill} className="rec-level-fill" />
      </span>
      {active && (
        <span className="rec-level-text" aria-hidden="true">
          {label}
        </span>
      )}
    </p>
  );
}
