import { Outlet, useLocation } from "react-router-dom";
import { AppHeader } from "../features/app-shell/AppHeader";
import { NavRail } from "../features/app-shell/NavRail";
import { OnboardingGate } from "../features/app-shell/OnboardingGate";
import { RuntimeOnboarding } from "../features/ai-runtime/RuntimeOnboarding";
import { ReindexBanner } from "../features/ai-runtime/ReindexBanner";
import { useKeyboardShortcuts } from "../shared/useKeyboardShortcuts";
import { ShortcutsHelp } from "../shared/ShortcutsHelp";
import { RestoreResultNotice } from "../features/vault-backup/RestoreResultNotice";
import { ErrorBoundary } from "../shared/ErrorBoundary";
import { LiveRegion } from "../shared/a11y/LiveRegion";

// Layout vỏ: header in-app (dưới khung native OS) + nav rail trái + vùng nội dung (<Outlet/>).
// 088: vùng nội dung bọc ErrorBoundary — lỗi 1 màn không kéo sập header/nav; điều hướng đi là tự hồi phục.
export function App(): JSX.Element {
  const { helpOpen, closeHelp } = useKeyboardShortcuts();
  const { pathname } = useLocation();
  return (
    <div className="app">
      <AppHeader />
      <RestoreResultNotice />
      <ReindexBanner />
      <RuntimeOnboarding />
      <div className="app-body">
        <NavRail />
        <main className="app-content">
          <ErrorBoundary resetKey={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <OnboardingGate />
      {helpOpen && <ShortcutsHelp onClose={closeHelp} />}
      {/* 091: vùng thông báo trình đọc màn hình dùng chung (mốc stream/tiến độ/Studio). */}
      <LiveRegion />
    </div>
  );
}
