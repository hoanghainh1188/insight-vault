import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/routes";
import { installGlobalErrorReporting } from "./shared/error-report";
import "./shared/tokens.css";
import "./app/app.css";
import "./features/sources/sources.css";
import "./features/rag-qa/rag-qa.css";
import "./features/source-viewer/source-viewer.css";

// 088: lỗi ngoài React (handler sự kiện, promise bị bỏ quên) cũng ghi vào nhật ký ở main.
installGlobalErrorReporting(window);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
