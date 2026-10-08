import { describe, it, expect } from "vitest";
import { CHANNELS, isWhitelisted } from "../../src/shared/ipc/channels";

// 123 (FR-007, contracts/ipc-ui-language.md): 2 kênh invoke whitelisted + 1 kênh push; không kênh tự do.

describe("ui-language IPC whitelist", () => {
  it("kênh đọc/đặt ngôn ngữ whitelisted; sự kiện đổi có tên cố định", () => {
    expect(CHANNELS.getUiLanguage).toBe("app:getUiLanguage");
    expect(CHANNELS.setUiLanguage).toBe("app:setUiLanguage");
    expect(CHANNELS.uiLanguageChanged).toBe("app:uiLanguageChanged");
    expect(isWhitelisted("app:getUiLanguage")).toBe(true);
    expect(isWhitelisted("app:setUiLanguage")).toBe(true);
  });

  it("không có kênh nạp tệp dịch / đặt locale tuỳ ý", () => {
    expect(isWhitelisted("app:loadLocale")).toBe(false);
    expect(isWhitelisted("app:setLocale")).toBe(false);
  });
});
