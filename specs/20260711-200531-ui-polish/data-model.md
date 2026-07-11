# Data Model — UI Polish v1 (023-ui-polish)

**Không có thực thể dữ liệu / lưu trữ / migration.** Feature thuần trình bày. "Model" ở đây là **design
tokens** (biến CSS dùng chung) — hợp đồng thị giác, không phải dữ liệu.

## Design tokens THÊM vào `src/renderer/shared/tokens.css`

### Citation (bảng màu trích dẫn — semantic riêng)

| Token         | Giá trị   | Dùng ở                                                    |
| ------------- | --------- | --------------------------------------------------------- |
| `--cite`      | `#9A6510` | chữ chip `[n]`; viền focus chip; nền nhãn `.hltag` viewer |
| `--cite-bg`   | `#FCEFCF` | nền chip `[n]`; nền đoạn highlight `.hl`                  |
| `--cite-line` | `#E8C878` | viền chip; box-shadow highlight                           |

### Motion

| Token               | Giá trị                         | Dùng ở                             |
| ------------------- | ------------------------------- | ---------------------------------- |
| `--duration-fast`   | `150ms`                         | hover/focus transition             |
| `--duration-normal` | `300ms`                         | mở/đóng, trượt segmented, skeleton |
| `--ease-out-expo`   | `cubic-bezier(0.16, 1, 0.3, 1)` | easing chung                       |

### Gom màu hardcode → token semantic (giá trị giữ nguyên, chỉ đặt tên)

`--accent-line` (#d3e6df) · `--warn-line`/`--warn-strong` (#ead9ae/#d99a2b) · `--danger-line`/`--danger-bg`
(#e6c2bd/#fbeae8) — thay các chỗ dùng cứng bằng `var()`. (Tên cuối chốt lúc implement; nguyên tắc: semantic,
không đặt theo màu.)

## Ràng buộc token

- **Tương phản** `--cite` trên `--cite-bg` ≥ 4.5:1 (SC-007; #9A6510/#FCEFCF ≈ 6.7:1 — đạt).
- **Reduced-motion**: mọi transition dùng `--duration-*` phải bị `@media (prefers-reduced-motion: reduce)`
  vô hiệu/giảm (FR-012).
- **Additive**: chỉ THÊM token; không xoá/đổi nghĩa token cũ (`--accent*`, `--surface*`… giữ nguyên).

## Trạng thái UI (không phải dữ liệu — hành vi trình bày)

| Trạng thái          | Điều kiện (đọc state có sẵn)          | Hiển thị                                   |
| ------------------- | ------------------------------------- | ------------------------------------------ |
| Notebooks rỗng      | `notebooks.length === 0`              | empty state + CTA "Tạo notebook mới"       |
| Notebooks no-result | `query` ≠ "" và `filtered.length===0` | "Không tìm thấy notebook"                  |
| Chat đang tải       | `loading === true`                    | skeleton bubble                            |
| Model chip          | `aiGetSelectedModels().chatModel`     | "Local · <model>" hoặc "Local · chưa chọn" |
| Modal mở            | modal visible                         | `aria-modal` + focus trap + Escape đóng    |

Không state transition mới; chỉ ánh xạ state renderer sẵn có → trình bày.
