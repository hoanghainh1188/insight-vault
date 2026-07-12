# UI Contract — Markdown render (029)

Không có API/IPC (thuần renderer). Hợp đồng = hiển thị + an toàn, kiểm bằng e2e.

- Chip `[n]` (testid `cite-<n>` / `studio-cite-<n>`) GIỮ NGUYÊN → mở Source Viewer (019). Không đổi testid.
- Render CHỈ React node — KHÔNG `innerHTML`/`dangerouslySetInnerHTML`. Nội dung `<script>`/HTML thô → hiển
  thị an toàn (không thực thi).
- Link markdown → text (không điều hướng ngoài). 0 network request (no-egress.spec xanh).
- Chống hồi quy: e2e cũ `rag-qa`/`studio`/`source-viewer`/`ui-polish` xanh (chip bấm mở viewer).
