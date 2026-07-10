import { useEffect, useState } from "react";
import type { AppInfo } from "@shared/ipc/types";
import { PrivacyBadge } from "./PrivacyBadge";

// Header in-app (dưới khung native OS — clarify A3): tên app + privacy badge.
export function AppHeader(): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    let alive = true;
    window.api
      .getAppInfo()
      .then((i) => {
        if (alive) setInfo(i);
      })
      .catch(() => {
        // Giữ fallback tên app mặc định trong render (không kẹt, không unhandled rejection).
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <header className="app-header">
      <span className="app-name" data-testid="app-name">
        {info?.name ?? "InsightVault"}
      </span>
      <span className="app-tagline">· Trợ lý tri thức cục bộ</span>
      <PrivacyBadge />
    </header>
  );
}
