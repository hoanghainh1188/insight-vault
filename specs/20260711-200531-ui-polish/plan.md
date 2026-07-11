# Implementation Plan: UI Polish v1 (nền design-system + đối chiếu prototype)

**Branch**: `023-ui-polish` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20260711-200531-ui-polish/spec.md`

## Summary

Đánh bóng UI renderer khớp `prototype.html` + dựng nền design-system. 3 nhóm/phase: **(A)** token citation
vàng (`--cite:#9A6510` / `--cite-bg:#FCEFCF` / `--cite-line:#E8C878` — lấy từ prototype `:root`) áp cho chip
`[n]` (Chat 013 · Studio 021) + highlight (source-viewer 019); gom màu hardcode + token motion. **(B)**
NavRail 60px icon-only · composer Chat (model chip + send icon + mode segmented) · bubble AI bỏ nền + nhãn
người nói. **(C)** a11y (`:focus-visible`, `aria-modal`, Escape, focus trap) + empty state Notebooks +
skeleton Chat. **THUẦN renderer — KHÔNG main/IPC/DB, KHÔNG migration, KHÔNG đổi hành vi.**

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 18 (renderer). Chỉ renderer.

**Primary Dependencies**: KHÔNG thêm dependency. Icon **hand-inline SVG** (không lib/CDN). Tái dùng router
(HashRouter), hook logic có sẵn (`useChat`/`useStudio`/`useSourceViewer`/notebooks) — KHÔNG sửa.

**Storage**: Không. Feature thuần trình bày.

**Testing**: Vitest (unit — chỉ khi tách hook/helper thuần, vd `useModalA11y` focus-trap/escape). Playwright
`_electron` (e2e — GIỮ mọi spec cũ xanh chống hồi quy SC-002; THÊM a11y: focus-visible, aria-modal, Escape,
empty state, nav aria-label).

**Target Platform**: Desktop (offline-first — icon inline không phát request; `no-egress.spec` giữ xanh).

**Project Type**: Desktop app (Electron main/preload/renderer) — cấu trúc D6. Feature chạm **chỉ renderer**.

**Performance Goals**: chuyển động compositor-friendly (transform/opacity), tôn trọng `prefers-reduced-motion`;
không gây layout shift.

**Constraints**: Constitution III (renderer thuần, icon inline không CDN/egress, không log — không đụng);
web design-quality (hierarchy scale contrast, motion, a11y keyboard + contrast ≥4.5:1 cho `--cite`); web
coding-style (token CSS, không hardcode màu lặp). Ràng buộc bất biến KHÔNG đổi — token citation vàng CỦNG CỐ
kiểm-chứng-được (chip có bảng màu semantic riêng).

**Scale/Scope**: 0 migration, 0 kênh IPC, 0 service. Chạm `tokens.css` (DÙNG CHUNG, thêm token) + CSS/
component của app-shell · notebooks · rag-qa · studio · source-viewer. Có thể tách 1 hook a11y thuần.

## Constitution Check

_GATE: Phải pass trước Phase 0. Re-check sau Phase 1._

| Principle                                           | Cách tuân thủ                                                                                                                                          | Trạng thái |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| **I. Local-first & No Egress**                      | Icon **hand-inline SVG** — KHÔNG CDN/thư viện/request ngoài. `no-egress.spec` giữ xanh. Không thêm nguồn mạng.                                         | ✅ PASS    |
| **II. Verifiable Citations (NON-NEGOTIABLE)**       | Đổi MÀU chip/highlight — KHÔNG đổi dữ liệu/hành vi trích dẫn. Bảng vàng semantic CỦNG CỐ nhận diện trích dẫn. `onCite`/locator/postprocess giữ nguyên. | ✅ PASS    |
| **III. Desktop Security Boundary (NON-NEGOTIABLE)** | Chạm CHỈ renderer (markup/CSS/SVG). KHÔNG đụng main/preload/IPC/DB. Render vẫn text-node (không `innerHTML` mới). Không log.                           | ✅ PASS    |
| **IV. Test-First & Coverage**                       | Feature thuần UI: business-logic coverage KHÔNG đổi. Chống hồi quy = e2e cũ xanh (SC-002) + e2e a11y mới. Hook thuần (nếu tách) có unit.               | ✅ PASS    |
| **V. Phased Delivery**                              | Đánh bóng UI sau vòng lõi; KHÔNG nhảy cóc. Điểm chạm token DÙNG CHUNG tách commit (rule 5).                                                            | ✅ PASS    |

**Kết luận: GATE PASS.** Không thêm dependency/schema/IPC. Thay đổi token `tokens.css` là additive; đổi
`.cite`/highlight sang token là thay giá trị màu, không đổi cấu trúc/hành vi.

## Project Structure

### Documentation (this feature)

```text
specs/20260711-200531-ui-polish/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ui-contract.md   # hợp đồng UI (không API): token + a11y + trạng thái theo màn
├── checklists/requirements.md
└── tasks.md                    # /speckit-tasks
```

### Source Code (repository root) — CHỈ renderer

```text
src/renderer/
├── shared/
│   ├── tokens.css              # A: THÊM --cite/--cite-bg/--cite-line + gom màu hardcode + --duration-*/--ease-out-expo
│   ├── icons.tsx               # B: hand-inline SVG icon (nav, send, search, +, upload, close…) — MỚI, thuần
│   └── useModalA11y.ts         # C: hook thuần focus-trap + Escape (tách để test) — MỚI
├── features/app-shell/NavRail.tsx  # B: rail 60px icon-only + Settings đáy + aria-label
├── app/app.css                 # B/C: rail dims + :focus-visible + gom màu → token (đường dẫn thực tế src/renderer/app/)
├── features/notebooks/
│   ├── NotebooksGrid.tsx       # C: empty state (0 nb) + no-result (tìm không khớp)
│   ├── NotebookModal.tsx       # C: aria-modal + Escape + focus trap (dùng useModalA11y)
│   └── (search icon, + icon từ icons.tsx)
├── features/rag-qa/
│   ├── ChatColumn.tsx          # B: composer .cbox + model chip + send icon; C: skeleton loading
│   ├── ModeToggle.tsx          # B: segmented control (aria-pressed/role)
│   ├── MessageBubble.tsx       # B: bỏ nền bubble AI + nhãn .who (giữ renderWithChips/onCite)
│   └── rag-qa.css              # A: .cite → token --cite; B: composer/bubble/segmented; :focus-visible
├── features/studio/
│   └── studio.css              # A: chip .cite kế thừa token vàng (StudioResultCard đã dùng class .cite)
├── features/sources/
│   ├── AddSourceModal.tsx      # C: aria-modal + Escape + nút X + focus trap (useModalA11y)
│   └── sources.css             # A: gom màu hardcode → token; :focus-visible
└── features/source-viewer/
    └── source-viewer.css       # A: highlight → token --cite-bg/--cite-line (thay --warn-*)

Điểm chạm DÙNG CHUNG (tách commit — rule 5): src/renderer/shared/tokens.css (thêm token).

tests/
├── unit/  ui-modal-a11y.test.ts (nếu tách useModalA11y) · model-label.test.ts (nếu có helper tên model)
└── e2e/   ui-polish.spec.ts (a11y: focus-visible · aria-modal · Escape · empty state · nav aria-label ·
                              chip [n] vẫn mở viewer sau đổi màu) + GIỮ mọi spec cũ xanh
```

**Structure Decision**: Feature thuần renderer. Nền design-system ở `tokens.css` (thêm token, tách commit).
Icon gom `shared/icons.tsx` (hand-inline SVG, thuần — dùng lại khắp nav/composer/modal). Logic a11y
(focus-trap/escape) tách `shared/useModalA11y.ts` để **unit-test được** (đáp ứng Constitution IV cho phần
có logic). Component/CSS còn lại phủ bởi e2e như tiền lệ. KHÔNG đụng main/IPC/DB/hook-logic.

## Complexity Tracking

> Không vi phạm Constitution. Không thêm dependency/schema/IPC/migration. Blast radius token DÙNG CHUNG là
> bản chất của "dựng design-system" — giảm thiểu bằng: chỉ THÊM token (không xoá), tách commit theo nhóm
> A/B/C, và ràng buộc e2e cũ (013/019/021/notebooks/ingestion) phải xanh (SC-002). Không cần biện minh thêm.
