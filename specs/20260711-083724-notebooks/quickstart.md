# Quickstart — Notebooks (validation guide)

Chạy & kiểm chứng feature notebooks. Chi tiết: `data-model.md`, `contracts/ipc-channels.md`.

## Prerequisites

- Node LTS + npm; `npm install` (KHÔNG cần dependency mới — `node:sqlite` là built-in).
- Không cần Ollama cho feature này.

## Setup & run

```bash
npm run dev             # mở app, màn Notebooks
npm run lint            # prettier + eslint + tsc
npm test                # Vitest unit + coverage (node:sqlite :memory:, không cần Electron)
npm run build
npm run test:e2e        # Playwright _electron
```

## Validation scenarios (map spec)

| #   | Kịch bản          | Cách kiểm                                                    | Kỳ vọng                                                   | Ref                |
| --- | ----------------- | ------------------------------------------------------------ | --------------------------------------------------------- | ------------------ |
| V1  | Liệt kê notebook  | Seed vài notebook → mở màn                                   | Lưới hiển thị đúng tên/màu + "0 nguồn · Sửa …"            | US1, SC-002        |
| V2  | Tạo notebook      | Modal: tên + màu → lưu                                       | Thẻ mới xuất hiện; mở lại app vẫn còn                     | US2, SC-001/002    |
| V3  | Validate tên/màu  | Tên rỗng / >100 / màu ngoài palette                          | Bị từ chối, lỗi thân thiện, không ghi DB                  | FR-007/008, SC-005 |
| V4  | Đổi tên / đổi màu | Modal sửa → lưu                                              | Card cập nhật + updated_at; lưu bền                       | US3, FR-005        |
| V5  | Xoá (có xác nhận) | Chọn xoá → dialog → xác nhận / huỷ                           | Xác nhận: xoá khỏi lưới+DB; huỷ: không đổi                | US3, SC-004        |
| V6  | Tìm kiếm          | Gõ vào ô tìm kiếm                                            | Lọc theo tên, không phân biệt hoa/thường, tức thì         | US1, SC-003        |
| V7  | Cô lập DB         | e2e: window.api có 5 hàm notebook; renderer không đọc SQLite | Chỉ qua IPC whitelist; kênh lạ bị từ chối                 | US4, SC-006        |
| V8  | Không log tên     | Kiểm log khi CRUD                                            | 0 dòng chứa tên notebook                                  | FR-012, SC-006     |
| V9  | Migration         | Xoá DB → mở app                                              | Migration #1 tạo bảng notebook, user_version=1, không lỗi | FR-010, SC-007     |
| V10 | Điều hướng        | Bấm thẻ notebook                                             | Sang Workspace (khung 001)                                | FR-013             |

## Done

- Unit ≥ 80% business logic (notebook-repo · validation · migrations · relative-time).
- e2e CRUD + whitelist + isolation xanh.
- Migration chạy trên DB rỗng/cũ không mất dữ liệu.
