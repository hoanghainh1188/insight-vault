# Design intake — 023-ui-polish

- Feature: `023-ui-polish` (issue #23) — nền design-system + đối chiếu prototype
- Nguồn design GỐC: `docs/03-ui/prototype.html` (5 màn: Notebooks · Workspace 3 cột · Thêm nguồn · Xem
  nguồn · Cài đặt) + audit đối chiếu UI đã build (2026-07-11).
- Loại feature: **đánh bóng UI + design-system**, cross-cutting renderer. **KHÔNG đụng main/IPC/DB/logic.**
- Blocked-by: #21 (đã merge PR #22 vào main) — vì chạm `rag-qa.css` + `StudioResultCard` (021).

## Bối cảnh

Vòng lõi đã xong (011→013→019→021). Audit cho thấy UI build lệch prototype ở 4 nhóm: (1) design-system
(token citation, màu hardcode, motion), (2) cấu trúc (NavRail, composer Chat, bubble), (3) a11y, (4) trạng
thái thiếu (empty/skeleton). Feature này gom các mục **cross-cutting, ưu tiên cao, ít rủi ro logic**; các
mục thuộc feature khác được tách ra (xem "Ngoài phạm vi").

## Phạm vi (UI Polish v1)

**Nhóm A — Nền design-system (làm trước, dùng lại khắp nơi)**

- Thêm token citation vàng `--cite`/`--cite-bg`/`--cite-line` (từ prototype); đổi chip `[n]` (rag-qa +
  studio) + highlight (source-viewer) từ **màu accent xanh → bảng vàng** → phục hồi semantic "kiểm chứng
  được".
- Gom màu hardcode (`#d3e6df`, `#ead9ae`, `#e6c2bd`, `#d99a2b`, `#fbeae8`…) thành token trong
  `tokens.css`; thêm token motion `--duration-fast/normal` + `--ease-out-expo` (transition đang rải rác
  `.12s/.15s/120ms/150ms`).

**Nhóm B — Sửa lệch cấu trúc so với prototype**

- NavRail: rail dọc **60px icon-only** (SVG) + brand "IV" trên cùng + Settings đẩy đáy (hiện sidebar 168px
  text).
- Composer Chat: khối `.cbox` + **model chip "Local · <model>"** (liên kết Cài đặt) + nút gửi **icon** + mode
  **segmented** inline (hiện textarea + nút "Gửi" text + mode rời).
- Bubble AI: bỏ nền bubble + thêm **nhãn người nói** ("InsightVault"/"Bạn") + line-height rộng (giữ chip).

**Nhóm C — A11y + trạng thái**

- `:focus-visible` cho nav/nút · `aria-modal` cho modal · đóng modal bằng **Escape** + nút X + focus trap.
- Empty state Notebooks (0 / no-result) · skeleton loading Chat.

## Ngoài phạm vi (tách sang feature khác — audit đã map)

- Section Settings **AI online** → `008 online-provider`.
- Studio **skeleton + Copy/Export** → "Nâng chức năng Studio".
- Source Viewer **canvas PDF / "trang giấy"** → hoãn có chủ đích (clarify 019 A2/A3).
- Tiến độ % xử lý nguồn (W2), type-selector 4-card + queue modal (M1/M2): **P2, cân nhắc** — có thể để đợt
  sau nếu v1 quá lớn (xem Ambiguity #1).

## Ambiguities (cho /speckit-clarify)

1. **Kích thước v1**: gom CẢ nhóm A+B+C trong 1 feature, hay chỉ A+B (nền + cấu trúc) và đẩy C sang v2?
   → **Khuyến nghị**: A+B+C trong 1 feature, chia phase nội bộ (tokens → cấu trúc → a11y/empty). W2/M1/M2
   (P2 nặng) để đợt sau.
2. **Titlebar macOS "traffic lights"** (prototype có 3 chấm): dựng khung custom hay giữ **khung OS native**
   hiện tại? → **Khuyến nghị**: giữ native (3 chấm trong prototype chỉ mock OS chrome), bỏ qua có chủ đích.
3. **Nguồn icon SVG**: dùng thư viện icon hay **hand-inline SVG** trong component? → **Khuyến nghị**:
   hand-inline SVG (local-first, không CDN/dependency — Constitution III + web/security no-CDN).
4. **Ràng buộc hành vi**: đây là thay đổi THUẦN thị giác — KHÔNG đổi logic `useChat`/`ragAsk`/`useStudio`/
   IPC. → **Khuyến nghị**: xác nhận không đổi hành vi; test = giữ e2e cũ xanh + thêm assert a11y
   (focus-visible/aria-modal/Escape).
5. **Blast radius token citation**: đổi token chip đụng 3 nơi (rag-qa 013 · studio 021 · source-viewer 019).
   → **Khuyến nghị**: chấp nhận (đúng mục tiêu nhất quán); e2e các feature đó phải vẫn xanh.

## Prompt for /speckit-specify

> Xây feature UI Polish v1 cho InsightVault — đánh bóng giao diện renderer để khớp wireframe gốc
> `docs/03-ui/prototype.html` và dựng nền design-system. THUẦN thị giác/UX: KHÔNG đổi logic
> main/IPC/DB/hành vi (`useChat`/`ragAsk`/`useStudio` giữ nguyên). Phạm vi 3 nhóm:
> (A) Design-system: thêm token citation vàng (`--cite`/`--cite-bg`/`--cite-line`) + đổi chip `[n]` (rag-qa
>
> - studio) và highlight (source-viewer) từ accent xanh sang bảng vàng (phục hồi semantic kiểm-chứng-được);
>   gom màu hardcode thành token; thêm token motion (`--duration-*`/`--ease-out-expo`).
>   (B) Cấu trúc khớp prototype: NavRail 60px icon-only + Settings đáy; composer Chat (model chip + send icon +
>   mode segmented inline); bubble AI bỏ nền + nhãn người nói.
>   (C) A11y + trạng thái: `:focus-visible`, `aria-modal`, đóng modal bằng Escape + nút X + focus trap; empty
>   state Notebooks; skeleton loading Chat.
>   Quyết định đã chốt (Assumptions, KHÔNG NEEDS CLARIFICATION): (A1) gom A+B+C trong 1 feature, chia phase
>   nội bộ, hoãn W2/M1/M2 nặng. (A2) giữ khung OS native, bỏ traffic-light mock. (A3) hand-inline SVG icon,
>   không thư viện/CDN. (A4) thuần thị giác — không đổi hành vi; test giữ e2e cũ xanh + thêm assert a11y.
>   (A5) đổi token citation đụng 013/021/019 là chủ đích — e2e các feature đó phải vẫn xanh.
>   Ngoài phạm vi: section Settings AI online (→008); Studio skeleton/Copy/Export (→feature Studio); canvas PDF
>   Source Viewer (hoãn); tiến độ % nguồn + type-selector modal 4-card (đợt sau). KHÔNG đụng main/IPC/DB.
>   Tuân Constitution III (renderer thuần, không thêm egress/CDN, icon inline) + web design-quality (hierarchy,
>   motion compositor-friendly transform/opacity, a11y). Ràng buộc bất biến (local-first · kiểm-chứng-được ·
>   offline) không đổi — token citation vàng CỦNG CỐ tính kiểm-chứng-được.
