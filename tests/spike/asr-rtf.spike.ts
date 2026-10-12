import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { describe, it, expect, beforeAll } from "vitest";
import * as tf from "@huggingface/transformers";
import { LANG_SAMPLES } from "./lang-samples";

// 186 — spike S2 (research R2, task T071): đo RTF Whisper (tiny/base × q8/fp32) cho cửa sổ nháp 10 s và phân đoạn chốt 5 phút,
// rồi thử phát hiện ngôn ngữ bằng MỘT bước decoder giới hạn {vi, en}. Dev-only: `npm run spike:asr` (lần đầu tải model từ
// HuggingFace vào tests/spike/.cache). Báo cáo: tests/spike/reports/. Chạy trên Mac Apple Silicon + Windows x64 chỉ CPU.

const SR = 16000;
const ROOT = resolve("tests/spike");
const CACHE = join(ROOT, ".cache");
const REPORTS = join(ROOT, "reports");
const FIXTURE = resolve("tests/fixtures/meeting/speech-16k.wav");
const MODELS = ["Xenova/whisper-tiny", "Xenova/whisper-base"] as const;
const DTYPES = ["q8", "fp32"] as const;
const DRAFT_WINDOW_SEC = 10;
const FINAL_SEGMENT_SEC = 300;
const DRAFT_RUNS = 5;
const ONLY = process.env.SPIKE_ONLY; // vd. "Xenova/whisper-tiny:q8" để đo nhanh một cấu hình

type Pipe = (input: Float32Array, opts: object) => Promise<unknown>;

/** Đọc WAV PCM16 mono 16 kHz, bỏ qua các chunk phụ (`say` ghi thêm FLLR). */
function readWav(path: string): Float32Array {
  const buf = readFileSync(path);
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") {
      const rate = buf.readUInt32LE(off + 12);
      const ch = buf.readUInt16LE(off + 10);
      if (rate !== SR || ch !== 1)
        throw new Error(`WAV ${path}: ${rate} Hz/${ch} kênh`);
    }
    if (id === "data") {
      const n = Math.floor(Math.min(size, buf.length - off - 8) / 2);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++)
        out[i] = buf.readInt16LE(off + 8 + i * 2) / 32768;
      return out;
    }
    off += 8 + size + (size % 2);
  }
  throw new Error(`WAV ${path}: không có chunk data`);
}

/** Lặp tín hiệu tới đúng `sec` giây (phân đoạn chốt 5 phút dựng từ fixture 54 s). */
function loopTo(pcm: Float32Array, sec: number): Float32Array {
  const out = new Float32Array(sec * SR);
  for (let i = 0; i < out.length; i++) out[i] = pcm[i % pcm.length] ?? 0;
  return out;
}

function fit(pcm: Float32Array, sec: number): Float32Array {
  const out = new Float32Array(sec * SR);
  out.set(pcm.subarray(0, out.length));
  return out;
}

function makeLangSample(id: string, voice: string, text: string): string {
  const path = join(CACHE, "lang", `${id}.wav`);
  if (!existsSync(path)) {
    mkdirSync(join(CACHE, "lang"), { recursive: true });
    execFileSync("say", [
      "-v",
      voice,
      "-r",
      "175",
      "-o",
      path,
      "--file-format=WAVE",
      "--data-format=LEI16@16000",
      text,
    ]);
  }
  return path;
}

const ms = (t0: number): number => performance.now() - t0;
const r2 = (n: number): string => n.toFixed(2);
const r3 = (n: number): string => n.toFixed(3);

interface RtfRow {
  model: string;
  dtype: string;
  loadMs: number;
  draftRtf: number;
  draftP95Ms: number;
  finalRtf: number;
  draftText: string;
}

interface LangRow {
  id: string;
  expected: string;
  got: string;
  pVi: number;
  ms: number;
}

const rtfRows: RtfRow[] = [];
const langRows: Record<string, LangRow[]> = {};
let speech!: Float32Array;

beforeAll(() => {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(REPORTS, { recursive: true });
  tf.env.cacheDir = CACHE;
  speech = readWav(FIXTURE);
});

const configs = MODELS.flatMap((model) =>
  DTYPES.map((dtype) => ({ model, dtype })),
).filter((c) => !ONLY || ONLY === `${c.model}:${c.dtype}`);

describe("S2 — RTF Whisper", () => {
  for (const { model, dtype } of configs) {
    it(`${model} ${dtype}`, async () => {
      let t0 = performance.now();
      const pipe = (await tf.pipeline("automatic-speech-recognition", model, {
        dtype,
      })) as unknown as Pipe;
      const loadMs = ms(t0);

      // Cửa sổ nháp 10 s: lấy lần lượt các cửa sổ có lời trong fixture (tiếng Việt), bỏ lượt khởi động.
      const windows = [0, 10, 20, 33, 0].map((s) =>
        fit(speech.subarray(s * SR), DRAFT_WINDOW_SEC),
      );
      await pipe(windows[0] as Float32Array, { return_timestamps: true });
      const draftMs: number[] = [];
      let draftText = "";
      for (let i = 0; i < DRAFT_RUNS; i++) {
        t0 = performance.now();
        const out = (await pipe(windows[i] as Float32Array, {
          return_timestamps: true,
        })) as { text?: string };
        draftMs.push(ms(t0));
        if (i === 0) draftText = (out.text ?? "").trim().slice(0, 60);
      }
      // Cùng cửa sổ đầu nhưng KHOÁ tiếng Việt (chế độ "Tiếng Việt" / sau khi phát hiện) — so chất lượng nháp.
      const forced = (await pipe(windows[0] as Float32Array, {
        return_timestamps: true,
        language: "vietnamese",
        task: "transcribe",
      })) as { text?: string };
      draftText += ` ‖ vi: ${(forced.text ?? "").trim().slice(0, 60)}`;
      const sorted = [...draftMs].sort((a, b) => a - b);
      const draftRtf =
        sorted.reduce((a, b) => a + b, 0) /
        sorted.length /
        1000 /
        DRAFT_WINDOW_SEC;

      // Phân đoạn chốt 5 phút (cùng cách gọi của asr-worker: chunk 30 s + timestamp).
      const segment = loopTo(speech, FINAL_SEGMENT_SEC);
      t0 = performance.now();
      await pipe(segment, { return_timestamps: true, chunk_length_s: 30 });
      const finalRtf = ms(t0) / 1000 / FINAL_SEGMENT_SEC;

      rtfRows.push({
        model,
        dtype,
        loadMs,
        draftRtf,
        draftP95Ms: sorted[sorted.length - 1] ?? 0,
        finalRtf,
        draftText,
      });
      expect(draftRtf).toBeGreaterThan(0);
    });
  }
});

/**
 * Phát hiện ngôn ngữ một bước: encoder trên 30 s + một bước decoder sau `<|startoftranscript|>`, so logits của
 * `<|vi|>` và `<|en|>` (softmax trên 2 token).
 */
async function makeDetector(model: string, dtype: string) {
  const processor = await tf.AutoProcessor.from_pretrained(model);
  const tokenizer = await tf.AutoTokenizer.from_pretrained(model);
  const m = await tf.WhisperForConditionalGeneration.from_pretrained(model, {
    dtype: dtype as "q8" | "fp32",
  });
  const id = (tok: string): number => {
    const v = tokenizer.convert_tokens_to_ids(tok);
    if (typeof v !== "number" || v < 0) throw new Error(`thiếu token ${tok}`);
    return v;
  };
  const sot = id("<|startoftranscript|>");
  const vi = id("<|vi|>");
  const en = id("<|en|>");
  return async (
    pcm: Float32Array,
  ): Promise<{ lang: "vi" | "en"; pVi: number }> => {
    const { input_features } = (await processor(pcm)) as {
      input_features: tf.Tensor;
    };
    const decoder_input_ids = new tf.Tensor(
      "int64",
      BigInt64Array.from([BigInt(sot)]),
      [1, 1],
    );
    const out = (await (
      m as unknown as (x: object) => Promise<{ logits: tf.Tensor }>
    )({
      input_features,
      decoder_input_ids,
    })) as { logits: tf.Tensor };
    const [, steps, vocab] = out.logits.dims as [number, number, number];
    const data = out.logits.data as Float32Array;
    const base = (steps - 1) * vocab;
    const lv = data[base + vi] ?? -Infinity;
    const le = data[base + en] ?? -Infinity;
    const pVi = 1 / (1 + Math.exp(le - lv));
    return { lang: pVi >= 0.5 ? "vi" : "en", pVi };
  };
}

describe("S2 — phát hiện ngôn ngữ một bước decoder {vi, en}", () => {
  for (const { model, dtype } of configs) {
    it(`${model} ${dtype}`, async () => {
      const detect = await makeDetector(model, dtype);
      const samples = [
        { id: "fixture-vi", lang: "vi", pcm: fit(speech, 30) },
        {
          id: "fixture-en",
          lang: "en",
          pcm: fit(speech.subarray(Math.round(32.8 * SR)), 30),
        },
        // Mẫu đọc bằng `say` chỉ sinh được trên macOS; Windows chỉ đo 2 mẫu của fixture (đủ để đo thời gian).
        ...(platform() === "darwin" ? LANG_SAMPLES : []).map((s) => ({
          id: s.id,
          lang: s.lang,
          pcm: fit(readWav(makeLangSample(s.id, s.voice, s.text)), 30),
        })),
      ];
      await detect(samples[0]?.pcm as Float32Array); // khởi động
      const rows: LangRow[] = [];
      for (const s of samples) {
        const t0 = performance.now();
        const r = await detect(s.pcm);
        rows.push({
          id: s.id,
          expected: s.lang,
          got: r.lang,
          pVi: r.pVi,
          ms: ms(t0),
        });
      }
      langRows[`${model} ${dtype}`] = rows;
      expect(rows.length).toBe(samples.length);
    });
  }
});

describe("S2 — báo cáo", () => {
  it("ghi tests/spike/reports/", () => {
    const cpu = cpus()[0]?.model ?? "?";
    const lines: string[] = [
      `# Spike S2 — ${new Date().toISOString()}`,
      "",
      `Máy: ${platform()} ${arch()} · ${cpu} × ${cpus().length} · RAM ${Math.round(totalmem() / 2 ** 30)} GB · Node ${process.version}`,
      "",
      "## RTF (thời gian xử lý / thời lượng audio — càng nhỏ càng nhanh)",
      "",
      "| Model | dtype | Nạp (ms) | RTF nháp 10 s (TB) | Chậm nhất 10 s (ms) | RTF chốt 5 phút | Nháp mẫu |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      ...rtfRows.map(
        (r) =>
          `| ${r.model} | ${r.dtype} | ${Math.round(r.loadMs)} | ${r3(r.draftRtf)} | ${Math.round(r.draftP95Ms)} | ${r3(r.finalRtf)} | ${r.draftText.replace(/\|/g, "/")} |`,
      ),
      "",
      "## Phát hiện ngôn ngữ (1 bước decoder, giới hạn {vi, en}, 30 s)",
      "",
    ];
    for (const [cfg, rows] of Object.entries(langRows)) {
      const ok = rows.filter((r) => r.expected === r.got).length;
      const avg = rows.reduce((a, r) => a + r.ms, 0) / Math.max(1, rows.length);
      lines.push(
        `### ${cfg} — đúng ${ok}/${rows.length}, TB ${Math.round(avg)} ms/mẫu`,
        "",
      );
      lines.push(
        "| Mẫu | Kỳ vọng | Ra | P(vi) | ms |",
        "| --- | --- | --- | --- | --- |",
      );
      for (const r of rows)
        lines.push(
          `| ${r.id} | ${r.expected} | ${r.got} | ${r2(r.pVi)} | ${Math.round(r.ms)} |`,
        );
      lines.push("");
    }
    const name = `asr-rtf-${platform()}-${arch()}-${Date.now()}.md`;
    writeFileSync(join(REPORTS, name), lines.join("\n"));
    process.stdout.write(
      `\n${lines.join("\n")}\n\nBáo cáo: tests/spike/reports/${name}\n`,
    );
    expect(rtfRows.length + Object.keys(langRows).length).toBeGreaterThan(0);
  });
});
