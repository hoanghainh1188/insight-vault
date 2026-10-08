# Data Model — 109

Không đổi schema SQLite/LanceDB. Thay đổi là kiểu TypeScript + bộ đánh giá.

## RerankConfig (mới — `src/main/services/rag/rerank-filter.ts`)

| Trường          | Kiểu           | Ràng buộc                                                  |
| --------------- | -------------- | ---------------------------------------------------------- |
| `minScore`      | number         | 0 ≤ x ≤ 1 (điểm sigmoid)                                   |
| `relativeDelta` | number \| null | null = tắt; 0 ≤ x ≤ 1; giữ đoạn có điểm ≥ best − delta     |
| `reorder`       | boolean        | true ⇒ sắp theo điểm giảm dần trước MMR (hoà ⇒ thứ tự RRF) |
| `timeoutMs`     | number         | > 0, hữu hạn; quá ⇒ fail-open                              |

`validateRerankConfig(cfg)` ném lỗi khi ngoài miền.

## RerankScores / RerankResult

- Đầu vào hàm thuần: `fused: string[]` (thứ tự RRF), `scores: ReadonlyMap<string, number>` (id → điểm; id thiếu điểm ⇒ coi như không đạt).
- `applyRerank(fused, scores, cfg) → { ids: string[]; scoreOf: Map<string, number> }` — không mutate đầu vào; `ids` ⊆ `fused`.

## ScoredChunk (mở rộng)

| Trước                           | Sau                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `{ chunk, sourceTitle, score }` | `{ chunk, sourceTitle, score, rerankScore? }` — `score` vẫn là cosine distance; `rerankScore` chỉ có khi bước rerank chạy |

## RetrievalDeps (mở rộng, tuỳ chọn)

- `rerank?: (query: string, passages: { id: string; text: string }[]) => Promise<Map<string, number>>` — thiếu ⇒ hành vi 108.
- `onRerankSkip?: (reason: "notReady" | "timeout" | "error") => void` — để main ghi `logEvent` (không nội dung).

## RelevanceCalibration (mở rộng — `relevance-calibration.ts`)

| Trường mới       | Kiểu                        | Ghi chú                                                                   |
| ---------------- | --------------------------- | ------------------------------------------------------------------------- |
| `rerank`         | `RerankCalibration \| null` | null ⇒ không rerank (trạng thái trước tích hợp / khi không hướng nào đạt) |
| `datasetVersion` | `"3"` sau hiệu chuẩn        | khớp `tests/eval/questions.json` (test canh giữ)                          |

`RerankCalibration = { model: string; modelFile: Partial<Record<"arm64" | "x64", string>> | null; modelVersion: string; config: RerankConfig;
metrics: { dev: EvalMetrics; holdout: EvalMetrics; en: EvalMetrics } ; latency: { coldLoadMs: number; p50Ms: number; p95Ms: number } }`.
`RERANK_MODEL_VERSION` (hằng, `src/main/services/rerank/model-version.ts`) — đổi model ⇒ test canh giữ fail.

## RerankerStatus (mới — IPC chỉ đọc)

`"unavailable" | "idle" | "downloading" | "ready" | "error"` — `unavailable` khi `RELEVANCE_CALIBRATION.rerank === null`.
Chuyển trạng thái: `idle → downloading → ready`; `downloading → error`; `error → downloading` (lần thử sau). Renderer hiển thị qua khoá i18n
`ai.reranker.status.<state>`.

## EvalQuestion / Dataset (bộ đánh giá)

Không đổi cấu trúc. `datasetVersion: "3"`; thêm 12 câu `vi` + 3 câu `en` `type: "unanswerable"` (`quotes: []`, `docIds: []`); `reviewed: null`
cho tới khi chủ dự án duyệt.

## EvalReport (mở rộng)

Thêm mục `rerank` theo model: bảng cấu hình (CR/R@6 dev, hold-out, en, CI95), cấu hình chọn, độ trễ (nạp nguội, p50/p95, RSS, event loop p99),
kết luận ĐẠT/KHÔNG ĐẠT theo R6. Tuỳ chọn mục `judge` (hướng b).
