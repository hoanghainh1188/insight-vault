# Contract — service reranker (main) + IPC trạng thái

Tệp: `src/main/services/rerank/rerank-model.ts` (I/O, loại khỏi coverage như `embed-model.ts`), `model-version.ts`, `status.ts` (thuần).

## `createReranker(opts) → Reranker`

```ts
opts: { cacheDir: string; model: string; modelFile?: string | null; setOnline?: (on: boolean, kind?: "model") => void }
interface Reranker {
  status(): RerankerStatus;            // "idle" | "downloading" | "ready" | "error"
  prefetch(): void;                     // tải/nạp nền, không ném; idempotent
  score(query: string, passages: { id: string; text: string }[]): Promise<Map<string, number>>; // ném NotReady khi chưa "ready"
}
```

- Nạp: `AutoTokenizer.from_pretrained(model)` + `AutoModelForSequenceClassification` (hoặc `AutoModel` nếu research R2 chốt) với `env.cacheDir`;
  trong lúc tải `setOnline(true, "model")`, xong/lỗi `setOnline(false, "model")`; `logEvent("rerank.model.load" | "rerank.model.error", { model })`.
- `score`: một lô cho mọi cặp, cắt `maxTokens` token/cặp (cổng #14: 256), `sigmoid(logits)`; gọi tuần tự qua hàng đợi (một phiên).
- `score` khi trạng thái ≠ `ready` ⇒ kích `prefetch()` và ném `RerankNotReadyError` (retrieve fail-open, `reason: "notReady"`).
- Seam: `IV_RERANK_FAKE=1` và `!app.isPackaged` ⇒ scorer tất định (điểm theo trùng từ khoá), không tải, `status() = "ready"`.
- Không log câu hỏi/đoạn văn.

## Kích hoạt tải nền

Main gọi `reranker.prefetch()` khi: (a) nhận sự kiện nguồn chuyển `ready` lần đầu trong phiên; (b) `retrieve()` gặp `notReady`. Chỉ khi
`RELEVANCE_CALIBRATION.rerank !== null`.

## IPC `ai:getRerankerStatus` (whitelist preload, chỉ đọc, không tham số)

- Trả `RerankerStatus | "unavailable"`.
- Renderer (Cài đặt › AI) hiện một dòng: khoá `ai.reranker.status.{unavailable,idle,downloading,ready,error}` (vi + en); làm mới khi mở Cài đặt và
  định kỳ khi đang `downloading` (dùng lại cơ chế kho trạng thái của #135 hoặc hook riêng nhẹ).
