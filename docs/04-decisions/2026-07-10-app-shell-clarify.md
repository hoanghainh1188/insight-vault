# App-shell — quyết định clarify (4 điểm)

- Ngày: 2026-07-10
- Feature liên quan: `001-app-shell` (issue #1)
- Câu hỏi gốc: 4 ambiguity từ `docs/intake/001-app-shell.md` (mục "Ambiguities"), giải qua `/speckit-clarify`.
- Người quyết định: hoanghainh1188 (2026-07-10)

## Quyết định

| # | Câu hỏi | Quyết định |
|---|---|---|
| A2 | Cơ chế điều hướng giữa Notebooks / Workspace / Cài đặt | **Route phản ánh khu vực đang chọn (dạng hash)** — để deep-link được về sau; feature 001 chỉ cần chuyển giữa 3 khung placeholder. |
| A3 | Kiểu khung cửa sổ (titlebar) | **Frame OS mặc định** (nút minimize/maximize/close native) **+ header in-app** chứa tên app + privacy badge. Custom frameless "traffic-light" như prototype để pha sau. |
| A4 | Bộ kênh IPC whitelist ban đầu | **5 kênh**: `getDataDir`, `getPrivacyState`, `getOnboardingState`, `setOnboardingComplete`, `getAppInfo`. Feature sau mở rộng. |
| A5 | Phát hiện & lưu cờ "lần đầu" | Cờ onboarding lưu ở **OS settings store** (tách khỏi thư mục dữ liệu); thiếu/không đọc được ⇒ coi là lần đầu. *(Khác khuyến nghị ban đầu là lưu trong data dir.)* |

## Ghi chú
- A5: chọn OS settings store thay vì file trong data dir → state onboarding không đi cùng thư mục dữ liệu
  khi backup/di chuyển. Cần lưu ý khi làm feature "đổi thư mục dữ liệu" (Settings) sau này.
- Đã tích hợp vào `specs/20260710-232839-app-shell/spec.md` (mục Clarifications + Assumptions A2–A5 + Key Entities + Edge Cases).
