import { useEffect, useState } from "react";
import type { PrivacyState } from "@shared/ipc/types";
import { PRIVACY_CHANGED_EVENT } from "../ai-runtime/useOnlineProviders";

// Badge đọc trạng thái TỪ main (getPrivacyState) — động, không hard-code (FR-002). Nạp lại khi bật/tắt
// provider online (031) qua sự kiện PRIVACY_CHANGED_EVENT.
export function PrivacyBadge(): JSX.Element {
  const [state, setState] = useState<PrivacyState | null>(null);

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
          if (alive) setState({ mode: "local", label: "Chạy cục bộ" });
        });
    };
    refresh();
    window.addEventListener(PRIVACY_CHANGED_EVENT, refresh);
    return () => {
      alive = false;
      window.removeEventListener(PRIVACY_CHANGED_EVENT, refresh);
    };
  }, []);

  const online = state?.mode === "online";
  return (
    <span
      className={`privacy-badge${online ? " online" : ""}`}
      data-testid="privacy-badge"
    >
      <span className="dot" />
      {state?.label ?? "Đang kiểm tra trạng thái…"}
    </span>
  );
}
