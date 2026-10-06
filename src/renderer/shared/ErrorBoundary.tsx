import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorFallback } from "./ErrorFallback";
import { reportRendererError } from "./error-report";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Đổi giá trị (VD pathname) ⇒ tự xoá trạng thái lỗi — điều hướng sang màn khác là hồi phục. */
  resetKey?: string;
}

interface ErrorBoundaryState {
  failed: boolean;
}

// 088 — chặn lỗi render lan ra cả app: chỉ vùng bọc hiện giao diện lỗi, header/nav vẫn dùng được. React chỉ
// hỗ trợ boundary bằng class component.
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    reportRendererError("boundary", error, info.componentStack ?? undefined);
  }

  componentDidUpdate(prev: ErrorBoundaryProps): void {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  private retry = (): void => this.setState({ failed: false });

  render(): ReactNode {
    return this.state.failed ? (
      <ErrorFallback onRetry={this.retry} />
    ) : (
      this.props.children
    );
  }
}
