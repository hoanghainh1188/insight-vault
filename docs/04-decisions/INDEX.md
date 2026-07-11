# INDEX — mục lục quyết định (long-term memory)

Bảng này liệt kê **mọi quyết định** đã chốt trong `docs/04-decisions/`, để tra nhanh **trước khi hỏi
lại** một ambiguity (rule 2 + rule 6 `CLAUDE.md`). `design-intake` và `/speckit-clarify` PHẢI quét
bảng này trước — nếu câu hỏi đã có ở đây, dùng lại quyết định cũ thay vì hỏi lần nữa.

> **Quy ước:** mỗi khi thêm 1 file `docs/04-decisions/<YYYY-MM-DD>-<slug>.md`, **append 1 dòng** vào
> bảng dưới (append ít đụng nhau — hiếm khi gây git conflict). Sắp theo ngày giảm dần (mới nhất trên cùng).

| Ngày       | Quyết định                                                                                                                                        | Feature         | Thuật ngữ / chủ đề                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------- |
| 2026-07-11 | Data dir dùng app.getPath('userData') (sửa spec FR-011 cho khớp) → file 2026-07-11-data-dir-path.md                                               | `001-app-shell` | data dir / lưu trữ cục bộ                 |
| 2026-07-10 | App-shell clarify: router hash · frame OS + header in-app · 5 IPC channel · onboarding ở OS settings store → file 2026-07-10-app-shell-clarify.md | `001-app-shell` | app shell / IPC / onboarding / navigation |
| 2026-07-10 | Tech stack & kiến trúc nền (Electron+React, SQLite+LanceDB, Ollama, bảo mật renderer, thứ tự pha) → file 2026-07-10-tech-stack.md                 | `_project`      | stack / kiến trúc / RAG / trích dẫn       |
