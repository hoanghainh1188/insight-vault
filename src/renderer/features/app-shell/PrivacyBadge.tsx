import { useEffect, useState } from "react";
import type { PrivacyState } from "@shared/ipc/types";

// Badge đọc trạng thái TỪ main (getPrivacyState) — động, không hard-code (FR-002).
export function PrivacyBadge(): JSX.Element {
  const [state, setState] = useState<PrivacyState | null>(null);

  useEffect(() => {
    let alive = true;
    window.api
      .getPrivacyState()
      .then((s) => {
        if (alive) setState(s);
      })
      .catch(() => {
        // IPC lỗi bất thường: giữ trạng thái an toàn nhất (local) thay vì kẹt/loang.
        if (alive) setState({ mode: "local", label: "Chạy cục bộ" });
      });
    return () => {
      alive = false;
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
