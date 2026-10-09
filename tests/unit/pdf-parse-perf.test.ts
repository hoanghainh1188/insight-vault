import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { parsePdf } from "../../src/main/services/ingestion/parsers/pdf";
import { makePdf } from "../fixtures/pdf/make-pdf";
import {
  borderlessTable,
  decimalTable,
  financialTable,
  rotatedSample,
  twoColumns,
} from "../fixtures/pdf/samples";

// 112 (SC-006): thời gian trích PDF có bố cục ≤ 2 lần cách nối cũ trên cùng tệp. Local: assert; CI: chỉ log số đo
// (máy CI dao động) trừ khi PDF_PERF_STRICT=1.

async function legacyParse(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: bytes,
    useWorkerFetch: false,
    useSystemFonts: false,
  }).promise;
  const out: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const c = await (await doc.getPage(p)).getTextContent();
    out.push(c.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  await doc.cleanup();
  return out;
}

async function best(fn: () => Promise<unknown>, runs = 3): Promise<number> {
  let min = Infinity;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    min = Math.min(min, performance.now() - t0);
  }
  return min;
}

describe("SC-006 — hiệu năng trích PDF có bố cục", () => {
  it("50 trang (2 cột + bảng + trang xoay + bảng số) ⇒ mới ≤ 2× cũ", async () => {
    // 147: mẫu hỗn hợp có thêm trang /Rotate 90 (xoay qua viewport) — đo cả chi phí xoay trang.
    // 147 (b): thêm bảng số căn phải / căn thập phân — đo chi phí đường phụ nhận bảng số.
    const kinds = [
      () => twoColumns().pages[0],
      () => borderlessTable().pages[0],
      () => rotatedSample(twoColumns(), 90).pages[0],
      () => financialTable().pages[0],
      () => decimalTable().pages[0],
    ];
    const pages = Array.from({ length: 50 }, (_, i) =>
      kinds[i % kinds.length](),
    );
    const bytes = makePdf(pages);
    await legacyParse(bytes.slice()); // làm ấm pdf.js (pdf.js chuyển quyền buffer ⇒ mỗi lần dùng bản sao)
    const oldMs = await best(() => legacyParse(bytes.slice()));
    const newMs = await best(() => parsePdf(bytes.slice()));
    const ratio = newMs / oldMs;
    process.stdout.write(
      `[SC-006] cũ ${oldMs.toFixed(1)} ms · mới ${newMs.toFixed(1)} ms · tỉ lệ ${ratio.toFixed(2)}×\n`,
    );
    const strict = !process.env.CI || process.env.PDF_PERF_STRICT === "1";
    if (strict) expect(ratio).toBeLessThanOrEqual(2);
  });
});
