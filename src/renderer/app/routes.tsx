import { createHashRouter, Navigate } from "react-router-dom";
import { App } from "./App";
import {
  NotebooksPlaceholder,
  WorkspacePlaceholder,
  SettingsPlaceholder,
} from "../features/app-shell/placeholders";

// HashRouter (clarify A2) — route phản ánh khu vực, deep-link được sau. Mặc định /notebooks (A6).
export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/notebooks" replace /> },
      { path: "notebooks", element: <NotebooksPlaceholder /> },
      { path: "workspace", element: <WorkspacePlaceholder /> },
      { path: "settings", element: <SettingsPlaceholder /> },
    ],
  },
]);
