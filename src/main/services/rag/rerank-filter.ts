// 109: quyết định đoạn nào giữ lại sau khi bộ chấm độ liên quan (cross-encoder reranker) cho điểm — hàm THUẦN dùng chung
// retrieve() (app) và công cụ đo (tests/eval). Chỉ chọn/sắp id; không đổi chunk/locator (Constitution II).
// Contract: specs/20261008-194015-unanswerable-detection/contracts/rerank-filter.md

export interface RerankConfig {
  /** Điểm tối thiểu (sigmoid 0..1, lớn = liên quan). */
  minScore: number;
  /** Loại đoạn có điểm < (điểm tốt nhất − delta); null = tắt. */
  relativeDelta: number | null;
  /** true ⇒ sắp theo điểm giảm dần trước MMR (hoà ⇒ thứ tự RRF); false ⇒ giữ thứ tự RRF. */
  reorder: boolean;
  /** Ngưỡng an toàn: chấm quá thời gian ⇒ bỏ qua bước chấm (fail-open). Không phải mục tiêu độ trễ. */
  timeoutMs: number;
}

export interface RerankResult {
  /** id giữ lại (⊆ fused) theo thứ tự sẽ đưa vào MMR. */
  ids: string[];
  /** điểm của các id giữ lại. */
  scoreOf: Map<string, number>;
}

/** Bước chấm chưa sẵn sàng (model chưa tải/nạp) — retrieve() bỏ qua bước chấm với lý do `notReady`. */
export class RerankNotReadyError extends Error {
  constructor() {
    super("Reranker not ready");
    this.name = "RerankNotReadyError";
  }
}

function assertUnit(name: string, v: number): void {
  if (!Number.isFinite(v) || v < 0 || v > 1) {
    throw new Error(`RerankConfig.${name} must be within [0, 1] (got ${v})`);
  }
}

/** Ném lỗi khi cấu hình ngoài miền. */
export function validateRerankConfig(cfg: RerankConfig): void {
  assertUnit("minScore", cfg.minScore);
  if (cfg.relativeDelta !== null)
    assertUnit("relativeDelta", cfg.relativeDelta);
  if (!Number.isFinite(cfg.timeoutMs) || cfg.timeoutMs <= 0) {
    throw new Error(
      `RerankConfig.timeoutMs must be a finite number > 0 (got ${cfg.timeoutMs})`,
    );
  }
}

/** Lọc (tuyệt đối + tương đối) và tuỳ chọn sắp lại `fused` theo điểm. Không mutate đầu vào; tất định. */
export function applyRerank(
  fused: readonly string[],
  scores: ReadonlyMap<string, number>,
  cfg: RerankConfig,
): RerankResult {
  const scored = fused
    .map((id, pos) => ({ id, pos, score: scores.get(id) }))
    .filter((x): x is { id: string; pos: number; score: number } =>
      Number.isFinite(x.score),
    );
  if (scored.length === 0) return { ids: [], scoreOf: new Map() };

  const best = Math.max(...scored.map((x) => x.score));
  const relLimit =
    cfg.relativeDelta === null ? -Infinity : best - cfg.relativeDelta;
  const kept = scored.filter(
    (x) => x.score >= cfg.minScore && x.score >= relLimit,
  );
  const ordered = cfg.reorder
    ? [...kept].sort((a, b) => b.score - a.score || a.pos - b.pos)
    : kept;
  return {
    ids: ordered.map((x) => x.id),
    scoreOf: new Map(ordered.map((x) => [x.id, x.score])),
  };
}
