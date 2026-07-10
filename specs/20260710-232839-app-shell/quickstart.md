# Quickstart — App Shell (validation guide)

Hướng dẫn chạy & kiểm chứng feature app-shell end-to-end. (Chi tiết entity/contract xem `data-model.md`
và `contracts/ipc-channels.md`.)

## Prerequisites
- Node.js LTS + npm.
- macOS hoặc Windows (feature yêu cầu chạy trên cả 2 — FR-013).
- (Chưa cần Ollama/LanceDB — thuộc feature sau.)

## Setup & run (dev)
```bash
npm install
npm run dev        # electron-vite dev: mở cửa sổ Electron với HMR renderer
```

## Build & test
```bash
npm run lint       # eslint + type-check
npm run test       # Vitest unit + coverage (ngưỡng ≥ 80% business logic — Constitution IV)
npm run test:e2e   # Playwright _electron smoke (tuỳ chọn ở máy có display)
npm run build      # electron-vite build (đóng gói bản cài để pha sau — ngoài phạm vi 001)
```

## Validation scenarios (map tới spec)

| # | Kịch bản | Cách kiểm | Kỳ vọng | Ref |
|---|---|---|---|---|
| V1 | Mở app trên máy sạch | `npm run dev` | Cửa sổ desktop hiện: titlebar/header có "InsightVault" + badge "Chạy cục bộ · dữ liệu không rời máy"; ≤ 3s | US1, SC-001, FR-001/002 |
| V2 | Chạy offline | Ngắt mạng → `npm run dev` | App mở bình thường, hiển thị đầy đủ shell, badge vẫn "Chạy cục bộ" | US1, SC-003, FR-003/004 |
| V3 | Điều hướng rail | Bấm Notebooks/Workspace/Cài đặt | Nội dung đổi sang placeholder tương ứng; mục active đánh dấu; route hash đổi `/notebooks`→`/workspace`→`/settings` | US3, FR-005/006 |
| V4 | Cô lập renderer | Trong e2e: từ renderer thử `window.require`/`process`/`fs` | Không khả dụng — thao tác thất bại | US2, FR-009, SC-004 |
| V5 | Whitelist IPC | Trong e2e/unit: gọi kênh ngoài 5 kênh whitelisted | Bị từ chối, không side effect | US2, FR-010, SC-004 |
| V6 | Onboarding lần đầu | Xoá cờ ở OS settings store → mở app | Onboarding placeholder hiện; hoàn tất → mở lại **không** hiện | US4, FR-008, SC-006 |
| V7 | Data dir | Mở app | Thư mục dữ liệu OS được tạo/đảm bảo tồn tại; báo lỗi thân thiện nếu không tạo được | FR-011/012 |
| V8 | Không network egress | e2e: theo dõi request mạng khi dùng shell | 0 request ra ngoài (kể cả font — self-host) | Constitution I, R7 |

## Định nghĩa "Done" cho feature (tóm tắt)
- 8 scenario V1–V8 pass; lint/test/build xanh; coverage ≥ 80% business logic.
- Không có kênh IPC ngoài 5 kênh whitelisted; renderer sandboxed.
- 0 network egress mặc định (font self-host, CSP `default-src 'self'`).
