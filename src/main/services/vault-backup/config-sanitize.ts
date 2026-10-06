// Lọc cấu hình electron-store trong bản sao lưu (085, security S1). config.json từ file người dùng chọn là dữ liệu
// KHÔNG tin cậy: chỉ giữ khoá đã biết (allowlist) và khi KHÔI PHỤC luôn TẮT provider online — bản sao lưu (kể cả
// bản thật từ máy khác) không được tự bật egress (Constitution I). Giá trị bên trong ai.* còn được normalize lại
// ở tầng đọc (model-selection / online-config) như mọi lần đọc store.

export interface SanitizeOptions {
  /** true ⇒ đặt ai.onlineConfig.activeOnlineId = null. */
  restoring: boolean;
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj =>
  !!v && typeof v === "object" && !Array.isArray(v);

export function sanitizeConfig(raw: unknown, opts: SanitizeOptions): Obj {
  if (!isObj(raw)) return {};
  const out: Obj = {};

  if (typeof raw.onboardingComplete === "boolean") {
    out.onboardingComplete = raw.onboardingComplete;
  }
  if (typeof raw.embeddingModelVersion === "string") {
    out.embeddingModelVersion = raw.embeddingModelVersion.slice(0, 128);
  }

  if (isObj(raw.ai)) {
    const ai: Obj = {};
    if (isObj(raw.ai.modelSelection)) ai.modelSelection = raw.ai.modelSelection;
    if (isObj(raw.ai.onlineConfig)) {
      ai.onlineConfig = opts.restoring
        ? { ...raw.ai.onlineConfig, activeOnlineId: null }
        : raw.ai.onlineConfig;
    }
    if (Object.keys(ai).length > 0) out.ai = ai;
  }
  return out;
}
