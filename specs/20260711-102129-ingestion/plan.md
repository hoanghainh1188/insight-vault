# Implementation Plan: Nạp nguồn (Ingestion)

**Branch**: `011-ingestion` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/20260711-102129-ingestion/spec.md`

## Summary

Pipeline lõi biến tài liệu (PDF/.docx/.txt/.md/URL) người dùng thêm vào một notebook thành dữ liệu sẵn
sàng RAG: **parse → làm sạch → chunk (gắn locator ngay) → embed → lưu**. Metadata nguồn/đoạn ở SQLite
(migration #2, FK cascade), vector ở LanceDB (`userData/vectors/`), khớp theo `chunk.id`. Hàng đợi xử lý
tuần tự 1 nguồn/lần, báo trạng thái/tiến độ realtime qua event push. Toàn bộ FS/parse/fetch/embed/DB/vector
chạy ở **main process**; renderer chỉ qua 6 kênh `source:*` whitelisted. Kỹ thuật: tái dùng
`ProviderRegistry.embed()` (007), module DB + migration runner (009), data dir (001). Thư viện parse thuần
JS (pdfjs-dist, mammoth, readability+jsdom+turndown); LanceDB native prebuilt.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 24 (Electron 43 main + vitest), React 18 (renderer)

**Primary Dependencies**: Electron 43, electron-vite; `pdfjs-dist` (PDF text theo trang), `mammoth`
(.docx), `@mozilla/readability` + `jsdom` + `turndown` (URL→markdown), `node:crypto` (sha256 dedup),
`node:sqlite` (metadata, kế thừa D2), `@lancedb/lancedb` (vector store, native prebuilt); tái dùng
`ProviderRegistry`/`LLMProvider.embed()` (007).

**Storage**: SQLite `userData/insightvault.db` (bảng mới `source`, `chunk` — migration #2) + LanceDB
`userData/vectors/` (bảng `chunks`). Metadata ↔ vector khớp theo `chunk.id`.

**Testing**: Vitest (unit, node env, DI — `:memory:` SQLite + mock vector-store/provider/fetch/fs, fixture
PDF/docx/txt/md nhỏ), Playwright `_electron` (e2e: add→ready, delete→cascade, whitelist).

**Target Platform**: Desktop (macOS darwin-arm64 dev, linux-x64 CI, Windows sau) — offline-first.

**Project Type**: Desktop app (Electron main/preload/renderer) — cấu trúc D6.

**Performance Goals**: Nạp không chặn UI (xử lý ở main, tiến độ realtime); hàng đợi tuần tự tránh nghẽn tài
nguyên; brute-force vector search đủ nhanh ở quy mô cá nhân (< vài chục nghìn chunk).

**Constraints**: Local-first no-egress trừ Ollama local + URL người dùng nhập (chặn SSRF); locator gắn ngay
lúc chunk (cấm tái tạo); không log nội dung tài liệu; coverage ≥80% business logic; file <400 dòng (max 800).

**Scale/Scope**: MVP cá nhân — hàng chục–trăm nguồn/notebook, mỗi nguồn tới hàng nghìn chunk. 6 kênh IPC,
migration #2, ~1 service pipeline + parsers + vector-store + mở rộng notebook-repo + UI sources.

## Constitution Check

_GATE: Phải pass trước Phase 0. Re-check sau Phase 1._

| Principle                                           | Cách feature tuân thủ                                                                                                                                                                                                                                | Trạng thái |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **I. Local-first & No Default Egress**              | Parse/embed/lưu hoàn toàn trên máy. Egress duy nhất: Ollama local (embed) + URL người dùng chủ động nhập → bật privacy "online" khi fetch, chặn SSRF (chỉ http/https, từ chối host nội bộ/loopback, ≤5 redirect, giới hạn body). Không telemetry.    | ✅ PASS    |
| **II. Verifiable Citations (NON-NEGOTIABLE)**       | Chunker gắn `Locator{page,charStart,charEnd}` NGAY lúc tạo mỗi chunk từ văn bản đã làm sạch; không vắt trang PDF → page đơn trị; cấm tái tạo sau. Test khẳng định 100% chunk có locator hợp lệ.                                                      | ✅ PASS    |
| **III. Desktop Security Boundary (NON-NEGOTIABLE)** | Toàn bộ FS/parse/fetch/chunk/embed/SQLite/LanceDB ở main; renderer qua 6 kênh `source:*` whitelisted (`safeHandle`, không catch-all). Không truyền toàn văn/vector thô qua renderer dưới dạng nội dung đầy đủ. Không log nội dung tài liệu (redact). | ✅ PASS    |
| **IV. Test-First & Coverage (Article W)**           | TDD; unit cho chunker/cleaning/dedup/size-limits/SSRF/source-repo/status/pipeline (DI, không cần Electron); e2e cho luồng qua IPC. Coverage ≥80% business logic; exclude file wiring thuần.                                                          | ✅ PASS    |
| **V. Phased Delivery**                              | Đúng thứ tự D8 (pha 004, sau notebooks/ai-runtime). Không đụng RAG/chat (005), viewer (006), audio/ảnh (Pha 2).                                                                                                                                      | ✅ PASS    |

**Section 2 (source-of-truth & terminology)**: parser/chunk/LanceDB đã chốt qua ADR (2026-07-11-*); glossary
tra trước, 7 term mới sẽ append trong branch. Không mâu thuẫn OVERVIEW/prototype. **Kết luận: GATE PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/20260711-102129-ingestion/
├── plan.md              # File này
├── research.md          # Phase 0
├── data-model.md        # Phase 1 (schema source/chunk + LanceDB)
├── quickstart.md        # Phase 1 (kịch bản kiểm chứng)
├── contracts/
│   └── ipc-channels.md  # 6 kênh source:*
├── checklists/
│   └── requirements.md  # (từ /speckit-specify)
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── shared/
│   └── ipc/
│       ├── channels.ts          # THÊM 6 kênh source:* + WHITELISTED (event source:progress riêng)
│       └── types.ts             # THÊM Source, Chunk, Locator, SourceStatus, SourceKind, AddSourceInput, SourceProgressEvent
├── main/
│   ├── db/
│   │   └── migrations.ts        # APPEND migration #2 (bảng source + chunk, FK cascade) — KHÔNG sửa #1
│   ├── services/
│   │   ├── ingestion/
│   │   │   ├── source-repo.ts       # CRUD source/chunk SQLite (parameterized), đếm sourceCount
│   │   │   ├── pipeline.ts          # điều phối tuần tự FIFO 1 nguồn/lần (wiring — exclude coverage)
│   │   │   ├── queue.ts             # hàng đợi FIFO + trạng thái/tiến độ (business logic thuần)
│   │   │   ├── cleaning.ts          # làm sạch văn bản
│   │   │   ├── chunker.ts           # recursive char splitter + gắn Locator, không vắt trang
│   │   │   ├── embed.ts             # gọi ProviderRegistry.embed cho từng chunk
│   │   │   ├── dedup.ts             # sha256 tệp / normalize URL
│   │   │   ├── size-limits.ts       # giới hạn kích thước theo loại
│   │   │   ├── status.ts            # enum SourceStatus + chuyển trạng thái
│   │   │   ├── vector-store.ts      # bọc @lancedb/lancedb (open/add/deleteBySource/deleteByNotebook/search) — wiring
│   │   │   └── parsers/
│   │   │       ├── index.ts         # chọn parser theo loại → { text, pages? }
│   │   │       ├── pdf.ts           # pdfjs-dist, text theo trang (+ page boundaries)
│   │   │       ├── docx.ts          # mammoth extractRawText
│   │   │       ├── text.ts          # txt/md qua node:fs
│   │   │       ├── url.ts           # fetch + readability + jsdom + turndown
│   │   │       └── ssrf-guard.ts    # kiểm scheme/host nội bộ/redirect (business logic thuần)
│   │   └── notebooks/
│   │       └── notebook-repo.ts     # MỞ RỘNG: delete dọn LanceDB theo notebook_id; sourceCount thật
│   ├── ipc/
│   │   └── register.ts          # đăng ký 5 kênh source:* + wiring progress → webContents.send
│   └── index.ts                 # wiring: mở vector-store, tạo pipeline/source-repo, truyền vào registerIpc
├── preload/
│   └── index.ts                 # THÊM source.* + onSourceProgress(cb) → unsubscribe
└── renderer/
    └── features/
        └── sources/
            ├── AddSourceModal.tsx   # kéo-thả tệp/URL + hàng đợi tiến độ
            ├── SourceList.tsx       # cột Nguồn Workspace (icon + trạng thái)
            ├── SourceItem.tsx       # 1 dòng nguồn + chấm trạng thái
            ├── useSources.ts        # snapshot listByNotebook + subscribe onSourceProgress
            └── source-status.ts     # nhãn tiếng Việt + ánh xạ .stat + aggregate "đã lập chỉ mục"

tests/
├── unit/
│   ├── chunker.test.ts          # locator đúng, overlap, không vắt trang
│   ├── cleaning.test.ts
│   ├── dedup.test.ts
│   ├── size-limits.test.ts
│   ├── ssrf-guard.test.ts
│   ├── source-repo.test.ts      # :memory: SQLite, cascade
│   ├── source-status.test.ts    # nhãn + aggregate
│   ├── queue.test.ts            # FIFO tuần tự
│   ├── ingestion-pipeline.test.ts  # awaiting_embedding khi provider offline, retry, tiến độ
│   └── source-ipc-whitelist.test.ts
├── fixtures/                    # sample.pdf, sample.docx, sample.txt, sample.md nhỏ
└── e2e/
    └── ingestion.e2e.ts         # add file→ready, delete→cascade, whitelist
```

**Structure Decision**: Theo D6 (Electron main/preload/renderer, tách file nhỏ theo domain). Feature thêm
domain `ingestion` ở main (service thuần, DI để test) + domain `sources` ở renderer, mở rộng `notebooks` +
`db` + `ipc` + `shared`. Pipeline/vector-store là composition-root/wiring → exclude khỏi coverage như tiền
lệ `ai-runtime.ts`; logic thuần (chunker/cleaning/dedup/ssrf/queue/status/source-repo) phủ unit ≥80%.

## Complexity Tracking

> Không có vi phạm Constitution cần biện minh. LanceDB (native) là dependency mới nhưng đã được ADR D2 phê
> duyệt từ đầu; là lựa chọn tối giản nhất cho kho vector cục bộ (phương án SQLite-BLOB tự tính cosine đã bị
> loại ở ADR LanceDB vì không có index ANN, không mở rộng).
