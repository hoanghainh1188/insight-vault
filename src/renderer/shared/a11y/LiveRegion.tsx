import { useEffect, useState } from "react";
import { announcer, type Politeness } from "./announcer";

/** Xoá rồi mới đặt câu mới sau chừng này ms — trình đọc màn hình chỉ đọc khi nội dung vùng live THAY ĐỔI. */
const RESET_MS = 50;
/** Giữ mỗi câu tối thiểu chừng này trước khi sang câu kế (nạp nhiều nguồn cùng lúc ⇒ không nuốt câu). */
const HOLD_MS = 500;
/** Xoá câu cuối sau chừng này ms — không bị đọc lại khi người dùng duyệt trang bằng con trỏ ảo. */
const CLEAR_MS = 7000;
/** Hàng đợi tối đa mỗi mức; dồn quá thì bỏ câu cũ nhất (giữ câu mới — phản ánh trạng thái hiện tại). */
const MAX_QUEUE = 10;

const LEVELS: Politeness[] = ["polite", "assertive"];

// 091 — vùng aria-live ẩn khỏi màn hình (gắn 1 lần ở vỏ app). Tách polite (mốc thường) và assertive (lỗi cần
// biết ngay), mỗi mức 1 hàng đợi riêng. aria-atomic: đọc trọn câu thay vì phần chữ vừa đổi.
export function LiveRegion(): JSX.Element {
  const [text, setText] = useState<Record<Politeness, string>>({
    polite: "",
    assertive: "",
  });

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number): void => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    const set = (p: Politeness, v: string): void =>
      setText((prev) => ({ ...prev, [p]: v }));

    const queues = Object.fromEntries(
      LEVELS.map((p) => [p, [] as string[]]),
    ) as Record<Politeness, string[]>;
    const busy: Record<Politeness, boolean> = {
      polite: false,
      assertive: false,
    };
    // Mỗi lần hiện câu mới tăng thế hệ ⇒ hẹn xoá của câu cũ không xoá nhầm câu mới.
    const gen: Record<Politeness, number> = { polite: 0, assertive: 0 };

    const pump = (p: Politeness): void => {
      const next = queues[p].shift();
      if (next === undefined) {
        busy[p] = false;
        const g = gen[p];
        later(() => {
          if (gen[p] === g) set(p, "");
        }, CLEAR_MS);
        return;
      }
      busy[p] = true;
      gen[p] += 1;
      set(p, "");
      later(() => {
        set(p, next);
        later(() => pump(p), HOLD_MS);
      }, RESET_MS);
    };

    const off = announcer.subscribe(({ message, politeness }) => {
      const q = queues[politeness];
      q.push(message);
      if (q.length > MAX_QUEUE) q.shift();
      if (!busy[politeness]) pump(politeness);
    });
    return () => {
      off();
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  return (
    <>
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        data-testid="live-polite"
      >
        {text.polite}
      </div>
      <div
        className="sr-only"
        aria-live="assertive"
        aria-atomic="true"
        data-testid="live-assertive"
      >
        {text.assertive}
      </div>
    </>
  );
}
