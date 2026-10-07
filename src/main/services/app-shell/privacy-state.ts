import type { PrivacyState } from "@shared/ipc/types";

// Nguồn sự thật trạng thái riêng tư (Constitution I) — badge đọc TỪ ĐÂY, không hard-code.
// 103 (ADR 2026-10-07-privacy-badge-clarify): 3 trạng thái + đẩy sự kiện khi đổi:
//   local   — không provider online, không egress
//   online  — provider AI online đang bật, KHÔNG có request đang chạy ("chỉ gửi khi bạn hỏi")
//   sending — đang có egress thật (AI online, tải URL, tải model) — ưu tiên cao nhất

const LABELS: Record<PrivacyState["mode"], string> = {
  local: "Chạy cục bộ · dữ liệu không rời máy",
  online: "AI online đang bật · chỉ gửi khi bạn hỏi",
  sending: "Đang gửi dữ liệu ra ngoài…",
};

/**
 * Loại egress — nhãn `sending` nói RÕ đang làm gì (review 103): gửi câu hỏi tới AI online khác hẳn tải mô hình
 * (không gửi dữ liệu người dùng). Ưu tiên nhãn: ai > url > model.
 */
export type EgressKind = "ai" | "url" | "model";

const SENDING_LABELS: Record<EgressKind, string> = {
  ai: "Đang gửi dữ liệu tới AI online…",
  url: "Đang tải trang web…",
  model: "Đang tải mô hình (cần Internet lần đầu)…",
};
const KIND_PRIORITY: EgressKind[] = ["ai", "url", "model"];

/** Suy ra văn bản badge từ mode (không để renderer tự ghép chuỗi rời rạc). */
export function labelForMode(mode: PrivacyState["mode"]): string {
  return LABELS[mode];
}

// Đếm số hoạt động egress đang diễn ra theo loại (refcount — nhiều hoạt động chồng nhau an toàn).
const egressDepth: Record<EgressKind, number> = { ai: 0, url: 0, model: 0 };
// Có provider AI online đang active không (031).
let onlineProviderActive = false;

type Listener = (state: PrivacyState) => void;
const listeners = new Set<Listener>();
let lastKey = "local";

/** Trạng thái riêng tư hiện tại: sending > online > local. */
export function getPrivacyState(): PrivacyState {
  const active = KIND_PRIORITY.find((k) => egressDepth[k] > 0);
  if (active) return { mode: "sending", label: SENDING_LABELS[active] };
  const mode: PrivacyState["mode"] = onlineProviderActive ? "online" : "local";
  return { mode, label: labelForMode(mode) };
}

/**
 * Gọi listener CHỈ khi trạng thái hiển thị (mode + nhãn) đổi — không spam theo từng request. Listener lỗi (vd cửa
 * sổ vừa huỷ) KHÔNG được làm hỏng luồng nghiệp vụ gọi setEgressActive, cũng không chặn listener khác.
 */
function notifyIfChanged(): void {
  const state = getPrivacyState();
  const key = `${state.mode}|${state.label}`;
  if (key === lastKey) return;
  lastKey = key;
  for (const l of listeners) {
    try {
      l(state);
    } catch {
      /* chỉ báo không được làm hỏng nghiệp vụ; lần đổi sau sẽ đẩy lại trạng thái đầy đủ */
    }
  }
}

/** Đăng ký nhận trạng thái mới mỗi khi mode đổi (main đẩy tới renderer). Trả hàm huỷ. */
export function onPrivacyChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Bật/tắt egress theo loại (AI online / tải URL / tải model). Refcount, không âm. */
export function setEgressActive(
  active: boolean,
  kind: EgressKind = "ai",
): void {
  egressDepth[kind] = active
    ? egressDepth[kind] + 1
    : Math.max(0, egressDepth[kind] - 1);
  notifyIfChanged();
}

/** Đặt cờ có provider AI online đang active (031). */
export function setOnlineProviderActive(active: boolean): void {
  onlineProviderActive = active;
  notifyIfChanged();
}

/** Chạy fn trong khoảng egress — luôn trả badge về kể cả khi ném lỗi. */
export async function withEgress<T>(
  fn: () => Promise<T>,
  kind: EgressKind = "ai",
): Promise<T> {
  setEgressActive(true, kind);
  try {
    return await fn();
  } finally {
    setEgressActive(false, kind);
  }
}
