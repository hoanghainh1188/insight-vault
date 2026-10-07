import type { SourceProgressEvent, SourceStatus } from "@shared/ipc/types";

// 091 — câu thông báo trình đọc màn hình (thuần, tiếng Việt). Mỗi hàm trả null khi KHÔNG nên báo (trạng thái
// không đổi) — tránh lặp lại liên tục theo từng sự kiện tiến độ.

export const CHAT_STARTED = "Đang soạn câu trả lời…";
export const CHAT_CANCELLED =
  "Đã huỷ câu trả lời đang soạn vì chuyển notebook.";

export interface ChatDoneInput {
  citationCount: number;
  notFound?: boolean;
  stopped?: boolean;
}

export function chatDoneMessage({
  citationCount,
  notFound,
  stopped,
}: ChatDoneInput): string {
  if (stopped) return "Đã dừng. Giữ phần câu trả lời đã nhận.";
  // 108: câu thông báo ngắn cho trình đọc màn hình — CỐ Ý không kèm gợi ý (gợi ý nằm trong câu trả lời hiển thị).
  if (notFound) return "Không tìm thấy thông tin trong nguồn.";
  return citationCount > 0
    ? `Đã có câu trả lời, ${citationCount} trích dẫn.`
    : "Đã có câu trả lời.";
}

export function sourceStatusMessage(
  prev: SourceStatus | undefined,
  event: Pick<SourceProgressEvent, "status" | "errorLabel">,
  title: string | undefined,
): string | null {
  if (prev === event.status) return null;
  const name = title ? `nguồn “${title}”` : "nguồn";
  const Name = title ? `Nguồn “${title}”` : "Nguồn";
  switch (event.status) {
    case "processing":
      return `Đang xử lý ${name}.`;
    case "awaiting_embedding":
      return `${Name} đang chờ nhúng.`;
    case "ready":
      return `${Name} đã sẵn sàng.`;
    case "error":
      return `${Name} lỗi: ${event.errorLabel ?? "không xử lý được"}.`;
    default:
      return null; // queued: chưa có gì để báo
  }
}

/** prev=null: chưa biết trạng thái trước (lần đọc đầu). */
export function reindexMessage(
  prev: boolean | null,
  next: boolean,
): string | null {
  if (next && prev !== true) return "Đang tái lập chỉ mục nguồn…";
  if (!next && prev === true) return "Đã tái lập chỉ mục nguồn xong.";
  return null;
}

export function studioMessage(label: string, phase: "start" | "done"): string {
  return phase === "start" ? `Đang tạo ${label}…` : `Đã tạo xong ${label}.`;
}

/** aria-valuetext cho thanh tiến độ: "Nhúng, 40%". */
export function progressValueText(step: string, pct: number): string {
  return `${step}, ${pct}%`;
}
