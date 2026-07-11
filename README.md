# InsightVault — Trợ lý tri thức cục bộ (local-first)

Ứng dụng **desktop Electron** tổng hợp tri thức bằng AI **chạy cục bộ** (kiểu NotebookLM nhưng offline).
Nạp tài liệu vào các "notebook", app xử lý & lập chỉ mục **ngay trên máy**, rồi hỏi đáp / tóm tắt bằng
LLM local với **trích dẫn nguồn kiểm chứng được**. Có tùy chọn dùng AI online bằng API key của chính
người dùng. Chạy trên **macOS + Windows**.

> Dành cho người xử lý nhiều tài liệu và coi trọng quyền riêng tư — nhà nghiên cứu, luật sư, nhà báo,
> sinh viên, kỹ sư — đặc biệt với dữ liệu nhạy cảm không muốn tải lên máy chủ bên thứ ba.

## Điểm khác biệt cốt lõi (bất biến)

- **Local-first:** dữ liệu không rời máy ở chế độ mặc định — lý do sản phẩm tồn tại.
- **Kiểm chứng được:** mọi câu trả lời trích dẫn về đúng đoạn nguồn gốc (trang / timestamp / đoạn).
- **Offline & tự chủ:** chạy được không cần Internet; người dùng kiểm soát mô hình và chi phí.

Chi tiết yêu cầu sản phẩm & ràng buộc: [`docs/OVERVIEW.md`](docs/OVERVIEW.md).
Nguyên tắc kỹ thuật bất di bất dịch: [`.specify/memory/constitution.md`](.specify/memory/constitution.md).

## Tech stack

| Tầng                    | Công nghệ                                               |
| ----------------------- | ------------------------------------------------------- |
| Desktop shell           | Electron + electron-vite                                |
| UI                      | React 18 + TypeScript + Vite · Zustand · TanStack Query |
| Metadata                | SQLite (better-sqlite3, main process)                   |
| Vector store            | LanceDB (embedded)                                      |
| LLM/embedding local     | Ollama (qua `ProviderRegistry`)                         |
| Trích dẫn/viewer        | pdf.js (map chip `[n]` → trang/đoạn)                    |
| Secret (API key online) | keytar (OS keychain)                                    |
| Test                    | Vitest (unit) · Playwright `_electron` (e2e)            |

Quyết định stack đầy đủ: [`docs/04-decisions/2026-07-10-tech-stack.md`](docs/04-decisions/2026-07-10-tech-stack.md).

**Ranh giới bảo mật (bất biến):** renderer `sandbox`/`contextIsolation`/`nodeIntegration:false`; mọi truy
cập FS/DB/model/mạng ở **main process**, expose qua `preload` contextBridge whitelisted; mặc định
**không network egress**.

## Bắt đầu (development)

```bash
npm install
npm run dev        # mở cửa sổ Electron (HMR renderer)
```

| Lệnh               | Việc                                             |
| ------------------ | ------------------------------------------------ |
| `npm run lint`     | prettier --check + eslint + tsc                  |
| `npm test`         | Vitest unit + coverage (≥ 80% business logic)    |
| `npm run build`    | electron-vite build (main/preload/renderer)      |
| `npm run test:e2e` | Playwright `_electron` (cần bản build + display) |

> Lõi hỏi-đáp cần **Ollama** chạy local (feature `002-ai-runtime`). Vỏ ứng dụng (`001-app-shell`) chạy độc lập.

## Cấu trúc dự án

```
src/
├── main/            # Electron main (Node): index, ipc/, services/<feature>/, logging
├── preload/         # contextBridge API (typed, whitelisted)
├── renderer/        # React: app/, features/<feature>/, shared/ (UI kit)
└── shared/          # types + IPC channel contract (dùng chung main↔renderer)
tests/               # unit/ (Vitest) · e2e/ (Playwright)
docs/                # OVERVIEW, glossary, design gốc, decisions, intake, UI prototype
specs/               # Spec Kit sinh mỗi feature (spec/plan/tasks/…)
.specify/            # constitution + template Spec Kit
```

Cô lập theo feature: `src/main/services/<slug>/` + `src/renderer/features/<slug>/`.

## Cách làm việc (spec-driven)

Dự án dùng **[GitHub Spec Kit](https://github.com/github/spec-kit)** + runbook `/design-to-code` để đi từ
tài liệu thiết kế → spec → plan → tasks → code, kèm 4 subagent (`design-intake`, `code-reviewer`,
`security-reviewer`, `glossary-steward`). Mỗi feature:

1. Tạo **GitHub issue** → branch `NNN-<slug>` (`NNN` = số issue, zero-pad ≥ 3 chữ số).
2. Đặt tài liệu nguồn vào `docs/01-basic-design/<slug>/`, `docs/02-detail-design/<slug>/`,
   `docs/03-ui/<slug>/` (UI reference — prototype/Figma).
3. Chạy `/design-to-code` trong Claude Code và theo checkpoint.

Quy ước & lộ trình pha: [`CLAUDE.md`](CLAUDE.md). Làm việc nhóm: [`docs/TEAM-WORKFLOW.md`](docs/TEAM-WORKFLOW.md).

### Lộ trình (theo pha)

**Pha 1 (MVP):** `001 app-shell` → `002 ai-runtime` → `003 notebooks` → `004 ingestion` →
`005 rag-qa` ⭐ → `006 source-viewer` → `007 studio` → `008 online-provider`.
**Pha 2:** `009 audio-video` (transcription) · `010 image` (OCR + vision).

## Giấy phép

MIT — xem [`LICENSE`](LICENSE).

---

> Dự án này khởi tạo từ template **spec-driven-jp** (Spec Kit + đọc tài liệu thiết kế). Hạ tầng template
> (`plugin/`, `.claude-plugin/`, CI `template-smoke-test`) được giữ lại; nội dung đã chỉnh cho InsightVault.
