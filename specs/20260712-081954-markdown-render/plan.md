# Implementation Plan: Markdown render (Chat + Studio, giữ chip [n])

**Branch**: `029-markdown-render` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/20260712-081954-markdown-render/spec.md`

## Summary

Render markdown AN TOÀN cho câu trả lời Chat (013) + kết quả Studio (021), GIỮ chip `[n]` bấm được (019).
**HAND-ROLL** parser markdown tối giản → React node (KHÔNG innerHTML/CDN/dependency — XSS-safe by
construction). Tách helper dùng chung `renderer/shared/markdown/` thay `renderWithChips` ở 2 nơi. THUẦN
renderer — KHÔNG main/IPC/DB/migration.

## Technical Context

**Language/Version**: TS 5 (strict), React 18 (renderer). Chỉ renderer.

**Primary Dependencies**: KHÔNG thêm. Tái dùng `Citation`/`formatCitationLabel` (013), `onCite` (019).

**Storage**: Không. Thuần trình bày.

**Testing**: Vitest (unit — parser markdown THUẦN test kỹ = CRUX: block/inline/chip/an-toàn; jsdom cho
render nếu cần). Playwright `_electron` (e2e — chip vẫn mở viewer sau markdown; HTML thô không thực thi; GIỮ
e2e cũ xanh SC-005).

**Target Platform**: Desktop offline-first (không CDN/egress — no-egress.spec giữ xanh).

**Project Type**: Desktop app (Electron main/preload/renderer) — D6. Chạm CHỈ renderer.

**Constraints**: Constitution I (không CDN/egress); II (chip `[n]` giữ hành vi + locator — không đổi
onCite/Citation); III (render React node, KHÔNG innerHTML/dangerouslySetInnerHTML); IV coverage ≥80% (parser
thuần).

**Scale/Scope**: 0 IPC/DB/migration. 1 module thuần mới (`shared/markdown/`), sửa MessageBubble +
StudioResultCard (thay renderWithChips) + CSS.

## Constitution Check

_GATE: pass trước Phase 0._

| Principle                                       | Cách tuân thủ                                                                                                 | Trạng thái |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------- |
| I. Local-first & No Egress                      | Hand-roll (không lib/CDN); link render text không mở ngoài; no-egress.spec xanh.                              | ✅ PASS    |
| II. Verifiable Citations (NON-NEGOTIABLE)       | Chip `[n]` tokenize inline giữ `onCite`/Citation/locator — không đổi hành vi/dữ liệu trích dẫn.               | ✅ PASS    |
| III. Desktop Security Boundary (NON-NEGOTIABLE) | Render CHỈ React node — KHÔNG innerHTML → nội dung LLM (HTML/script) không thực thi (XSS-safe). Chỉ renderer. | ✅ PASS    |
| IV. Test-First & Coverage                       | Parser markdown thuần → unit-test kỹ (block/inline/chip/an-toàn). Coverage ≥80%.                              | ✅ PASS    |
| V. Phased Delivery                              | Đánh bóng hiển thị sau vòng lõi; KHÔNG main/IPC/DB.                                                           | ✅ PASS    |

**GATE PASS.** Không innerHTML → an toàn theo cấu trúc; hand-roll → không dependency.

## Project Structure

```text
src/renderer/
├── shared/markdown/
│   ├── parse.ts             # THUẦN: parseMarkdown(text) → Block[] (heading/para/list/codeblock) + inline tokens — CRUX
│   └── MarkdownContent.tsx  # render Block[] → React node; chip [n] inline (nhận citeByN + onCite)
└── features/
    ├── rag-qa/MessageBubble.tsx     # câu trả lời AI → <MarkdownContent> (tin user giữ text)
    ├── rag-qa/rag-qa.css            # style heading/list/code trong .bubble-text
    ├── studio/StudioResultCard.tsx  # nội dung → <MarkdownContent>
    └── studio/studio.css            # style trong .studio-card-body

tests/
├── unit/  markdown-parse.test.ts (block/inline/chip/an-toàn — CRUX)
└── e2e/   markdown-render.spec.ts (chip mở viewer sau markdown; HTML thô không thực thi) + GIỮ e2e cũ xanh
```

**Structure Decision**: `parse.ts` THUẦN (text → cấu trúc block/inline, tokenize `[n]` ở inline nhưng KHÔNG
trong code) = CRUX test kỹ. `MarkdownContent.tsx` map cấu trúc → React node + chip (`formatCitationLabel`/
`onCite` như renderWithChips cũ). Thay `renderWithChips` ở MessageBubble + StudioResultCard. Component/CSS
phủ e2e. KHÔNG đụng logic/dữ liệu.

## Complexity Tracking

> Hand-roll parser là độ phức tạp CẦN THIẾT để markdown + chip + XSS-safe không cần dependency (khớp ethos
> no-CDN). Cô lập trong `parse.ts` thuần (test kỹ). Không cần biện minh thêm.
