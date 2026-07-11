# Basic design — tài liệu thiết kế GỐC (nguồn sự thật)

Mô tả **user story / behavior** của từng feature: làm gì, cho ai, phạm vi. Là input cho `/speckit-specify`.

- Nguồn cấp **dự án**: [`docs/OVERVIEW.md`](../OVERVIEW.md) (brief sản phẩm + ràng buộc bất biến).
- Nguồn cấp **feature**: mỗi feature 1 thư mục `docs/01-basic-design/<slug>/`
  (`<slug>` = phần sau `NNN-` trên branch — VD `003-notebooks` → `notebooks/`; cùng slug với
  `docs/02-detail-design/<slug>/`, `docs/03-ui/<slug>/`, `src/renderer/features/<slug>/`).

Agent **KHÔNG BAO GIỜ** sửa nội dung ở đây. Có bản mới → thêm version + `CHANGELOG.md`, không ghi đè.

## Định dạng

Ưu tiên **Markdown** (dễ cho `design-intake` đọc trực tiếp). Nếu có tài liệu nhị phân (`.docx/.xlsx/.pdf`)
— `Read` không parse được — thì **đặt kèm bản export text/markdown** cạnh file gốc (hoặc cài Skill
`docx/xlsx/pdf`).

```
docs/01-basic-design/<slug>/
├── basic-design.md          # user story / behavior (làm gì, cho ai, phạm vi)
└── CHANGELOG.md             # khi có bản mới
```

Đảm bảo tài liệu nêu rõ **mục tiêu + phạm vi feature** — càng rõ, spec càng ít ambiguity.

### `CHANGELOG.md` — mục "Affected issues" bắt buộc

Khi design đổi, thêm version + ghi 1 mục vào `CHANGELOG.md`. Mục **Affected issues** **bắt buộc** —
liệt kê số issue của feature bị ảnh hưởng để biết cái nào phải re-run pipeline
(xem [`docs/TEAM-WORKFLOW.md`](../TEAM-WORKFLOW.md) mục 8):

```markdown
## v2 — 2026-07-10

- Thay đổi: <tóm tắt sửa gì so với v1>
- **Affected issues:** #42, #57 ← bắt buộc
```
