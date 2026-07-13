# Tasks: Cải tiến RAG — rewrite + hybrid

**Feature**: `055-rag-enhance` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Ghi chú**: Tests BẮT BUỘC (Constitution IV). `[P]` = song song. FTS5 verify thật (node:sqlite); rewrite
LLM → mock/DI + manual. KHÔNG đóng gói (không binary/model).

## Phase 1: Setup

- [x] T001 `src/main/services/rag/constants.ts`: thêm `RRF_K=60`, `MMR_LAMBDA=0.7`, `HYBRID_BRANCH_TOPK=10` (giữ TOP_K/ngưỡng/budget).

## Phase 2: Foundational (FTS index + fold + fusion + vectors — chặn mọi US)

- [x] T002 Migration #7 `src/main/db/migrations.ts`: `CREATE VIRTUAL TABLE chunk_fts USING fts5(text, tokenize='unicode61')` + backfill (duyệt chunk → fold → INSERT rowid+text). Test-first `tests/unit/migration-fts.test.ts` (bảng tồn tại; backfill đếm đúng; đồng bộ delete).
- [x] T003 [P] Test-first `tests/unit/fts-fold.test.ts`: `foldVietnamese` (bỏ dấu + đ→d + lowercase; giữ số) + `buildFtsMatch` (token OR, escape `"`, ký tự đặc biệt không phá FTS, rỗng→"").
- [x] T004 Cài `src/main/services/ingestion/fts-fold.ts` (foldVietnamese + buildFtsMatch) cho GREEN.
- [x] T005 Test-first `tests/unit/keyword-store.test.ts` (SQLite in-memory THẬT + FTS + backfill): `searchBm25` khớp có/không dấu (kể cả đ), lọc đúng notebook (JOIN source), xếp theo bm25; FTS chưa có → ném.
- [x] T006 Cài `src/main/services/ingestion/keyword-store.ts` (`createKeywordStore(db).searchBm25`) cho GREEN.
- [x] T007 `src/main/services/ingestion/source-repo.ts`: insertChunks ghi `chunk_fts(rowid, fold(text))`; deleteChunks DELETE `chunk_fts` theo rowid TRƯỚC khi xoá chunk. Bổ sung test source-repo (chunk_fts đồng bộ khi thêm/xoá).
- [x] T008 [P] Test-first `tests/unit/fusion.test.ts`: `reciprocalRankFusion` (id đầu cả 2 list→top; dedup) + `mmrSelect` (loại gần-trùng, ≤n, cand thiếu vector giữ theo order).
- [x] T009 Cài `src/main/services/rag/fusion.ts` (RRF + MMR cosine) cho GREEN.
- [x] T010 `src/main/services/ingestion/vector-store.ts`: `getVectorsByIds(ids)→Map<id,vector>` (LanceDB where id IN). Bổ sung test/DI cho retrieval.

**Checkpoint**: FTS keyword + fold + fusion + vectors sẵn sàng.

## Phase 3: User Story 2 — Keyword chính xác (hybrid) (P1) 🎯 MVP hybrid

- [x] T011 [US2] Test-first `tests/unit/retrieval-hybrid.test.ts` (DI mock embed/search/searchBm25/getVectorsByIds): hợp nhất RRF đúng; searchBm25 ném → vector-only; fused rỗng → []; ScoredChunk giữ locator; MMR chọn ≤ TOP_K.
- [x] T012 [US2] `src/main/services/rag/retrieval.ts`: retrieve() hybrid (embed(q) + vector ∥ searchBm25 → RRF → getVectorsByIds → MMR → ScoredChunk giữ locator; fallback vector-only khi bm25 lỗi). DI thêm searchBm25/getVectorsByIds.
- [x] T013 [US2] `src/main/services/rag/rag-service.ts` + `src/main/index.ts`: wire searchBm25 (keyword-store) + getVectorsByIds (vectorStore) vào retrieve.

**Checkpoint**: hybrid vector+BM25 hoạt động; keyword chính xác + không dấu.

## Phase 4: User Story 1 — Query rewriting nối tiếp (P1)

- [x] T014 [US1] Test-first `tests/unit/rewrite-prompt.test.ts`: `buildRewritePrompt(question, history)` → messages gồm history + câu hỏi + chỉ dẫn (giải tham chiếu, giữ câu rõ, chỉ trả truy vấn).
- [x] T015 [US1] Cài `src/main/services/rag/rewrite.ts`: `buildRewritePrompt` (thuần) + `rewriteQuery(question, history, chat, setOnline?)` (I/O gọi LLM; rỗng/lỗi/timeout → câu gốc).
- [x] T016 [US1] `retrieval.ts` + `rag-service.ts`: retrieve nhận history + rewrite trước embed/search; wire rewrite (provider active + setOnline badge 031) + truyền chat history (027). Bổ sung test retrieval (rewrite ném → câu gốc).

**Checkpoint**: câu nối tiếp giải tham chiếu đúng; fallback an toàn.

## Phase 5: User Story 3 — Đa dạng (MMR) (P2)

- [x] T017 [US3] Xác nhận MMR (fusion T009 + retrieve T012) giảm gần-trùng; bổ sung test retrieval case nhiều cand gần-trùng → context đa dạng (đã phủ phần lớn ở T008/T011; thêm assert nếu thiếu).

**Checkpoint**: 3 US hoàn tất, kiểm độc lập.

## Phase 6: Polish & Cross-Cutting

- [x] T018 [P] ADR `2026-07-13-rag-enhance-clarify.md` + INDEX (đã có) — xác nhận khớp; glossary append query rewriting/hybrid search/BM25/FTS5/RRF/MMR/fold tiếng Việt.
- [x] T019 Gate: `npm run lint` + `npm run test` (≥80%) + `npm run build` + e2e (rag-qa/security/no-egress/chat-history) xanh (không đổi UI/kênh).
- [x] T020 Kiểm thử thủ công `quickstart.md`: US1 nối tiếp · US2 keyword có/không dấu · US3 đa dạng · kiểm chứng chip [n] · fallback · egress (cần Ollama).

## Dependencies & Execution Order

- Setup (T001) → Foundational (T002–T010) trước mọi US.
- **US2 (T011–T013)** = MVP hybrid, cần Foundational (FTS/fold/fusion/vectors).
- **US1 (T014–T016)** cần retrieve của US2 (thêm rewrite phía trước). US3 (T017) dựa MMR (đã có).
- Polish (T018–T020) sau cùng.

## Parallel Execution Examples

- Foundational: T003 (fold test) ∥ T008 (fusion test) — file khác.
- T002 (migration) ∥ T003/T008 (test thuần) trước phần cài.

## Implementation Strategy

- **MVP = US2** (hybrid keyword) — giá trị lớn cho tra cứu chính xác; ship được sau Phase 3.
- US1 (rewrite) thêm phía trước retrieve — ngang P1, làm ngay sau.
- Rủi ro FTS tiếng Việt (đ) ĐÃ gỡ ở plan (own-storage + fold, verify thật). Không đóng gói.
