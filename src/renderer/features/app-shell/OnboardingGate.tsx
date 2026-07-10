import { useEffect, useState } from "react";

// Onboarding lần đầu (FR-008). Placeholder — kiểm tra runtime AI local (Ollama) thuộc feature 002.
// Đọc getOnboardingState lúc mount; chưa hoàn tất ⇒ hiện overlay. "Bắt đầu" → setOnboardingComplete.
export function OnboardingGate(): JSX.Element | null {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    window.api
      .getOnboardingState()
      .then((s) => {
        if (alive) setShow(!s.completed);
      })
      .catch(() => {
        // IPC lỗi bất thường: không chặn app (ẩn onboarding) thay vì kẹt overlay.
        if (alive) setShow(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!show) return null;

  const finish = (): void => {
    // Đóng overlay ngay cả khi ghi cờ lỗi (không để người dùng kẹt ở màn chào mừng).
    window.api.setOnboardingComplete().finally(() => setShow(false));
  };

  return (
    <div
      className="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      data-testid="onboarding"
    >
      <div className="onboarding-card">
        <h1>Chào mừng đến InsightVault</h1>
        <p>
          Trợ lý tri thức <b>chạy cục bộ</b> — dữ liệu của bạn không rời máy. Ở
          các bước tiếp theo, ứng dụng sẽ giúp bạn chuẩn bị runtime AI cục bộ và
          tạo notebook đầu tiên.
        </p>
        <button
          className="btn-primary"
          onClick={finish}
          data-testid="onboarding-start"
        >
          Bắt đầu
        </button>
      </div>
    </div>
  );
}
