// 186 PR C2 (R18) — câu đang phát theo thời gian player: chỉ số span CUỐI CÙNG đã bắt đầu (tStart ≤ t); trong khoảng lặng giữa
// hai câu vẫn giữ câu trước (không nhấp nháy). Trước câu đầu / dữ liệu xấu ⇒ -1. `spans` sắp theo tStart. THUẦN, tìm nhị phân.

export function spanAtTime(
  spans: readonly { tStart: number }[],
  t: number,
): number {
  if (!Number.isFinite(t)) return -1;
  let lo = 0;
  let hi = spans.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((spans[mid]?.tStart ?? Infinity) <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}
