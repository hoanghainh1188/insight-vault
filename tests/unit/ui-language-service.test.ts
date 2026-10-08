import { describe, it, expect, vi } from "vitest";
import {
  createUiLanguageService,
  startupLanguage,
  UI_LANGUAGE_KEY,
} from "../../src/main/services/ui-language";

// 123 (FR-002, FR-004, FR-005, FR-007; contracts/ipc-ui-language.md): lưu lựa chọn, tính ngôn ngữ hiệu lực, phát đổi.

function memStore(init: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(init));
  return {
    data,
    get: (k: string) => data.get(k),
    set: vi.fn((k: string, v: unknown) => void data.set(k, v)),
  };
}

const make = (
  store = memStore(),
  over: Partial<Parameters<typeof createUiLanguageService>[0]> = {},
) =>
  createUiLanguageService({
    store,
    osLocale: () => "en-US",
    envOverride: undefined,
    isPackaged: true,
    ...over,
  });

describe("ui-language service", () => {
  it("store trống ⇒ auto, hiệu lực theo locale OS", () => {
    expect(make().get()).toEqual({ preference: "auto", effective: "en" });
    expect(make(memStore(), { osLocale: () => "vi-VN" }).get()).toEqual({
      preference: "auto",
      effective: "vi",
    });
  });

  it("set hợp lệ ⇒ lưu khoá uiLanguage, phát onChange đúng 1 lần; lặp lại không phát", () => {
    const store = memStore();
    const svc = make(store);
    const cb = vi.fn();
    svc.onChange(cb);
    expect(svc.set("vi")).toEqual({ preference: "vi", effective: "vi" });
    expect(store.data.get(UI_LANGUAGE_KEY)).toBe("vi");
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ preference: "vi", effective: "vi" });
    svc.set("vi");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("đổi preference mà effective giữ nguyên vẫn phát (Cài đặt cần hiển thị lựa chọn mới)", () => {
    const svc = make(); // OS en
    const cb = vi.fn();
    svc.onChange(cb);
    svc.set("en");
    expect(cb).toHaveBeenCalledWith({ preference: "en", effective: "en" });
  });

  it("set không hợp lệ ⇒ ném, không ghi, không phát", () => {
    const store = memStore();
    const svc = make(store);
    const cb = vi.fn();
    svc.onChange(cb);
    for (const bad of ["fr", 1, null, {}, "EN"]) {
      expect(() => svc.set(bad)).toThrow();
    }
    expect(store.set).not.toHaveBeenCalled();
    expect(cb).not.toHaveBeenCalled();
  });

  it("giá trị hỏng trong store ⇒ auto; store.get ném ⇒ auto", () => {
    expect(
      make(memStore({ [UI_LANGUAGE_KEY]: "klingon" })).get().preference,
    ).toBe("auto");
    const throwing = {
      get: () => {
        throw new Error("io");
      },
      set: vi.fn(),
    };
    expect(make(throwing as never).get()).toEqual({
      preference: "auto",
      effective: "en",
    });
  });

  it("store.set ném ⇒ vẫn áp dụng trong phiên (không crash)", () => {
    const store = {
      get: () => undefined,
      set: () => {
        throw new Error("disk full");
      },
    };
    const svc = make(store as never);
    expect(svc.set("vi")).toEqual({ preference: "vi", effective: "vi" });
    expect(svc.get().effective).toBe("vi");
  });

  it("IV_UI_LANG ghi đè locale OS chỉ khi chưa đóng gói", () => {
    expect(
      make(memStore(), { envOverride: "vi", isPackaged: false }).get()
        .effective,
    ).toBe("vi");
    expect(
      make(memStore(), { envOverride: "vi", isPackaged: true }).get().effective,
    ).toBe("en");
    // preference cố định vẫn thắng ghi đè (người dùng đổi được trong e2e)
    expect(
      make(memStore({ [UI_LANGUAGE_KEY]: "en" }), {
        envOverride: "vi",
        isPackaged: false,
      }).get(),
    ).toEqual({ preference: "en", effective: "en" });
  });

  it("translator() theo ngôn ngữ hiệu lực hiện tại", () => {
    const svc = make();
    expect(svc.translator().t("settings.title")).toBe("Settings");
    svc.set("vi");
    expect(svc.translator().t("settings.title")).toBe("Cài đặt");
  });

  it("onChange trả hàm huỷ", () => {
    const svc = make();
    const cb = vi.fn();
    const off = svc.onChange(cb);
    off();
    svc.set("vi");
    expect(cb).not.toHaveBeenCalled();
  });

  it("startupLanguage dò thẳng locale OS (store chưa sẵn)", () => {
    expect(startupLanguage("vi-VN")).toBe("vi");
    expect(startupLanguage("fr-FR")).toBe("en");
    expect(startupLanguage(undefined)).toBe("en");
  });
});
