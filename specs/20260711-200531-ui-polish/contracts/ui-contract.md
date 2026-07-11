# UI Contract — UI Polish v1 (023-ui-polish)

Không có API/IPC contract (feature thuần renderer, không thêm kênh). "Hợp đồng" ở đây là **giao diện +
trợ năng theo màn** — kiểm được bằng e2e (data-testid + thuộc tính a11y).

## Bất biến toàn cục

- **Không kênh IPC mới**; `window.api` giữ nguyên (whitelist không đổi). Icon nhúng inline → **0 network
  request** (no-egress.spec giữ xanh).
- Chip `[n]` (mọi nơi) giữ `onCite` → mở Source Viewer đúng nguồn/đoạn (hành vi KHÔNG đổi).

## Theo màn (kiểm bằng e2e)

### NavRail (mọi màn)

- Rail dọc icon-only; mỗi mục có `aria-label` (Notebooks/Workspace/Settings); Settings ở đáy.
- Điều hướng: bấm mục → route đổi đúng khu vực (như trước). `:focus-visible` khi Tab tới.

### Chat (Workspace)

- Composer: có chỉ báo model (testid `composer-model`), ModeToggle segmented (`role`/`aria`), nút gửi icon
  (`aria-label="Gửi"`, testid `chat-send` giữ nguyên để e2e cũ chạy).
- Bubble: mỗi tin có nhãn người nói (testid `bubble-who`); chip `[n]` (testid `cite-<n>`/`studio-cite-<n>`)
  giữ nguyên.
- Đang tải: skeleton (testid `chat-skeleton`) khi chờ trả lời.

### Notebooks

- 0 notebook → empty state (testid `notebooks-empty`).
- Tìm không khớp → no-result (testid `notebooks-no-result`).

### Modal (Thêm nguồn · Notebook)

- `role="dialog"` + `aria-modal="true"`; nút X (testid `modal-close`); **Escape đóng**; focus trap (Tab
  không rời modal).

### Citation màu (Chat · Studio · Viewer)

- Chip `.cite` + highlight `.hl` dùng token `--cite*` (bảng vàng) — kiểm bằng computed style hoặc snapshot;
  phân biệt với nút `--accent`.

## Chống hồi quy (SC-002)

Mọi e2e hiện có phải xanh: `rag-qa.spec` · `source-viewer.spec` · `studio.spec` · `notebook-crud.spec` ·
`ingestion.spec` · `no-egress.spec` · `navigation.spec` · `shell.spec` · `onboarding.spec` ·
`ai-onboarding.spec` · các `*-security.spec`. Nếu đổi testid nào (vd nút gửi), cập nhật spec tương ứng cùng
commit.
