import { describe, it, expect, vi } from "vitest";
import { createStudioService } from "../../src/main/services/studio/studio-service";
import type { Chunk, ChatMessage, Source } from "@shared/ipc/types";

// 105 — Studio theo cửa sổ ngữ cảnh của model: vừa ngân sách ⇒ 1 lượt (như cũ); vượt ⇒ map-reduce giữ [n] tới
// ĐÚNG đoạn; truyền num_ctx tường minh cho mọi lượt; báo số phần.

const src = (id: string): Source =>
  ({
    id,
    notebookId: "nb1",
    kind: "txt",
    title: `Tài liệu ${id}`,
    status: "ready",
  }) as Source;
const chunks = (sourceId: string, count: number, len = 300): Chunk[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${sourceId}-${i}`,
    sourceId,
    notebookId: "nb1",
    ordinal: i,
    text: `${sourceId}${i} `.repeat(len / 4),
    locator: { page: 1, charStart: i * 10, charEnd: i * 10 + 5 },
  })) as unknown as Chunk[];

function setup(opts: {
  perSource: number;
  budget: number;
  numCtx?: number | null;
}) {
  const calls: { messages: ChatMessage[]; numCtx?: number }[] = [];
  const chat = vi.fn(
    async (messages: ChatMessage[], o?: { numCtx?: number }) => {
      calls.push({ messages, numCtx: o?.numCtx });
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      if (messages[0].content.startsWith("Bạn trích GHI CHÚ"))
        return `- ý [${ns[0]}]`;
      return `Kết quả ${ns.map((n) => `[${n}]`).join(" ")}.`;
    },
  );
  const upsert = vi.fn((notebookId, kind, content, citations) => ({
    id: "r1",
    notebookId,
    kind,
    content,
    citations,
    createdAt: 1,
  }));
  const svc = createStudioService({
    listSources: () => [src("A"), src("B")],
    listChunks: (id) => chunks(id, opts.perSource),
    studioRepo: { upsert, listByNotebook: () => [] } as never,
    chat,
    contextInfo: async () => ({
      budget: opts.budget,
      numCtx: opts.numCtx ?? null,
    }),
  });
  return { svc, calls, chat };
}

describe("studio-service — ngân sách theo model", () => {
  it("vừa ngân sách ⇒ 1 lượt, không truncated, 1 phần; truyền num_ctx", async () => {
    const { svc, calls } = setup({
      perSource: 2,
      budget: 50_000,
      numCtx: 16384,
    });
    const r = await svc.generate({ notebookId: "nb1", kind: "summary" });
    expect(calls).toHaveLength(1);
    expect(calls[0].numCtx).toBe(16384);
    expect(r.truncated).toBe(false);
    expect(r.parts).toBe(1);
    expect(r.citations.map((c) => c.chunkId).sort()).toEqual([
      "A-0",
      "A-1",
      "B-0",
      "B-1",
    ]);
  });

  it("vượt ngân sách ⇒ map-reduce: nhiều lượt, chip vẫn trỏ ĐÚNG đoạn thật, báo số phần", async () => {
    const { svc, calls } = setup({ perSource: 6, budget: 1000, numCtx: 4096 });
    const r = await svc.generate({ notebookId: "nb1", kind: "keyPoints" });
    expect(calls.length).toBeGreaterThan(2);
    expect(calls.every((c) => c.numCtx === 4096)).toBe(true);
    expect(r.parts).toBe(calls.length - 1);
    expect(r.truncated).toBe(false);
    expect(r.citations.length).toBeGreaterThan(1);
    // mỗi chip trỏ đoạn có thật trong notebook
    const ids = new Set(
      [...chunks("A", 6), ...chunks("B", 6)].map((c) => c.id),
    );
    for (const c of r.citations) expect(ids.has(c.chunkId)).toBe(true);
  });

  it("nhiều nguồn ngắn (mỗi nguồn 1 đoạn) vượt ngân sách ⇒ KHÔNG gửi 1 prompt quá cửa sổ, chuyển map-reduce", async () => {
    const calls: number[] = [];
    const sources = Array.from({ length: 8 }, (_, i) => src(`S${i}`));
    const svc = createStudioService({
      listSources: () => sources,
      listChunks: (id) => chunks(id, 1, 600),
      studioRepo: {
        upsert: (...a: unknown[]) => ({
          id: "r",
          notebookId: a[0],
          kind: a[1],
          content: a[2],
          citations: a[3],
          createdAt: 1,
        }),
        listByNotebook: () => [],
      } as never,
      chat: async (m: ChatMessage[]) => {
        calls.push(m[1].content.length);
        const ns = [...m[1].content.matchAll(/\[(\d+)\]/g)].map((x) =>
          Number(x[1]),
        );
        return m[0].content.startsWith("Bạn trích GHI CHÚ")
          ? `- ý [${ns[0]}]`
          : `Kết luận [${ns[0]}].`;
      },
      contextInfo: async () => ({ budget: 1500, numCtx: 4096 }),
    });
    const r = await svc.generate({ notebookId: "nb1", kind: "summary" });
    expect(r.parts).toBeGreaterThan(1);
    expect(Math.max(...calls)).toBeLessThanOrEqual(1500);
  });

  it("map-reduce mà bước cuối không chèn [n] ⇒ chỉ dẫn các đoạn CÓ trong ghi chú, không phải cả notebook", async () => {
    const svc = createStudioService({
      listSources: () => [src("A"), src("B")],
      listChunks: (id) => chunks(id, 6),
      studioRepo: {
        upsert: (...a: unknown[]) => ({
          id: "r",
          notebookId: a[0],
          kind: a[1],
          content: a[2],
          citations: a[3],
          createdAt: 1,
        }),
        listByNotebook: () => [],
      } as never,
      chat: async (m: ChatMessage[]) => {
        const ns = [...m[1].content.matchAll(/\[(\d+)\]/g)].map((x) =>
          Number(x[1]),
        );
        return m[0].content.startsWith("Bạn trích GHI CHÚ")
          ? `- ý [${ns[0]}]`
          : "Kết luận không kèm trích dẫn.";
      },
      contextInfo: async () => ({ budget: 1000, numCtx: 4096 }),
    });
    const r = await svc.generate({ notebookId: "nb1", kind: "summary" });
    expect(r.citations.length).toBe(r.parts);
    expect(r.citations.length).toBeLessThan(12);
  });

  it("không có contextInfo ⇒ ngân sách cũ 16.000, không ép num_ctx", async () => {
    const calls: { numCtx?: number }[] = [];
    const svc = createStudioService({
      listSources: () => [src("A")],
      listChunks: (id) => chunks(id, 2),
      studioRepo: {
        upsert: (
          n: string,
          k: string,
          content: string,
          citations: unknown,
        ) => ({
          id: "r",
          notebookId: n,
          kind: k,
          content,
          citations,
          createdAt: 1,
        }),
        listByNotebook: () => [],
      } as never,
      chat: async (_m: ChatMessage[], o?: { numCtx?: number }) => {
        calls.push({ numCtx: o?.numCtx });
        return "Kết quả [1].";
      },
    });
    const r = await svc.generate({ notebookId: "nb1", kind: "summary" });
    expect(calls[0].numCtx).toBeUndefined();
    expect(r.parts).toBe(1);
  });

  it("đầu vào sai / chưa có nguồn ready ⇒ ném", async () => {
    const { svc } = setup({ perSource: 1, budget: 1000 });
    await expect(
      svc.generate({ notebookId: "", kind: "summary" }),
    ).rejects.toThrow();
    await expect(
      svc.generate({
        notebookId: "nb1",
        kind: "summary",
        sourceId: "khong-co",
      }),
    ).rejects.toThrow(/chưa sẵn sàng/);
  });
});
