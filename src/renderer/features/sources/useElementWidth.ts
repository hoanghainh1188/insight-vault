import { useEffect, useState, type RefObject } from "react";

// #128: độ rộng thật của một phần tử (ResizeObserver) — Workspace dùng để co cột biên khi cửa sổ hẹp.
// Không có ResizeObserver (môi trường test) ⇒ 0 = "chưa đo", nơi dùng giữ nguyên độ rộng.
export function useElementWidth(ref: RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}
