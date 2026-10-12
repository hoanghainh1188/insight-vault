import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/routes";
import { installGlobalErrorReporting } from "./shared/error-report";
import { I18nProvider } from "./shared/i18n/I18nProvider";
import "./shared/tokens.css";
import "./app/app.css";
import "./features/sources/sources.css";
import "./features/rag-qa/rag-qa.css";
import "./features/source-viewer/source-viewer.css";
import "./features/meeting-capture/meeting-capture.css";
import { RecordingProvider } from "./features/meeting-capture/RecordingProvider";

// 088: lỗi ngoài React (handler sự kiện, promise bị bỏ quên) cũng ghi vào nhật ký ở main.
installGlobalErrorReporting(window);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      {/* 186: phiên ghi cuộc họp sống ở CẤP APP — đổi route không dừng micro. */}
      <RecordingProvider>
        <RouterProvider router={router} />
      </RecordingProvider>
    </I18nProvider>
  </React.StrictMode>,
);
