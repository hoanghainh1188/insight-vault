import { useEffect } from "react";
import { useRouteError } from "react-router-dom";
import { ErrorFallback } from "./ErrorFallback";
import { reportRendererError } from "./error-report";

// 088 — errorElement của route gốc: lỗi ở chính vỏ app (header/nav) mà boundary trong App không bọc tới.
// Thay trang "Unexpected Application Error" mặc định của react-router. Chỉ còn cách tải lại ứng dụng.
export function RouteErrorFallback(): JSX.Element {
  const error = useRouteError();
  useEffect(() => reportRendererError("boundary", error), [error]);
  return <ErrorFallback resetRoute />;
}
