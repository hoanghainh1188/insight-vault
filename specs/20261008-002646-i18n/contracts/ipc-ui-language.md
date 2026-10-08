# Contract — kênh IPC ngôn ngữ giao diện

Ba kênh mới, khai báo ở `src/shared/ipc/channels.ts` (`CHANNELS`, `WHITELISTED_CHANNELS`, `ChannelResponse`), đăng ký bằng
`safeHandle` ở `src/main/ipc/register.ts`, expose ở `src/preload/index.ts` (contextBridge `window.api`).

```ts
export interface UiLanguageState {
  preference: "auto" | "vi" | "en";
  effective: "vi" | "en";
}
```

| Kênh                    | Hướng                              | Tham số               | Trả về            | Ghi chú                                                                                                                                                 |
| ----------------------- | ---------------------------------- | --------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app:getUiLanguage`     | renderer → main (invoke)           | —                     | `UiLanguageState` | gọi lúc `I18nProvider` mount                                                                                                                            |
| `app:setUiLanguage`     | renderer → main (invoke)           | `preference: unknown` | `UiLanguageState` | main kiểm: không thuộc `{auto,vi,en}` ⇒ ném lỗi, **không** ghi; hợp lệ ⇒ lưu `uiLanguage`, tính lại, phát sự kiện nếu `effective` hoặc `preference` đổi |
| `app:uiLanguageChanged` | main → renderer (push, mọi cửa sổ) | `UiLanguageState`     | —                 | mẫu `app:privacyChanged`; preload `onUiLanguageChanged(cb) ⇒ unsubscribe`                                                                               |

**Preload (`window.api`):**

```ts
getUiLanguage(): Promise<UiLanguageState>;
setUiLanguage(preference: "auto" | "vi" | "en"): Promise<UiLanguageState>;
onUiLanguageChanged(cb: (s: UiLanguageState) => void): () => void;
```

**Bảo mật (Constitution III):** không kênh nào nhận đường dẫn/chuỗi tự do; `setUiLanguage` chỉ nhận enum, main kiểm lại;
không log giá trị khác enum (chỉ `errorType`).

**Ghi đè kiểm thử:** biến môi trường `IV_UI_LANG=vi|en` chỉ có hiệu lực khi `!app.isPackaged`; nó thay `osLocale` (không ghi
vào store), nên `auto` ⇒ ngôn ngữ đó; người dùng vẫn đổi được qua Cài đặt trong e2e.

**Main dùng nội bộ:**

```ts
// src/main/services/ui-language/
createUiLanguageService(deps: { store: StoreLike; osLocale: () => string | undefined }): {
  get(): UiLanguageState;
  set(pref: unknown): UiLanguageState; // ném nếu không hợp lệ
  onChange(cb: (s: UiLanguageState) => void): () => void;
  translator(): Translator; // cho hộp thoại hệ thống
};
startupLanguage(osLocale: string | undefined): LanguageCode; // dùng trước khi store sẵn sàng
```
