import { describe, it, expect } from "vitest";
import {
  renderMarkdown,
  renderPdfSection,
  type ConfigResult,
  type EvalReport,
} from "../eval/lib/report";
import type { EvalMetrics } from "../../src/main/services/rag/relevance-calibration";
import { BASELINE_CONFIG } from "../eval/lib/grid";

// 177 (T017, contracts/report.md): mục "Nhóm PDF (tham khảo)" trong báo cáo — phiên bản trích xuất, bảng md / pdf × dev / hold-out,
// cảnh báo chỉ khi có, ghi chú cỡ mẫu nhỏ; báo cáo không có dữ liệu PDF giữ nguyên như trước.

const m = (
  recallAt6: number,
  nAnswerable = 10,
  nUnanswerable = 2,
): EvalMetrics => ({
  nAnswerable,
  nUnanswerable,
  recallAt1: recallAt6,
  recallAt3: recallAt6,
  recallAt6,
  mrr: recallAt6 / 2,
  correctRejection: 1,
  falseRejection: 0,
  ci95: { recallAt6: [0.5, 0.9], correctRejection: [0.3, 1] },
});

const cfg: ConfigResult = {
  config: BASELINE_CONFIG,
  dev: m(0.9),
  holdout: m(0.9),
  en: m(0.9),
  avgRetrieveMs: 1,
};
const hist = { edges: [0, 1], counts: [0] };

const base = (over: Partial<EvalReport> = {}): EvalReport => ({
  runAt: "2026-10-12T00:00:00.000Z",
  mode: "current",
  embeddingModelVersion: "e5",
  datasetVersion: "4",
  reviewed: null,
  configs: [cfg],
  baseline: cfg,
  histograms: { answerHit: hist, answerMiss: hist, unanswerable: hist },
  coldRetrieveMs: 1,
  warnings: [],
  ...over,
});

const withPdf = (warn: boolean): EvalReport =>
  base({
    pdfExtractionVersion: 3,
    byFormat: {
      md: { dev: m(0.95, 40, 10), holdout: m(0.9, 18, 6) },
      pdf: { dev: m(0.8, 12, 4), holdout: m(0.6, 5, 2) },
    },
    pdfWarnings: warn
      ? [
          {
            split: "holdout",
            pdfRecallAt6: 0.6,
            pdfUpper95: 0.83,
            mdRecallAt6: 0.9,
            nPdf: 5,
          },
        ]
      : [],
  });

describe("renderPdfSection", () => {
  it("không có dữ liệu PDF ⇒ rỗng; renderMarkdown không có mục PDF", () => {
    expect(renderPdfSection(base())).toEqual([]);
    expect(renderMarkdown(base())).not.toContain("Nhóm PDF");
  });

  it("có dữ liệu PDF ⇒ tiêu đề tham khảo, phiên bản trích xuất, 4 dòng bảng, ghi chú cỡ mẫu", () => {
    const md = renderPdfSection(withPdf(false)).join("\n");
    expect(md).toContain("## Nhóm PDF (tham khảo — không vào tiêu chí ĐẠT)");
    expect(md).toContain("Phiên bản trích xuất PDF: 3");
    for (const [split, fmt] of [
      ["dev", "md"],
      ["dev", "pdf"],
      ["hold-out", "md"],
      ["hold-out", "pdf"],
    ]) {
      expect(md).toMatch(new RegExp(`\\| ${split} \\| ${fmt} \\| `));
    }
    expect(md).toContain(
      "| hold-out | pdf | 5 | 60.0% | 60.0% | 60.0% [50–90] | 0.300 | 2 | 100.0% |",
    );
    expect(md).toContain("Cỡ mẫu PDF nhỏ — đọc kèm khoảng tin cậy.");
    expect(md).not.toContain("⚠️");
  });

  it("có cảnh báo ⇒ dòng ⚠️ nêu tập, Recall@6 PDF, cận trên, Markdown", () => {
    const md = renderPdfSection(withPdf(true)).join("\n");
    expect(md).toContain(
      "⚠️ Cảnh báo: hold-out — Recall@6 PDF 60.0% (cận trên 83.0%) thấp hơn Markdown 90.0% (n PDF = 5).",
    );
  });

  it("renderMarkdown chèn mục PDF khi có dữ liệu", () => {
    expect(renderMarkdown(withPdf(true))).toContain("## Nhóm PDF");
  });
});
