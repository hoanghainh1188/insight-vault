import type { OnlineProviderId } from "@shared/ipc/types";
import type { StoreLike } from "../model-selection";
import { isOnlineProviderId, ONLINE_PROVIDER_IDS } from "./presets";

// Cấu hình khu vực AI online, lưu electron-store (031). CHỈ chứa: provider online đang active + model đã
// chọn mỗi provider. KHÔNG chứa API key (key ở keytar). Validate ở boundary như model-selection.ts.

const KEY = "ai.onlineConfig";

export interface OnlineConfig {
  activeOnlineId: OnlineProviderId | null;
  models: Record<OnlineProviderId, string | null>;
}

const EMPTY: OnlineConfig = {
  activeOnlineId: null,
  models: { anthropic: null, gemini: null, openai: null },
};

// Tên model online có thể chứa số/./-/: (VD "claude-opus-4-5", "gpt-4o", "gemini-2.5-pro"). Validate độ dài
// + ký tự ở boundary (chống ghi chuỗi rác vào store). Tái dùng ý tưởng model-selection.
const MAX_NAME_LEN = 200;
const MODEL_NAME_RE = /^[\w][\w.:/-]{0,199}$/;

export function validOnlineModel(v: unknown): string | null {
  return typeof v === "string" &&
    v.length <= MAX_NAME_LEN &&
    MODEL_NAME_RE.test(v)
    ? v
    : null;
}

function normalize(raw: unknown): OnlineConfig {
  if (raw === null || typeof raw !== "object") return clone(EMPTY);
  const r = raw as Record<string, unknown>;
  const activeOnlineId = isOnlineProviderId(r["activeOnlineId"])
    ? r["activeOnlineId"]
    : null;
  const rawModels =
    r["models"] && typeof r["models"] === "object"
      ? (r["models"] as Record<string, unknown>)
      : {};
  const models = { ...EMPTY.models };
  for (const id of ONLINE_PROVIDER_IDS) {
    models[id] = validOnlineModel(rawModels[id]);
  }
  return { activeOnlineId, models };
}

function clone(c: OnlineConfig): OnlineConfig {
  return { activeOnlineId: c.activeOnlineId, models: { ...c.models } };
}

/** Đọc config online. Thiếu/hỏng → default (activeOnlineId=null → local). */
export function getOnlineConfig(store: StoreLike): OnlineConfig {
  try {
    return normalize(store.get(KEY));
  } catch {
    return clone(EMPTY);
  }
}

/** Ghi config đã chuẩn hoá. Lỗi ghi không ném xuyên IPC. */
export function setOnlineConfig(
  store: StoreLike,
  config: OnlineConfig,
): OnlineConfig {
  const value = normalize(config);
  try {
    store.set(KEY, value);
  } catch {
    // không ném — nhất quán model-selection.
  }
  return value;
}
