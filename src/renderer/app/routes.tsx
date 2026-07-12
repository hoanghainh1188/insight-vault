import { createHashRouter, Navigate } from "react-router-dom";
import { App } from "./App";
import { WorkspacePlaceholder } from "../features/app-shell/placeholders";
import { NotebooksGrid } from "../features/notebooks/NotebooksGrid";
import { Workspace } from "../features/sources/Workspace";
import { SettingsAiSection } from "../features/ai-runtime/SettingsAiSection";
import { SettingsAiOnlineSection } from "../features/ai-runtime/SettingsAiOnlineSection";

// HashRouter (clarify A2) — route phản ánh khu vực, deep-link được sau. Mặc định /notebooks (A6).
export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/notebooks" replace /> },
      { path: "notebooks", element: <NotebooksGrid /> },
      { path: "workspace/:notebookId", element: <Workspace /> },
      // Bare /workspace (rail chưa chọn notebook): nhắc chọn notebook (placeholder từ 001).
      { path: "workspace", element: <WorkspacePlaceholder /> },
      {
        path: "settings",
        element: (
          <section className="settings-page" data-testid="placeholder-settings">
            <h2>Cài đặt</h2>
            <SettingsAiSection />
            <SettingsAiOnlineSection />
          </section>
        ),
      },
    ],
  },
]);
