# Implementation Plan: Cải tiến RAG — rewrite + hybrid

**Branch**: `055-rag-enhance` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature spec `specs/20260713-092730-rag-enhance/spec.md`. Bám ADR `docs/04-decisions/2026-07-13-rag-enhance-clarify.md`.

## Summary

Nâng `retrieve()` (013): (1) **query rewriting** LLM local (giải tham chiếu chat history 027 + mở rộng)
trước truy xuất; (2) **hybrid** vector (LanceDB) + **BM25 (SQLite FTS5**, đã verify node:sqlite) → **RRF** →
**MMR** → ~6 chunk vào context. Giữ **kiểm chứng được** (chunk giữ locator, chip `[n]` chính xác). **Migration
#7** FTS5 external-content + backfill. KHÔNG đổi UI Chat. Không thêm binary/model (nhẹ về đóng gói).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Electron main.

**Primary Dependencies**: `node:sqlite` **FTS5** (bm25 + tokenizer `unicode61 remove_diacritics 2` — verify
tiếng Việt); LanceDB (013, thêm `getVectorsByIds` cho MMR); Ollama/provider active (031) cho rewrite +
embed. KHÔNG dependency mới.

**Storage**: `node:sqlite` — **migration #7**: `chunk_fts` (FTS5 **own-storage**, `tokenize='unicode61'`)
lưu **text đã fold tiếng Việt** (bỏ dấu + `đ→d` ở JS — vì `remove_diacritics` KHÔNG xử lý `đ`) + backfill
(fold trong migration). Đồng bộ tay ở source-repo insert/deleteChunks (rowid=chunk.rowid).

**Testing**: Vitest — thuần (fusion RRF/MMR, buildFtsMatch, buildRewritePrompt), keyword-store (SQLite
in-memory thật, khớp có/không dấu), retrieval hybrid (DI mock), migration #7. Rewrite I/O (LLM) → exclude
coverage + manual.

**Target Platform**: Desktop Electron (không đụng đóng gói — FTS5 sẵn trong node:sqlite, rewrite qua Ollama
sẵn có).

**Project Type**: Desktop app; feature ở `src/main/services/rag/` + `ingestion/` (keyword-store).

**Performance Goals**: rewrite +1 lượt LLM (fallback khi lỗi/timeout — 0% câu bị chặn); hybrid không thêm
lượt LLM; MMR/RRF thuần thuật toán (nhanh).

**Constraints**: Local-first (rewrite/embed/BM25 local; online rewrite → badge 031); kiểm chứng được bất
biến; main-only; không log nội dung; file <400 dòng; coverage ≥80%.

**Scale/Scope**: sửa `retrieve` + thêm 3 file thuần/nhỏ + migration #7 + đồng bộ FTS ở source-repo +
`getVectorsByIds` vector-store. Không đổi UI.

## Constitution Check

_GATE: pass trước Phase 0; re-check sau Phase 1._

- **I. Local-first & No Default Egress** — ✅ rewrite/embed/BM25 chạy local ở main. Rewrite dùng provider
  active (031): online bật → bọc `setOnline` badge (dùng CHUNG cơ chế 031, không egress ngầm). FTS5 +
  LanceDB cục bộ.
- **II. Verifiable Citations (BẤT BIẾN)** — ✅ rewrite/RRF/MMR CHỈ đổi **chunk nào chọn**; mỗi chunk giữ
  locator (013) → chip `[n]` map chính xác. Hybrid rỗng → "không tìm thấy" giữ nguyên. KHÔNG bịa.
- **III. Desktop Security Boundary** — ✅ retrieval + FTS + rewrite ở main; FTS MATCH build an toàn
  (escape/token — chống FTS injection); KHÔNG log câu hỏi/chunk.
- **IV. Test-First & Coverage** — ✅ hàm thuần (RRF/MMR/buildFtsMatch/buildRewritePrompt) test-first;
  keyword-store SQLite thật; retrieval DI.
- **V. Phased Delivery** — ✅ cải tiến trên lõi Pha 1 (013), không phá; không nhảy cóc.
- **Additional** — ✅ ADR + clarify (5); intake `docs/intake/055-rag-enhance.md`; migration #7 (FTS5 +
  backfill); security review (đụng retrieval + FTS query + LLM). Glossary: rewrite/hybrid/BM25/FTS5/RRF/MMR.

→ **Không vi phạm.** Complexity Tracking trống.

## Project Structure

### Documentation (this feature)

```text
specs/20260713-092730-rag-enhance/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (retrieval-hybrid.md, fts5-keyword.md)
└── tasks.md (/speckit-tasks)
```

### Source Code (repository root)

```text
src/main/services/rag/
├── fusion.ts               # MỚI (THUẦN): reciprocalRankFusion(lists, k=60) · mmrSelect(cands, qVec,
│                           #   lambda, n) cosine — crux, test kỹ.
├── rewrite.ts              # MỚI: buildRewritePrompt(question, history) THUẦN (test) + rewriteQuery(...)
│                           #   I/O gọi LLM (fallback câu gốc khi lỗi/rỗng; exclude coverage).
├── retrieval.ts            # SỬA: retrieve() hybrid — rewrite → embed+vector ∥ bm25 → RRF → getVectors →
│                           #   MMR ~6 → ScoredChunk[] (giữ locator). Fallback bm25→vector-only, rewrite→gốc.
├── rag-service.ts          # SỬA: truyền history vào retrieve; wire searchBm25 + rewrite (provider active
│                           #   + setOnline badge 031).
└── constants.ts            # SỬA: RRF_K=60, MMR_LAMBDA=0.7, HYBRID_BRANCH_TOPK=10 (giữ TOP_K/ngưỡng/budget).

src/main/services/ingestion/
├── fts-fold.ts             # MỚI (THUẦN): foldVietnamese(s) NFD+bỏ dấu+đ→d+lowercase (crux). buildFtsMatch
│                           #   (query) → fold → token → `"t1" OR "t2"` (escape). Test kỹ.
├── keyword-store.ts        # MỚI: createKeywordStore(db) → searchBm25(notebookId, query, topK)→{id,score}[]
│                           #   (FTS5 MATCH JOIN chunk+source lọc notebook, dùng fold+buildFtsMatch).
├── source-repo.ts          # SỬA: insertChunks ghi chunk_fts(rowid,fold(text)); deleteChunks DELETE chunk_fts.
└── vector-store.ts         # SỬA: +getVectorsByIds(ids)→Map<id,vector> (cho MMR).

src/main/db/migrations.ts   # SỬA: migration #7 — CREATE VIRTUAL TABLE chunk_fts (FTS5) + backfill 'rebuild'.
```

**Structure Decision**: Tách **thuần** (`fusion.ts` RRF/MMR — crux; `buildFtsMatch`/`buildRewritePrompt`)
khỏi **I/O** (`rewrite.ts` LLM, `keyword-store` SQLite). `retrieve()` là orchestrator (DI: embed, vector
search, searchBm25, getVectorsByIds, rewrite) → test bằng mock, không cần LanceDB/Ollama. FTS đồng bộ ở
source-repo (nơi đã ghi/xoá chunk) → không bỏ sót. **content_rowid = chunk.rowid ngầm** (bảng thường có
rowid); BM25 trả rowid → map về chunk.id.

## Complexity Tracking

> Không vi phạm Constitution — trống.
