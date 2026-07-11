import type { ModelSelection } from "@shared/ipc/types";

// Lưu lựa chọn model ở electron-store (A1). Nhận StoreLike để inject store thật ở main + fake khi test.

const KEY = "ai.modelSelection";

export interface StoreLike {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

const EMPTY: ModelSelection = { chatModel: null, embeddingModel: null };

// Validate tên model ở BOUNDARY (input renderer → main → ghi đĩa). Chống ghi chuỗi khổng lồ / ký tự lạ
// vào electron-store (tự-DoS / poisoning). Ollama model name dạng `name:tag`, thực tế < 200 ký tự.
const MAX_NAME_LEN = 200;
const MODEL_NAME_RE = /^[\w][\w.:/-]{0,199}$/;

function validModelName(v: unknown): string | null {
  return typeof v === "string" &&
    v.length <= MAX_NAME_LEN &&
    MODEL_NAME_RE.test(v)
    ? v
    : null;
}

function normalize(raw: unknown): ModelSelection {
  if (raw === null || typeof raw !== "object") return { ...EMPTY };
  const r = raw as Record<string, unknown>;
  return {
    chatModel: validModelName(r["chatModel"]),
    embeddingModel: validModelName(r["embeddingModel"]),
  };
}

/** Đọc lựa chọn model. Thiếu/hỏng/không đọc được → { chatModel:null, embeddingModel:null }. */
export function getSelectedModels(store: StoreLike): ModelSelection {
  try {
    return normalize(store.get(KEY));
  } catch {
    return { ...EMPTY };
  }
}

/** Ghi lựa chọn model (idempotent). Lỗi ghi không ném xuyên IPC. Trả về lựa chọn đã chuẩn hoá. */
export function setSelectedModels(
  store: StoreLike,
  sel: ModelSelection,
): ModelSelection {
  const value = normalize(sel);
  try {
    store.set(KEY, value);
  } catch {
    // Không ném: nhất quán với getOnboardingState của app-shell.
  }
  return value;
}
