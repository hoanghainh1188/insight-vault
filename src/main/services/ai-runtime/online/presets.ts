import type { OnlineProviderId } from "@shared/ipc/types";

// Preset model + nhãn cho 3 provider online (031). Người dùng chọn từ preset HOẶC nhập tay ("Khác").
// Tên model đổi nhanh theo thời gian → preset chỉ là gợi ý, luôn có đường nhập tay ở UI.

export const ONLINE_PROVIDER_IDS: readonly OnlineProviderId[] = [
  "anthropic",
  "gemini",
  "openai",
];

export const PROVIDER_LABELS: Record<OnlineProviderId, string> = {
  anthropic: "Claude (Anthropic)",
  gemini: "Google (Gemini)",
  openai: "OpenAI",
};

export const MODEL_PRESETS: Record<OnlineProviderId, string[]> = {
  anthropic: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"],
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash"],
  openai: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
};

/** Kiểm 1 chuỗi có phải provider id hợp lệ (dùng validate boundary IPC). */
export function isOnlineProviderId(v: unknown): v is OnlineProviderId {
  return (
    typeof v === "string" &&
    (ONLINE_PROVIDER_IDS as readonly string[]).includes(v)
  );
}
