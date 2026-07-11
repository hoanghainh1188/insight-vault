# Research — Studio (021-studio)

Mọi ambiguity đã chốt trước ở `docs/04-decisions/2026-07-11-studio-clarify.md` +
`2026-07-11-studio-context-strategy.md` (không còn NEEDS CLARIFICATION). Mục này ghi các quyết định kỹ
thuật + xác nhận hình dạng code tái dùng (đọc trực tiếp source 007/011/013).

## R1 — Gom ngữ cảnh toàn notebook (không cần đụng 011)

- **Decision**: `studio-service` gom chunk ở **tầng service** bằng API `source-repo` sẵn có:
  `listByNotebook(notebookId)` → lọc `status === "ready"` (đã ORDER BY `created_at ASC`), mỗi source gọi
  `listChunks(sourceId)` (theo `ordinal`), map mỗi chunk → `ScoredChunk { chunk, sourceTitle: source.title,
score: 0 }`. Đưa mảng theo thứ tự (source.created_at → chunk.ordinal) vào `buildContext`.
- **Rationale**: `buildContext` cần `sourceTitle` từng chunk; đi qua `listByNotebook` lấy được `title` +
  lọc `ready` MIỄN PHÍ, không cần JOIN mới. **KHÔNG thêm `listChunksByNotebook` vào 011** → blast radius = 0
  cho ingestion. `buildContext` KHÔNG sort (iterate đúng thứ tự truyền vào) → thứ tự tài liệu tự nhiên giữ
  nguyên.
- **Alternatives**: (a) thêm `listChunksByNotebook` JOIN vào `source-repo` — mất `sourceTitle` hoặc phải
  join thêm bảng source, đụng file 011; (b) map-reduce nhiều lượt — chậm, citation trỏ tóm tắt trung gian
  (lệch Constitution II). Cả hai loại bỏ.

## R2 — Ngân sách ngữ cảnh riêng cho Studio

- **Decision**: Thêm tham số tuỳ chọn `budget` cho `buildContext(scored, budget = CONTEXT_CHAR_BUDGET)`
  trong `src/main/services/rag/context-builder.ts`. Studio gọi `buildContext(scored, STUDIO_CONTEXT_BUDGET)`
  với `STUDIO_CONTEXT_BUDGET = 8000` (hằng trong `src/main/services/studio/`).
- **Rationale**: `buildContext` hiện hardcode `CONTEXT_CHAR_BUDGET = 6000` (import từ `rag/constants`).
  Thêm tham số mặc-định-cũ là **additive không phá vỡ** (mọi caller rag hiện tại giữ nguyên 6000). Studio
  tổng hợp toàn tài liệu nên ngân sách rộng hơn (8000) hợp lý mà vẫn dưới context window model local.
- **Alternatives**: (a) viết context-builder riêng cho Studio — nhân bản logic ngân sách + đánh số +
  bỏ-nguyên-chunk (dễ lệch với rag); (b) dùng chung 6000 — trái ADR (đã chốt ~8000). Chọn thêm param.

## R3 — Citation (tái dùng hậu kiểm 013)

- **Decision**: Sau `chat`, gọi `postprocessCitations(rawAnswer, map)` (gỡ chip ngoài `[1..k]`, dựng
  `Citation[]`). Nếu `citations.length === 0` nhưng answer có nội dung (không rỗng) → dùng
  `citationsFromMap(map)` gắn toàn bộ nguồn đã đưa vào ngữ cảnh.
- **Rationale**: Đồng nhất "kiểm chứng được" với rag-qa grounded fallback (#17). `Citation` +
  `RetrievedChunk` tái dùng nguyên → chip mở Source Viewer qua `openCitation` (019) không cần map thêm.
- **Xác nhận code**: `postprocessCitations` trả `{answer, citations}`; `citationsFromMap` trả `Citation[]`
  theo `n`. Cả hai THUẦN, đã có test 013.

## R4 — Prompt theo loại (studio/prompt.ts)

- **Decision**: `systemPromptFor(kind)` trả 4 system prompt. Khung chung: "Bạn tổng hợp từ các đoạn nguồn
  ĐÁNH SỐ `[n]` dưới đây. CHÈN `[n]` ngay sau ý lấy từ nguồn tương ứng. CHỈ dùng nội dung trong các đoạn,
  KHÔNG bịa. Trả lời bằng tiếng Việt." Phần riêng: summary (đoạn/gạch đầu dòng ngắn gọn); keyPoints (danh
  sách ý chính, mỗi ý một dòng "- "); faq (các cặp "Hỏi: … / Đáp: … [n]"); outline (dàn ý thụt cấp).
- **Rationale**: Khác biệt 4 loại nằm ở hướng dẫn định dạng, chung kiến trúc ngữ cảnh/citation. Prompt là
  hàm thuần → test phủ 4 kind + chứa yêu cầu "[n]" + "không bịa".
- **Note**: KHÔNG tái dùng `rag/prompt.ts` (prompt hỏi-đáp 2 chế độ, ngữ nghĩa khác). Studio có prompt
  riêng.

## R5 — Gọi LLM (tái dùng 007)

- **Decision**: `studio-service` nhận `ProviderRegistry`; lấy provider hiện hành → `provider.chat(system,
user)` hoặc theo chữ ký `chat` hiện có (messages). Kiểm runtime trước: nếu `getRuntimeStatus`/provider
  chưa ready → ném lỗi thân thiện (không sinh nội dung). Dùng chat timeout 120s đã cấu hình (007/#15).
- **Rationale**: Không thêm client mới; Studio chỉ là một người tiêu thụ `LLMProvider.chat`. Xác nhận chữ
  ký `chat` khi implement (đọc `ProviderRegistry`/`LLMProvider`).

## R6 — Lưu trữ (migration #3, studio_result)

- **Decision**: Migration #3 (PRAGMA user_version 2→3, append-only theo runner 011). Bảng:
  `studio_result(id TEXT PK, notebook_id TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
kind TEXT NOT NULL CHECK(kind IN ('summary','keyPoints','faq','outline')), content TEXT NOT NULL,
citations_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
UNIQUE(notebook_id, kind))`. `studio-repo.upsert` dùng `INSERT … ON CONFLICT(notebook_id,kind) DO UPDATE`.
- **Rationale**: UNIQUE bảo đảm "1 bản mới nhất mỗi loại/notebook" (FR-008); FK CASCADE bảo đảm xoá theo khi
  xoá notebook (FR-009). `citations_json` lưu `Citation[]` serialize (kèm locator) để card khôi phục chip
  mà không phải sinh lại.
- **Alternatives**: giữ lịch sử nhiều bản (thêm cột version) — ngoài phạm vi MVP (chỉ 1 bản/loại). Loại bỏ.
- **Xác nhận**: FK CASCADE cần `PRAGMA foreign_keys = ON` (011 đã bật ở kết nối). Test cascade bằng
  `:memory:` chạy đủ migration #1→#3.

## R7 — Ranh giới IPC & bảo mật (Constitution III)

- **Decision**: 2 kênh invoke whitelisted `studio:generate`, `studio:list` qua `safeHandle` (không
  catch-all). Renderer chỉ nhận `StudioResult` (text + citations) — KHÔNG nhận vector/chunk thô ngoài phần
  đã nằm trong citation. `register.ts` KHÔNG log `content`/`citations` (chỉ log id/kind/notebookId +
  lỗi label).
- **Rationale**: Trả text để HIỂN THỊ (người dùng chủ động tạo) là hợp lệ như `source:getContent` (019).
  Vector thô không bao giờ ra renderer.

## R8 — Render an toàn (Constitution III / FR-015)

- **Decision**: `StudioResultCard` render `content` dạng **text + chip** như `MessageBubble` (013): tách
  chuỗi theo `[\d+]`, render text node React + chip là `<button>` — KHÔNG `innerHTML`/`dangerouslySet…`.
  `white-space: pre-wrap` giữ gạch đầu dòng/thụt cấp. Nếu logic tách chip trong `MessageBubble` đủ tổng
  quát → tách helper thuần sang `renderer/shared` để dùng chung (không bắt buộc).
- **Rationale**: Nội dung do LLM sinh là dữ liệu không tin cậy → không chèn HTML thô. Nhất quán chat.

## R9 — Trạng thái UI (tái dùng 007)

- **Decision**: `StudioColumn` nhận `hasReadySources` (Workspace suy từ danh sách nguồn) + `ollamaReady`
  (RuntimeStatus 007). Nút vô hiệu khi `!hasReadySources || !ollamaReady`; banner inline giải thích. Trạng
  thái `loading[kind]` khi đang tạo; `error[kind]` khi lỗi.
- **Rationale**: Tái dùng đúng tín hiệu đã có ở chat (block khi chưa sẵn sàng), nhất quán trải nghiệm.

## Tổng kết

Không NEEDS CLARIFICATION còn lại. Không thêm dependency. Thay đổi 013 duy nhất: **tham số `budget` tuỳ
chọn** cho `buildContext` (additive). Migration #3 độc lập. Điểm chạm 011 = 0.
