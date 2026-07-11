# UI reference — nguồn thiết kế giao diện

Nguồn UI của InsightVault (chuẩn cho bố cục, luồng, văn phong):

- **Prototype HTML:** [`prototype.html`](prototype.html) — wireframe định hướng cấp dự án (5 màn:
  Notebooks · Workspace 3 cột · Thêm nguồn · Xem nguồn có highlight · Cài đặt). `design-intake` đọc
  trực tiếp file này (HTML/CSS/JS tĩnh — không cần Figma MCP).
- **Figma (nếu có):** khi feature nào có Figma, đặt link/node vào `docs/03-ui/<slug>/figma-links.md`;
  `design-intake` sẽ đọc qua Figma MCP hoặc snapshot.

Mỗi feature (khi cần UI riêng) 1 thư mục `docs/03-ui/<slug>/` (`<slug>` khớp branch `NNN-<slug>` — xem
[`01-basic-design/README.md`](../01-basic-design/README.md)):

```
docs/03-ui/<slug>/
├── figma-links.md           # link/node Figma (nếu dùng Figma) — ghi rõ mỗi node là màn gì
└── screenshots/             # ảnh chụp mốc tại thời điểm sinh code (fallback khi không có Figma MCP)
```

Format gợi ý cho `figma-links.md`:

```
## <ten-man-hinh>
- Figma node: <link>          # hoặc: nguồn = prototype.html mục <phần>
- Snapshot ngày: YYYY-MM-DD
- Sinh code từ commit: <git-sha>
```

## Khi UI đổi giữa chừng — `CHANGELOG.md` + "Affected issues"

Khi thiết kế đổi đáng kể (đổi luồng màn, thêm/bỏ field trên UI…), ghi 1 mục vào `CHANGELOG.md` của
feature — cùng quy tắc `01-basic-design` / `02-detail-design`. Mục **Affected issues** **bắt buộc**:
liệt kê số issue của feature bị ảnh hưởng để biết cái nào phải re-run pipeline
(xem [`docs/TEAM-WORKFLOW.md`](../TEAM-WORKFLOW.md) mục 8).

```markdown
## v2 — 2026-07-10

- Thay đổi: <đổi gì trên UI so với snapshot trước>
- **Affected issues:** #42, #57 ← bắt buộc
```
