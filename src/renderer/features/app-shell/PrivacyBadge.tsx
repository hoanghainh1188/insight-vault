import { useEffect, useState } from "react";
import type { PrivacyState } from "@shared/ipc/types";
import { PRIVACY_CHANGED_EVENT } from "../ai-runtime/useOnlineProviders";
import { useT } from "../../shared/i18n/i18n-context";

// Badge đọc trạng thái TỪ main (getPrivacyState) — động, không hard-code (FR-002). 103: cập nhật TỨC THÌ theo sự
// kiện main đẩy (onPrivacyChanged) mỗi khi mode đổi — gồm lúc đang gửi dữ liệu ra ngoài (Constitution I). Vẫn nghe
// PRIVACY_CHANGED_EVENT (031) để nạp lại ngay sau khi người dùng bật/tắt provider.
// 123: IPC lỗi ⇒ lưu cờ "fallback" (không lưu chuỗi đã dịch); nhãn dịch lúc render.
export function PrivacyBadge(): JSX.Element {
  const t = useT();
  const [state, setState] = useState<PrivacyState | "fallback" | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = (): void => {
      window.api
        .getPrivacyState()
        .then((s) => {
          if (alive) setState(s);
        })
        .catch(() => {
          // IPC lỗi bất thường: giữ trạng thái an toàn nhất (local) thay vì kẹt/loang.
          if (alive) setState("fallback");
        });
    };
    refresh();
    window.addEventListener(PRIVACY_CHANGED_EVENT, refresh);
    const off = window.api.onPrivacyChanged((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
      window.removeEventListener(PRIVACY_CHANGED_EVENT, refresh);
      off();
    };
  }, []);

  const mode = state && state !== "fallback" ? state.mode : "local";
  const label =
    state === null
      ? t.t("app.privacy.checking")
      : state === "fallback"
        ? t.t("app.privacy.local")
        : state.label;
  return (
    <span
      className={`privacy-badge${mode === "local" ? "" : ` ${mode}`}`}
      data-testid="privacy-badge"
    >
      <span className="dot" />
      {label}
    </span>
  );
}
