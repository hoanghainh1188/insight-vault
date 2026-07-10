import type { OnboardingState } from "@shared/ipc/types";

// Cờ onboarding lưu ở OS settings store (clarify A5). Nhận StoreLike để inject electron-store thật
// ở main, và fake store khi unit test (không cần Electron).

const KEY = "onboardingComplete";

export interface StoreLike {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

/** Đọc trạng thái onboarding. Thiếu/lỗi/không phải boolean ⇒ completed:false (coi là lần đầu — FR-008). */
export function getOnboardingState(store: StoreLike): OnboardingState {
  try {
    const raw = store.get(KEY);
    return { completed: raw === true };
  } catch {
    return { completed: false };
  }
}

/**
 * Đánh dấu onboarding hoàn tất (idempotent). Ghi lỗi (đĩa đầy/quyền) không được ném xuyên IPC
 * lên renderer — nuốt lỗi ở đây, renderer vẫn đóng overlay bình thường (nhất quán với getOnboardingState).
 */
export function setOnboardingComplete(store: StoreLike): { completed: true } {
  try {
    store.set(KEY, true);
  } catch {
    // Không ném: lần mở sau onboarding có thể hiện lại, nhưng app không kẹt/không crash.
  }
  return { completed: true };
}
