# ui-polish clarify — chốt 5 ambiguity (023-ui-polish)

- Ngày: 2026-07-11
- Feature: `023-ui-polish` (issue #23)
- Nguồn: `docs/intake/023-ui-polish.md` + audit đối chiếu `docs/03-ui/prototype.html` (5 màn)
- Người quyết định: hoanghainh1188 (2026-07-11) — ủy quyền "chốt luôn khuyến nghị".

## Quyết định

**1. Kích thước v1 — GỘP A+B+C, chia phase nội bộ.** Một feature gồm: (A) design-system tokens, (B) sửa
lệch cấu trúc, (C) a11y + empty/skeleton. Thứ tự phase: tokens → cấu trúc → a11y/empty. **Hoãn** các P2
nặng: tiến độ % xử lý nguồn (audit W2), type-selector 4-card + queue modal (M1/M2) → đợt UI sau.

**2. Titlebar macOS "traffic lights" — GIỮ KHUNG OS NATIVE.** 3 chấm trong prototype chỉ là mockup OS
chrome; Electron dùng khung native → KHÔNG dựng traffic-light giả. Bỏ qua có chủ đích (audit A2).

**3. Icon — HAND-INLINE SVG.** Không thêm thư viện icon, không CDN (Constitution III + web/security no-CDN;
local-first). SVG viết thẳng trong component/asset nội bộ.

**4. Ràng buộc hành vi — THUẦN THỊ GIÁC.** KHÔNG đổi `useChat`/`ragAsk`/`useStudio`/IPC/DB/main. Chỉ đổi
markup/CSS/token + thêm SVG. Test: **giữ mọi e2e cũ xanh** + thêm assert a11y (`:focus-visible`,
`aria-modal`, đóng modal bằng Escape). Unit cho helper thuần nếu phát sinh.

**5. Blast radius token citation — CHẤP NHẬN.** Đổi chip `[n]` sang bảng vàng đụng 3 nơi: rag-qa (013) ·
studio (021) · highlight source-viewer (019). Đúng mục tiêu nhất quán "kiểm chứng được". Ràng buộc: e2e của
013/019/021 phải vẫn xanh sau đổi token.

## Ngoài phạm vi (tách feature khác — audit đã map)

- Section Settings **AI online** → `008 online-provider`.
- Studio **skeleton + Copy/Export** → feature "Nâng chức năng Studio".
- Source Viewer **canvas PDF / "trang giấy"** → hoãn (clarify 019 A2/A3).
- Tiến độ % nguồn (W2) · type-selector 4-card + queue (M1/M2) → đợt UI sau.

## Hệ quả

- `/speckit-plan` bám clarify này. KHÔNG migration, KHÔNG đụng main/IPC.
- Điểm chạm DÙNG CHUNG: `src/renderer/shared/tokens.css` (thêm token) → PR đụng nhiều feature CSS; tách
  commit theo nhóm A/B/C.
- Test gate: coverage business logic không đổi (feature thuần UI); trọng tâm e2e cũ xanh + a11y mới.
