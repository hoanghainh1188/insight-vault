import { describe, it, expect, vi, afterEach } from "vitest";
import {
  retrieve,
  type RetrievalDeps,
} from "../../src/main/services/rag/retrieval";
import {
  RerankBusyError,
  RerankNotReadyError,
  type RerankConfig,
} from "../../src/main/services/rag/rerank-filter";
import { RELEVANCE_CALIBRATION } from "../../src/main/services/rag/relevance-calibration";
import type { Chunk } from "@shared/ipc/types";
import type { VectorSearchHit } from "../../src/main/services/ingestion/vector-store";

// 109 (contracts/rerank-filter.md, T007): bước rerank trong retrieve() sau RRF/trước MMR, mặc định tắt; fail-open.

const chunk = (id: string): Chunk => ({
  id,
  sourceId: "s1",
  ordinal: 0,
  text: `văn bản ${id}`,
  locator: { page: 1, charStart: 0, charEnd: 5 },
});

function baseDeps(over: Partial<RetrievalDeps> = {}): RetrievalDeps {
  return {
    embed: async () => [1, 0],
    search: async (): Promise<VectorSearchHit[]> => [
      { id: "a", sourceId: "s1", score: 0.1 },
      { id: "b", sourceId: "s1", score: 0.2 },
      { id: "c", sourceId: "s1", score: 0.3 },
    ],
    getChunksByIds: (ids) => ids.map((id) => chunk(id)),
    sourceTitle: () => "Nguồn",
    getVectorsByIds: async (ids) => new Map(ids.map((id) => [id, [1, 0]])),
    ...over,
  };
}

const R: RerankConfig = {
  minScore: 0.5,
  relativeDelta: null,
  reorder: false,
  timeoutMs: 1000,
  maxCandidates: 20,
};
const relevance = RELEVANCE_CALIBRATION.config;
const ids = (out: { chunk: Chunk }[]) => out.map((s) => s.chunk.id);
const rerankWith = (o: Record<string, number>) =>
  vi.fn(
    async (_q: string, _p: { id: string; text: string }[]) =>
      new Map(Object.entries(o)),
  );

afterEach(() => vi.useRealTimers());

describe("retrieve + rerank (109)", () => {
  it("thiếu deps.rerank hoặc rerankCfg null ⇒ y hệt 108, không gọi rerank", async () => {
    const rerank = rerankWith({ a: 0 });
    const before = await retrieve("q", "nb", baseDeps(), [], relevance, null);
    expect(
      await retrieve("q", "nb", baseDeps({ rerank }), [], relevance, null),
    ).toEqual(before);
    expect(rerank).not.toHaveBeenCalled();
    expect(await retrieve("q", "nb", baseDeps(), [], relevance, R)).toEqual(
      before,
    );
  });

  it("mặc định = bản ghi hiệu chuẩn (RELEVANCE_CALIBRATION.rerank) khi có deps.rerank", async () => {
    const rerank = rerankWith({ a: 0.1, b: 0.1, c: 0.1 });
    const out = await retrieve("q", "nb", baseDeps({ rerank }));
    expect(rerank).toHaveBeenCalledTimes(1);
    expect(RELEVANCE_CALIBRATION.rerank).not.toBeNull();
    expect(out).toEqual([]); // 0,1 < minScore đã hiệu chuẩn
  });

  it("chỉ đoạn đạt ngưỡng vào MMR; có rerankScore; score giữ cosine distance; locator nguyên", async () => {
    const rerank = rerankWith({ a: 0.9, b: 0.1, c: 0.7 });
    const out = await retrieve(
      "q",
      "nb",
      baseDeps({ rerank }),
      [],
      relevance,
      R,
    );
    expect(ids(out).sort()).toEqual(["a", "c"]);
    const a = out.find((s) => s.chunk.id === "a")!;
    expect(a.rerankScore).toBe(0.9);
    expect(a.score).toBeCloseTo(0.1);
    expect(a.chunk.locator).toEqual({ page: 1, charStart: 0, charEnd: 5 });
  });

  it("gửi rerank câu truy vấn + văn bản đoạn nguyên văn", async () => {
    const rerank = rerankWith({ a: 0.9, b: 0.9, c: 0.9 });
    await retrieve("câu hỏi", "nb", baseDeps({ rerank }), [], relevance, R);
    const [q, passages] = rerank.mock.calls[0] as unknown as [
      string,
      { id: string; text: string }[],
    ];
    expect(q).toBe("câu hỏi");
    expect(passages).toEqual(
      expect.arrayContaining([{ id: "a", text: "văn bản a" }]),
    );
  });

  it("maxCandidates ⇒ chỉ gửi N đoạn đầu (thứ tự RRF) đi chấm", async () => {
    const rerank = rerankWith({ a: 0.9, b: 0.9, c: 0.9 });
    const out = await retrieve("q", "nb", baseDeps({ rerank }), [], relevance, {
      ...R,
      maxCandidates: 2,
    });
    const [, passages] = rerank.mock.calls[0];
    expect(passages.map((p) => p.id)).toEqual(["a", "b"]);
    expect(ids(out).sort()).toEqual(["a", "b"]);
  });

  it("không đoạn nào đạt ⇒ [] (không tìm thấy)", async () => {
    const out = await retrieve(
      "q",
      "nb",
      baseDeps({ rerank: rerankWith({ a: 0.1, b: 0.2, c: 0.3 }) }),
      [],
      relevance,
      R,
    );
    expect(out).toEqual([]);
  });

  it("reorder ⇒ thứ tự theo điểm trước MMR", async () => {
    const out = await retrieve(
      "q",
      "nb",
      // vector giống hệt nhau ⇒ MMR giữ thứ tự đầu vào cho phần đầu
      baseDeps({ rerank: rerankWith({ a: 0.6, b: 0.95, c: 0.8 }) }),
      [],
      relevance,
      { ...R, reorder: true },
    );
    expect(ids(out)[0]).toBe("b");
  });

  it("có lịch sử ⇒ câu đã viết lại được gửi rerank", async () => {
    const rerank = rerankWith({ a: 0.9, b: 0.9, c: 0.9 });
    await retrieve(
      "nó là gì",
      "nb",
      baseDeps({ rerank, rewrite: async () => "hợp đồng X là gì" }),
      [{ role: "user", content: "về hợp đồng X" }],
      relevance,
      R,
    );
    expect(rerank.mock.calls[0][0]).toBe("hợp đồng X là gì");
  });

  it("fused rỗng ⇒ không gọi rerank, trả []", async () => {
    const rerank = rerankWith({});
    const out = await retrieve(
      "q",
      "nb",
      baseDeps({ rerank, search: async () => [] }),
      [],
      relevance,
      R,
    );
    expect(out).toEqual([]);
    expect(rerank).not.toHaveBeenCalled();
  });

  it("SC-005: gọi 5 lần với cùng điểm ⇒ 5 kết quả giống hệt", async () => {
    const run = () =>
      retrieve(
        "q",
        "nb",
        baseDeps({ rerank: rerankWith({ a: 0.7, b: 0.7, c: 0.9 }) }),
        [],
        relevance,
        { ...R, reorder: true },
      );
    const first = await run();
    for (let i = 0; i < 4; i++) expect(await run()).toEqual(first);
  });
});

describe("retrieve + rerank — fail-open (109 FR-013)", () => {
  const plain = () => retrieve("q", "nb", baseDeps());

  it("rerank ném lỗi ⇒ hành vi 108 + onRerankSkip('error')", async () => {
    const onRerankSkip = vi.fn();
    const out = await retrieve(
      "q",
      "nb",
      baseDeps({
        rerank: async () => {
          throw new Error("onnx");
        },
        onRerankSkip,
      }),
      [],
      relevance,
      R,
    );
    expect(out).toEqual(await plain());
    expect(onRerankSkip).toHaveBeenCalledWith("error");
  });

  it("chưa sẵn sàng ⇒ hành vi 108 + onRerankSkip('notReady')", async () => {
    const onRerankSkip = vi.fn();
    const out = await retrieve(
      "q",
      "nb",
      baseDeps({
        rerank: async () => {
          throw new RerankNotReadyError();
        },
        onRerankSkip,
      }),
      [],
      relevance,
      R,
    );
    expect(out).toEqual(await plain());
    expect(onRerankSkip).toHaveBeenCalledWith("notReady");
  });

  it("quá timeoutMs ⇒ hành vi 108 + onRerankSkip('timeout')", async () => {
    vi.useFakeTimers();
    const onRerankSkip = vi.fn();
    const p = retrieve(
      "q",
      "nb",
      baseDeps({
        rerank: () => new Promise<Map<string, number>>(() => undefined),
        onRerankSkip,
      }),
      [],
      relevance,
      R,
    );
    await vi.advanceTimersByTimeAsync(R.timeoutMs + 1);
    const out = await p;
    vi.useRealTimers();
    expect(out).toEqual(await plain());
    expect(onRerankSkip).toHaveBeenCalledWith("timeout");
  });
});

describe("retrieve + rerank — review 109", () => {
  it("bộ chấm đang bận (đã có lượt chờ) ⇒ hành vi 108 + onRerankSkip('busy')", async () => {
    const onRerankSkip = vi.fn();
    const out = await retrieve(
      "q",
      "nb",
      baseDeps({
        rerank: async () => {
          throw new RerankBusyError();
        },
        onRerankSkip,
      }),
      [],
      relevance,
      R,
    );
    expect(out).toEqual(
      await retrieve("q", "nb", baseDeps(), [], relevance, null),
    );
    expect(onRerankSkip).toHaveBeenCalledWith("busy");
  });

  it("không còn đoạn nào để chấm (chunk bị xoá giữa chừng) ⇒ không gọi bộ chấm (fail-open, không coi là không tìm thấy)", async () => {
    const rerank = rerankWith({});
    await retrieve(
      "q",
      "nb",
      baseDeps({ rerank, getChunksByIds: () => [] }),
      [],
      relevance,
      R,
    );
    expect(rerank).not.toHaveBeenCalled();
  });
});
