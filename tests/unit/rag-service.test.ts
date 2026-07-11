import { describe, it, expect } from "vitest";
import {
  createRagService,
  type RagServiceDeps,
} from "../../src/main/services/rag/rag-service";
import type { Chunk, ChatMessage, RagAskInput } from "@shared/ipc/types";
import type { VectorSearchHit } from "../../src/main/services/ingestion/vector-store";

function chunk(id: string): Chunk {
  return {
    id,
    sourceId: `s-${id}`,
    ordinal: 0,
    text: `Nội dung ${id}`,
    locator: { page: 1, charStart: 0, charEnd: 9 },
  };
}

// deps với 1 chunk liên quan + chat trả về câu do test chỉ định (ghi lại messages để kiểm multi-turn).
function makeDeps(opts: {
  hits?: VectorSearchHit[];
  chunks?: Chunk[];
  chatReply?: (messages: ChatMessage[]) => string;
  capture?: ChatMessage[][];
}): RagServiceDeps {
  const hits = opts.hits ?? [{ id: "a", sourceId: "s-a", score: 0.1 }];
  const chunks = opts.chunks ?? [chunk("a")];
  return {
    embed: async () => [0.1, 0.2, 0.3],
    search: async () => hits,
    getChunksByIds: (ids) => {
      const m = new Map(chunks.map((c) => [c.id, c]));
      return ids.map((i) => m.get(i)).filter((c): c is Chunk => c != null);
    },
    sourceTitle: (sid) => `Nguồn ${sid}`,
    chat: async (messages) => {
      opts.capture?.push(messages);
      return opts.chatReply ? opts.chatReply(messages) : "Trả lời [1].";
    },
  };
}

const ask = (over: Partial<RagAskInput> = {}): RagAskInput => ({
  notebookId: "nb1",
  question: "Câu hỏi?",
  mode: "grounded",
  history: [],
  ...over,
});

describe("rag-service.ask", () => {
  it("US1 grounded có nguồn → answer + citations map đúng chunk", async () => {
    const svc = createRagService(makeDeps({}));
    const res = await svc.ask(ask());
    expect(res.modeUsed).toBe("grounded");
    expect(res.notFound).toBe(false);
    expect(res.citations).toHaveLength(1);
    expect(res.citations[0].chunkId).toBe("a");
    expect(res.answer).toContain("[1]");
  });

  it("US2 grounded không có căn cứ (0 chunk) → notFound, không gọi model", async () => {
    let chatCalled = false;
    const deps = makeDeps({ hits: [] });
    deps.chat = async () => {
      chatCalled = true;
      return "khong nen goi";
    };
    const res = await createRagService(deps).ask(ask());
    expect(res.notFound).toBe(true);
    expect(res.answer).toBe("Không tìm thấy trong nguồn.");
    expect(res.citations).toEqual([]);
    expect(chatCalled).toBe(false);
  });

  it("US2 grounded có context nhưng model trả 'không tìm thấy' → notFound", async () => {
    const svc = createRagService(
      makeDeps({ chatReply: () => "Không tìm thấy trong nguồn." }),
    );
    const res = await svc.ask(ask());
    expect(res.notFound).toBe(true);
    expect(res.citations).toEqual([]);
  });

  it("BLOCKING: grounded có context nhưng model trả lời KHÔNG citation → ép notFound (không hiển thị nội dung bịa)", async () => {
    const svc = createRagService(
      makeDeps({ chatReply: () => "Nội dung tự bịa không hề chèn chip nào." }),
    );
    const res = await svc.ask(ask());
    expect(res.notFound).toBe(true);
    expect(res.answer).toBe("Không tìm thấy trong nguồn.");
    expect(res.citations).toEqual([]);
    // nội dung bịa KHÔNG được hiển thị
    expect(res.answer).not.toContain("tự bịa");
  });

  it("grounded chỉ chèn chip bịa [9] (bị gỡ hết) → notFound (không còn citation hợp lệ)", async () => {
    const svc = createRagService(
      makeDeps({ chatReply: () => "Bịa hết [9] [7]." }),
    );
    const res = await svc.ask(ask());
    expect(res.notFound).toBe(true);
    expect(res.answer).toBe("Không tìm thấy trong nguồn.");
  });

  it("mode lạ → ném (KHÔNG âm thầm hạ về open)", async () => {
    const svc = createRagService(makeDeps({}));
    await expect(
      svc.ask({ ...ask(), mode: "xxx" as unknown as "grounded" }),
    ).rejects.toThrow(/Chế độ/);
  });

  it("US1 chip bịa [9] → gỡ, chỉ giữ citation hợp lệ", async () => {
    const svc = createRagService(
      makeDeps({ chatReply: () => "Đúng [1] bịa [9]." }),
    );
    const res = await svc.ask(ask());
    expect(res.answer).not.toContain("[9]");
    expect(res.citations.map((c) => c.n)).toEqual([1]);
  });

  it("US3 open → modeUsed=open, dùng open prompt (không notFound dù 0 chunk)", async () => {
    const cap: ChatMessage[][] = [];
    const svc = createRagService(
      makeDeps({
        hits: [],
        chunks: [],
        capture: cap,
        chatReply: () => "Kiến thức chung (không dựa trên nguồn).",
      }),
    );
    const res = await svc.ask(ask({ mode: "open" }));
    expect(res.modeUsed).toBe("open");
    expect(res.notFound).toBe(false);
    expect(cap[0][0].content).toContain("(không dựa trên nguồn)"); // open system prompt
  });

  it("US4 multi-turn: history đưa vào messages (giữa system và câu hỏi mới)", async () => {
    const cap: ChatMessage[][] = [];
    const svc = createRagService(
      makeDeps({
        capture: cap,
        chatReply: () => "ok [1]",
      }),
    );
    await svc.ask(
      ask({
        history: [
          { role: "user", content: "Câu trước" },
          { role: "assistant", content: "Đáp trước" },
        ],
      }),
    );
    const msgs = cap[0];
    expect(msgs[0].role).toBe("system");
    expect(msgs.some((m) => m.content === "Câu trước")).toBe(true);
    expect(msgs[msgs.length - 1].content).toBe("Câu hỏi?");
  });

  it("US4 câu hỏi quá dài → ném (validate boundary)", async () => {
    const svc = createRagService(makeDeps({}));
    await expect(svc.ask(ask({ question: "x".repeat(2001) }))).rejects.toThrow(
      /quá dài/,
    );
    await expect(svc.ask(ask({ question: "   " }))).rejects.toThrow(/để trống/);
  });
});
