import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RelevanceConfig } from "../../../src/main/services/rag/relevance-filter";
import type { EvalMetrics } from "../../../src/main/services/rag/relevance-calibration";
import type {
  FormatGroups,
  Histogram,
  PdfWarning,
  QuestionOutcome,
} from "./metrics";
import type { LlmResult } from "./harness";
import type { LlmSummary } from "./llm-metrics";
import type { RefusalSummary } from "./llm-sample";
import type { RerankModelReport } from "./rerank-run";
import type { RerankCause, RerankDiagnosis } from "./rerank-diagnose";
import type { RerankConfig } from "../../../src/main/services/rag/rerank-filter";

// 108: báo cáo công cụ đo — console + tests/eval/reports/<ts>/report.{json,md} (gitignore). I/O, không tính coverage.

export interface ConfigResult {
  config: RelevanceConfig;
  dev: EvalMetrics;
  holdout: EvalMetrics;
  en: EvalMetrics;
  avgRetrieveMs: number;
}

export interface EvalReport {
  runAt: string;
  mode: "sweep" | "current" | "single";
  embeddingModelVersion: string;
  datasetVersion: string;
  reviewed: { by: string; date: string } | null;
  configs: ConfigResult[];
  baseline: ConfigResult;
  /** cấu hình được chọn (chỉ chế độ sweep, chỉ khi bộ dữ liệu đã duyệt) */
  chosen?: {
    config: RelevanceConfig | null;
    reason: string;
    /** xác nhận trên hold-out (C2) — chỉ khi có cấu hình được chọn */
    holdoutCheck?: { pass: boolean; reasons: string[] };
  };
  /** SC-006: so độ trễ cấu hình (đang dùng/được chọn) với baseline trong cùng lần chạy */
  latency?: { baselineMs: number; candidateMs: number; increasePct: number };
  histograms: {
    answerHit: Histogram;
    answerMiss: Histogram;
    unanswerable: Histogram;
  };
  coldRetrieveMs: number;
  llm?: LlmResult;
  /** 109: đo bộ chấm độ liên quan theo model (EVAL_RERANK) */
  rerank?: RerankModelReport[];
  /** 177: PDF_EXTRACTION_VERSION lúc chạy */
  pdfExtractionVersion?: number;
  /** 177: số liệu câu vi theo định dạng × tập (THAM KHẢO — không vào cổng 108–109) */
  byFormat?: FormatGroups<EvalMetrics>;
  /** 177: cảnh báo nhóm PDF (cận trên Wilson 95% PDF < md) — không đổi mã thoát */
  pdfWarnings?: PdfWarning[];
  /**
   * 177 (điều tra T022): kết quả TỪNG câu (chỉ report.json) — `relevance`: cấu hình 108 hiện hành không bộ chấm (chế độ current);
   * `production`: cấu hình như app đang chạy (108 + bộ chấm 109 đã ghi). So lượt trước / sau theo questionId.
   */
  details?: {
    relevance?: QuestionOutcome[];
    production?: QuestionOutcome[];
  };
  /** 187: chẩn đoán bộ chấm trên đường app (EVAL_DETAILS=1) — câu có nguyên nhân ≠ ok + danh sách quan tâm */
  rerankDiagnosis?: RerankDiagnosis[];
  warnings: string[];
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const ci = ([lo, hi]: [number, number]) =>
  `[${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}]`;

export function describeConfig(c: RelevanceConfig): string {
  const parts = [`d≤${c.maxDistance}`];
  if (c.relativeDelta !== null) parts.push(`Δ${c.relativeDelta}`);
  if (c.bm25Gate === "vectorWithin") {
    parts.push(`bm25:within≤${c.bm25VectorMaxDistance}`);
  } else if (c.bm25Gate === "minScore") {
    parts.push(`bm25≤${c.bm25MaxScore}`);
  } else {
    parts.push(`bm25:${c.bm25Gate}`);
  }
  return parts.join(" ");
}

function row(label: string, r: ConfigResult): string {
  const m = (x: EvalMetrics) =>
    `${pct(x.correctRejection)} ${ci(x.ci95.correctRejection)} | ${pct(x.recallAt6)} ${ci(x.ci95.recallAt6)} | ${pct(x.recallAt1)} | ${x.mrr.toFixed(3)} | ${pct(x.falseRejection)}`;
  return `| ${label} | ${describeConfig(r.config)} | ${m(r.dev)} | ${m(r.holdout)} | ${pct(r.en.recallAt6)} / ${pct(r.en.correctRejection)} | ${r.avgRetrieveMs.toFixed(2)} |`;
}

function histMd(name: string, h: Histogram): string {
  const lines = h.counts
    .map((c, i) =>
      c > 0
        ? `  ${h.edges[i].toFixed(3)}–${h.edges[i + 1].toFixed(3)}: ${"█".repeat(c)} ${c}`
        : "",
    )
    .filter(Boolean);
  return [`**${name}**`, "```text", ...lines, "```"].join("\n");
}

/** Hàng nổi bật: baseline, cấu hình được chọn/đang dùng, + top theo Recall@6 dev trong nhóm từ chối đúng ≥ 90%. */
function highlights(r: EvalReport, limit = 15): [string, ConfigResult][] {
  const key = (c: RelevanceConfig) => JSON.stringify(c);
  const rows: [string, ConfigResult][] = [["baseline", r.baseline]];
  const chosen = r.chosen?.config
    ? r.configs.find((c) => key(c.config) === key(r.chosen!.config!))
    : undefined;
  if (chosen) rows.push(["**được chọn**", chosen]);
  if (r.mode !== "sweep") {
    for (const c of r.configs) {
      if (key(c.config) !== key(r.baseline.config)) rows.push(["đang đo", c]);
    }
    return rows;
  }
  const top = r.configs
    .filter((c) => c.dev.correctRejection >= 0.9)
    .sort((a, b) => b.dev.recallAt6 - a.dev.recallAt6)
    .slice(0, limit);
  for (const c of top) rows.push(["top", c]);
  return rows;
}

/** 177: một dòng bảng nhóm định dạng. */
function formatRow(split: string, fmt: string, x: EvalMetrics): string {
  return `| ${split} | ${fmt} | ${x.nAnswerable} | ${pct(x.recallAt1)} | ${pct(x.recallAt3)} | ${pct(x.recallAt6)} ${ci(x.ci95.recallAt6)} | ${x.mrr.toFixed(3)} | ${x.nUnanswerable} | ${pct(x.correctRejection)} |`;
}

/** 177 (contracts/report.md): mục "Nhóm PDF (tham khảo)"; không có dữ liệu PDF ⇒ rỗng (báo cáo như trước). Thuần. */
export function renderPdfSection(r: EvalReport): string[] {
  if (!r.byFormat) return [];
  const g = r.byFormat;
  const warn = (w: PdfWarning) =>
    `⚠️ Cảnh báo: ${w.split === "dev" ? "dev" : "hold-out"} — Recall@6 PDF ${pct(w.pdfRecallAt6)} (cận trên ${pct(w.pdfUpper95)}) thấp hơn Markdown ${pct(w.mdRecallAt6)} (n PDF = ${w.nPdf}).`;
  return [
    "## Nhóm PDF (tham khảo — không vào tiêu chí ĐẠT)",
    "",
    `Phiên bản trích xuất PDF: ${r.pdfExtractionVersion ?? "?"}`,
    "",
    "| Tập | Định dạng | n có đáp án | R@1 | R@3 | R@6 [CI95] | MRR | n không đáp án | Từ chối đúng |",
    "|---|---|---|---|---|---|---|---|---|",
    formatRow("dev", "md", g.md.dev),
    formatRow("dev", "pdf", g.pdf.dev),
    formatRow("hold-out", "md", g.md.holdout),
    formatRow("hold-out", "pdf", g.pdf.holdout),
    "",
    ...(r.pdfWarnings ?? []).map(warn),
    "Cỡ mẫu PDF nhỏ — đọc kèm khoảng tin cậy.",
    "",
  ];
}

const DIAG_CAUSES: readonly RerankCause[] = [
  "cutOff",
  "lowScoreInWindow",
  "rankedOut",
  "nearTopicHighScore",
  "notRetrieved",
];
const score3 = (x: number | null) => (x === null ? "—" : x.toFixed(3));

/** 187 (contracts/diagnostics.md): mục "Chẩn đoán bộ chấm"; không có ⇒ rỗng. Chỉ id / điểm — không in nội dung đoạn. Thuần. */
export function renderRerankDiagnosis(r: EvalReport): string[] {
  if (!r.rerankDiagnosis) return [];
  const ds = r.rerankDiagnosis;
  const row = (d: RerankDiagnosis) =>
    `| ${d.questionId} | ${d.type === "answerable" ? "có đáp án" : "không đáp án"} | ${d.split === "dev" ? "dev" : "hold-out"} | ${d.cause} | ${score3(d.bestScore)} | ${score3(d.answerScore)} | ${d.answerRrfRank ?? "—"} | ${d.quoteInWindow === null ? "—" : d.quoteInWindow ? "có" : "không"} |`;
  const total = DIAG_CAUSES.map(
    (c) => `${c} ${ds.filter((d) => d.cause === c).length}`,
  ).join(" · ");
  return [
    "## Chẩn đoán bộ chấm (cấu hình đã ghi — chỉ khi EVAL_DETAILS=1)",
    "",
    "| Câu | Loại | Tập | Nguyên nhân | Điểm cao nhất | Điểm đoạn đúng | Hạng RRF đoạn đúng | Đáp án trong cửa sổ token |",
    "|---|---|---|---|---|---|---|---|",
    ...ds.map(row),
    "",
    `Tổng theo nguyên nhân: ${total}`,
    "",
  ];
}

export function renderMarkdown(r: EvalReport): string {
  const head = [
    `# Báo cáo đánh giá truy xuất — ${r.runAt}`,
    "",
    `- Mô hình embedding: \`${r.embeddingModelVersion}\` · bộ dữ liệu v${r.datasetVersion} · chế độ \`${r.mode}\``,
    `- Duyệt: ${r.reviewed ? `${r.reviewed.by} (${r.reviewed.date})` : "**CHƯA DUYỆT**"}`,
    `- Số cấu hình đã đo: ${r.configs.length} · độ trễ retrieve() không cache: ${r.coldRetrieveMs.toFixed(1)} ms/câu`,
    ...r.warnings.map((w) => (w.startsWith("✓") ? `- ${w}` : `- ⚠️ ${w}`)),
    "",
  ];
  const chosen = r.chosen
    ? [
        "## Chọn cấu hình",
        "",
        `- ${r.chosen.config ? `\`${describeConfig(r.chosen.config)}\`` : "**không chọn được**"} — ${r.chosen.reason}`,
        ...(r.chosen.holdoutCheck
          ? [
              `- Xác nhận hold-out: ${r.chosen.holdoutCheck.pass ? "ĐẠT" : `**KHÔNG ĐẠT** — ${r.chosen.holdoutCheck.reasons.join("; ")}`}`,
            ]
          : []),
        "",
      ]
    : [];
  const latency = r.latency
    ? [
        "## Độ trễ (SC-006)",
        "",
        `- baseline ${r.latency.baselineMs.toFixed(3)} ms · cấu hình ${r.latency.candidateMs.toFixed(3)} ms · tăng ${r.latency.increasePct.toFixed(1)}%${r.latency.increasePct > 10 ? " ⚠️ > 10%" : ""}`,
        "",
      ]
    : [];
  const table = [
    "## Chỉ số",
    "",
    "Cột dev/hold-out: từ chối đúng [CI95] | Recall@6 [CI95] | Recall@1 | MRR | từ chối nhầm. Cột en: Recall@6 / từ chối đúng (tham khảo).",
    "",
    "| | cấu hình | dev | hold-out | en | ms |",
    "|---|---|---|---|---|---|",
    ...highlights(r).map(([l, c]) => row(l, c)),
    "",
  ];
  const llm = r.llm
    ? [
        "## End-to-end qua LLM (tham khảo — không xét ĐẠT)",
        "",
        ...("notFoundRate" in r.llm
          ? [
              `- model \`${r.llm.model}\`: ${pct(r.llm.notFoundRate)} câu hold-out có đáp án bị trả "không tìm thấy" (n=${r.llm.n})`,
              "",
              ...llmSummaryTable(r.llm.summary),
              ...(r.llm.refusals
                ? refusalsMd(r.llm.refusals, r.llm.repeats)
                : []),
            ]
          : [`- bỏ qua: ${r.llm.skipped}`]),
        "",
      ]
    : [];
  const hist = [
    "## Phân bố khoảng cách vector (hit tốt nhất)",
    "",
    histMd("Câu có đáp án — đoạn trúng", r.histograms.answerHit),
    histMd("Câu có đáp án — đoạn không trúng", r.histograms.answerMiss),
    histMd("Câu không có đáp án", r.histograms.unanswerable),
  ];
  return (
    [
      ...head,
      ...chosen,
      ...latency,
      ...table,
      ...renderPdfSection(r),
      ...renderRerankDiagnosis(r),
      ...(r.rerank ? rerankMd(r.rerank, r.baseline) : []),
      ...llm,
      ...hist,
    ].join("\n") + "\n"
  );
}

/** Ghi report.json + report.md vào `<outRoot>/<YYYYMMDD-HHmmss>/`; trả thư mục. */
export function writeReport(r: EvalReport, outRoot: string): string {
  const d = new Date(r.runAt);
  const p2 = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  const dir = join(outRoot, stamp);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "report.json"), JSON.stringify(r, null, 2));
  writeFileSync(join(dir, "report.md"), renderMarkdown(r));
  return dir;
}

/** 123 (SC-006): bảng phần LLM theo ngôn ngữ câu hỏi (vi = hold-out, en = mọi câu English). */
function llmSummaryTable(sum: LlmSummary): string[] {
  const p = (v: number | null): string => (v === null ? "—" : pct(v));
  const row = (lang: "vi" | "en"): string => {
    const g = sum[lang];
    return `| ${lang} | ${g.answerable} | ${p(g.citedRate)} | ${p(g.falseNotFoundRate)} | ${p(g.languageMatchRate)} (n=${g.languageDetected}) | ${g.unanswerable} | ${p(g.correctRefusalRate)} |`;
  };
  return [
    '| Nhóm | Có đáp án | Có [n] hợp lệ | Trả nhầm "không tìm thấy" | Đúng ngôn ngữ | Không đáp án | Từ chối đúng |',
    "|---|---|---|---|---|---|---|",
    row("vi"),
    row("en"),
  ];
}

/** 205: câu không đáp án qua nhiều lần chạy — số lần từ chối đúng + câu trả lời lọt (đọc tay xem có bịa không). */
function refusalsMd(rows: RefusalSummary[], repeats: number): string[] {
  const out = [
    "",
    `### Câu không đáp án qua tầng trả lời (${repeats} lần/câu)`,
    "",
    "| Câu | Từ chối đúng | Lọt |",
    "|---|---|---|",
    ...rows.map(
      (x) =>
        `| ${x.questionId} | ${x.refused}/${x.runs} | ${x.leaked.length} |`,
    ),
  ];
  for (const x of rows.filter((y) => y.leaked.length > 0)) {
    out.push("", `**${x.questionId}** — câu trả lời lọt:`);
    for (const l of x.leaked) {
      const a = l.answer.replace(/\s+/g, " ").slice(0, 300);
      out.push(`- (${l.citationCount} [n]) ${a}`);
    }
  }
  return out;
}

export function describeRerank(c: RerankConfig): string {
  const parts = [`s≥${c.minScore}`];
  if (c.relativeDelta !== null) parts.push(`Δ${c.relativeDelta}`);
  if (c.reorder) parts.push("sắp lại");
  return parts.join(" ");
}

/** 109: mục bộ chấm độ liên quan — mỗi model: kết luận cổng, cấu hình chọn, độ trễ, Pareto dev. */
function rerankMd(
  models: RerankModelReport[],
  baseline: ConfigResult,
): string[] {
  const m = (x: EvalMetrics) =>
    `${pct(x.correctRejection)} ${ci(x.ci95.correctRejection)} | ${pct(x.recallAt6)} ${ci(x.ci95.recallAt6)}`;
  const out = [
    "## Bộ chấm độ liên quan (109)",
    "",
    `Mốc cùng lượt (không chấm): dev ${m(baseline.dev)} · hold-out ${m(baseline.holdout)} · en ${m(baseline.en)}`,
    "",
  ];
  for (const r of models) {
    const v = r.variant ?? {};
    const variant = [
      v.topN !== undefined ? `top-${v.topN}` : "",
      v.maxLength !== undefined ? `${v.maxLength} token` : "",
    ]
      .filter(Boolean)
      .join(", ");
    out.push(
      `### \`${r.model}\`${r.modelFile ? ` (\`${r.modelFile}\`)` : ""}${variant ? ` — ${variant}` : ""}`,
      "",
    );
    if (r.error) {
      out.push(`- **Không nạp được**: ${r.error}`, "");
      continue;
    }
    const l = r.latency!;
    out.push(
      `- Kết luận cổng: **${r.gate?.verdict ?? "KHÔNG ĐẠT"}**${r.gate && r.gate.reasons.length ? ` — ${r.gate.reasons.join("; ")}` : ""}`,
      `- Chọn trên dev: ${r.choice?.chosen ? `\`${describeRerank(r.choice.chosen)}\`` : "không chọn được"} — ${r.choice?.reason ?? ""}`,
      ...(r.chosen
        ? [
            `- Cấu hình chọn: dev ${m(r.chosen.dev)} · hold-out ${m(r.chosen.holdout)} · en ${m(r.chosen.en)} · Wilson vi gộp ${pct(r.gate!.wilsonLower)} (${r.chosen.viRejected.successes}/${r.chosen.viRejected.n})`,
            `- Chênh lệch vi−en: từ chối đúng ${pct(r.gate!.langGap.correctRejection)}, Recall@6 ${pct(r.gate!.langGap.recallAt6)}`,
          ]
        : []),
      `- Độ trễ chấm/câu: p50 ${l.p50Ms.toFixed(0)} ms · p95 ${l.p95Ms.toFixed(0)} ms · nạp ${l.coldLoadMs.toFixed(0)} ms · RSS +${l.rssDeltaMb.toFixed(0)} MB · event loop chặn tối đa ${l.eventLoopP99Ms.toFixed(0)} ms${r.skips ? ` · ⚠️ bỏ qua ${r.skips} lần` : ""}`,
      "",
      "Pareto trên dev (từ chối đúng | Recall@6):",
      "",
      "| cấu hình | dev | hold-out | en |",
      "|---|---|---|---|",
      ...(r.choice?.pareto ?? []).slice(0, 12).map((p) => {
        const full = r.results.find(
          (x) => JSON.stringify(x.config) === JSON.stringify(p.config),
        )!;
        return `| ${describeRerank(p.config)} | ${m(full.dev)} | ${m(full.holdout)} | ${m(full.en)} |`;
      }),
      "",
    );
  }
  return out;
}
