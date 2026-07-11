# Research — UI Polish v1 (023-ui-polish)

5 ambiguity đã chốt ở `docs/04-decisions/2026-07-11-ui-polish-clarify.md` (không còn NEEDS CLARIFICATION).
Mục này chốt chi tiết kỹ thuật + xác nhận giá trị token từ prototype.

## R1 — Token citation (giá trị chuẩn từ prototype `:root`)

- **Decision**: dùng đúng giá trị prototype: `--cite:#9A6510` (amber đậm, chữ chip) · `--cite-bg:#FCEFCF`
  (nền vàng nhạt) · `--cite-line:#E8C878` (viền). Áp cho `.cite` (chip Chat 013 + Studio 021 dùng cùng
  class) + `.hl`/highlight (source-viewer 019).
- **Rationale**: khớp prototype 100%; amber đậm `#9A6510` trên nền cream `#FCEFCF` → tương phản cao
  (≈ 6.7:1, đạt SC-007 ≥4.5:1). Chip mono font + focus-visible outline `--cite` (theo prototype dòng 135–139).
- **Alternatives**: giữ accent xanh (bị bác — lẫn nút, mất semantic); tự chọn vàng khác (bác — lệch prototype).

## R2 — Motion tokens (MỚI — prototype không định nghĩa)

- **Decision**: thêm `--duration-fast: 150ms` · `--duration-normal: 300ms` · `--ease-out-expo:
cubic-bezier(0.16, 1, 0.3, 1)` (theo web/coding-style). Thay transition rải rác (`.12s/.15s/120ms/150ms`)
  bằng token. Bọc `@media (prefers-reduced-motion: reduce)` để tắt/giảm (FR-012).
- **Rationale**: prototype dùng giá trị inline không nhất quán; chuẩn hoá 1 nơi. Chỉ animate
  transform/opacity (compositor-friendly).

## R3 — Gom màu hardcode → token

- **Decision**: các màu lặp cứng (`#d3e6df` viền accent-soft, `#ead9ae`, `#e6c2bd`, `#fbeae8`, `#d99a2b`…)
  → token semantic trong `tokens.css` (vd `--accent-line`, `--warn-line`, `--danger-bg`). Đổi nơi dùng sang
  var(). SC-005: rà mã còn giá trị hardcode cho các màu đã token hoá = 0.
- **Rationale**: web/coding-style (không hardcode lặp). Additive — chỉ thêm token + thay chỗ dùng.

## R4 — Model chip ở composer (CHỈ hiển thị — không đổi logic)

- **Decision**: ChatColumn đọc tên model qua IPC **có sẵn** `window.api.aiGetSelectedModels()` (→
  `chatModel`) + trạng thái `aiGetRuntimeStatus()` (đã dùng trong `useChat`). Hiển thị chip "Local ·
  <chatModel>" (hoặc "Local · chưa chọn" nếu null). Bấm chip → `navigate("/settings")` (router có sẵn).
- **Rationale**: read-only, KHÔNG đổi `send`/`useChat`. Không thêm IPC. Edge case model null → nhãn "chưa
  chọn" (spec edge case).
- **Note**: nếu cần tên đẹp ("qwen3.5" → "Qwen 3.5") → helper thuần `modelLabel(name)` test được; MVP có thể
  hiển thị `name` thô (giữ id kỹ thuật). Quyết định: hiển thị `name` thô + helper để sau nếu muốn (không bắt
  buộc cho v1).

## R5 — A11y modal (focus trap + Escape) — tách hook thuần

- **Decision**: `shared/useModalA11y.ts` — hook nhận ref container + `onClose`; gắn `keydown` Escape →
  `onClose`; focus phần tử focusable đầu khi mở; Tab/Shift+Tab vòng trong container (focus trap). Trả handler
  để component gắn. `aria-modal="true"` + `role="dialog"` đặt ở markup. Nút X góc.
- **Rationale**: logic Escape/trap là thuần (DOM refs) → **unit-test được** (jsdom) → đáp ứng Constitution IV
  cho phần có logic. AddSourceModal + NotebookModal dùng lại.
- **Alternatives**: thư viện focus-trap (bác — thêm dependency, feature này no-dep); inline mỗi modal (bác —
  lặp, khó test).

## R6 — NavRail rail 60px icon-only

- **Decision**: rail dọc 60px; brand "IV" trên cùng; các mục điều hướng là `<button>`/`<NavLink>` chứa SVG
  (từ `icons.tsx`) + `aria-label`/`title`; Settings đẩy đáy bằng `margin-top:auto`/flex spacer; active state
  nền `--accent-soft`. `:focus-visible` outline. Điều hướng vẫn qua router có sẵn (không đổi route).
- **Rationale**: khớp prototype (rail icon). Chuyển từ text-label sang icon + aria-label giữ (thậm chí tăng)
  khả năng trợ năng.

## R7 — Composer + bubble + segmented (thuần trình bày)

- **Decision**: composer bọc `.cbox` (viền, `:focus-within` shadow accent); hàng công cụ: ModeToggle
  segmented (2 đoạn, nền trượt bằng transform, `role="radiogroup"`/`aria-pressed`) + model chip + nút gửi
  icon (SVG máy bay, `aria-label="Gửi"`). MessageBubble: bỏ nền AI (giữ nền user), thêm `.who` label,
  line-height 1.6; giữ `renderWithChips`/`onCite`. KHÔNG đổi `useChat`/`send`/`mode` state.
- **Rationale**: khớp prototype; thuần markup/CSS. Segmented dùng transform (compositor-friendly).

## R7b — Skeleton + empty states

- **Decision**: ChatColumn khi `loading` → skeleton bubble (khối xám bo góc, shimmer bằng opacity/transform
  tôn trọng reduced-motion) cạnh/thay "Đang trả lời…". NotebooksGrid: `notebooks.length===0` → empty state
  (thông báo + CTA tạo); `filtered.length===0 && query` → no-result ("Không tìm thấy notebook").
- **Rationale**: spec FR-007/FR-008. Thuần trình bày, đọc state có sẵn (`loading`, `notebooks`, `query`).

## Tổng kết

Không NEEDS CLARIFICATION. Không dependency/IPC/DB/migration. Chỉ renderer: token (`tokens.css`), icon SVG
(`icons.tsx`), hook a11y thuần (`useModalA11y.ts`), + markup/CSS các feature. Chống hồi quy = e2e cũ xanh.
