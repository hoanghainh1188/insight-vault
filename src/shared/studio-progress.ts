import type { StudioProgressPhase } from "./ipc/types";

// 146: dùng chung main (kiểm id trước khi phát) + renderer (thứ tự pha để bỏ sự kiện lùi). Hàm thuần.

/** Pha theo thứ tự tăng dần. */
export const STUDIO_PROGRESS_PHASES: readonly StudioProgressPhase[] = [
  "reading",
  "condensing",
  "writing",
];

const GENERATION_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Định danh lượt tạo hợp lệ: chuỗi chữ/số/`_`/`-`, 1–64 ký tự (vd UUID). */
export function isValidGenerationId(v: unknown): v is string {
  return typeof v === "string" && GENERATION_ID.test(v);
}
