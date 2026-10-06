import { createRequire } from "node:module";
import { logEvent } from "../../../logging";
import type { KeytarLike } from "./secret-store";

// keytar là native module (N-API → ABI ổn định qua Node/Electron, KHÔNG cần rebuild). Nhưng trên môi trường
// thiếu backend keychain (Linux không có libsecret, CI headless) `require` có thể NÉM → sẽ crash app lúc
// khởi động (ai-runtime khởi tạo ngay). Nạp PHÒNG THỦ: lỗi → fallback no-op (không có key online, app vẫn
// chạy local-first bình thường). KHÔNG log nội dung key.

const noopKeytar: KeytarLike = {
  async getPassword() {
    return null;
  },
  async setPassword() {
    /* no-op: keychain không khả dụng */
  },
  async deletePassword() {
    return false;
  },
};

export function loadKeytar(): KeytarLike {
  try {
    const require = createRequire(import.meta.url);
    return require("keytar") as KeytarLike;
  } catch (e) {
    // 088: không log e.message (require stack chứa đường dẫn tuyệt đối/tên tài khoản) — chỉ loại lỗi + code.
    logEvent("ai.keytar.unavailable", {
      errorType: e instanceof Error ? e.constructor.name : typeof e,
      code: (e as { code?: unknown } | null)?.code ?? null,
    });
    return noopKeytar;
  }
}
