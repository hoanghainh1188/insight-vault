import { Outlet } from "react-router-dom";
import { AppHeader } from "../features/app-shell/AppHeader";
import { NavRail } from "../features/app-shell/NavRail";
import { OnboardingGate } from "../features/app-shell/OnboardingGate";

// Layout vỏ: header in-app (dưới khung native OS) + nav rail trái + vùng nội dung (<Outlet/>).
export function App(): JSX.Element {
  return (
    <div className="app">
      <AppHeader />
      <div className="app-body">
        <NavRail />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
      <OnboardingGate />
    </div>
  );
}
