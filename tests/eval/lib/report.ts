import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RelevanceConfig } from "../../../src/main/services/rag/relevance-filter";
import type { EvalMetrics } from "../../../src/main/services/rag/relevance-calibration";
import type { Histogram } from "./metrics";
import type { LlmResult } from "./harness";
import type { LlmSummary } from "./llm-metrics";

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
    [...head, ...chosen, ...latency, ...table, ...llm, ...hist].join("\n") +
    "\n"
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
