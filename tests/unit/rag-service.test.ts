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
    // 039: mô phỏng streaming — phát từng ký tự qua onToken, trả nội dung đầy đủ.
    chatStream: async (messages, sopts) => {
      opts.capture?.push(messages);
      const reply = opts.chatReply ? opts.chatReply(messages) : "Trả lời [1].";
      for (const ch of reply) sopts.onToken?.(ch);
      return reply;
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

describe("rag-service — 059 reindex guard (per-notebook)", () => {
  it("notebook đang tái lập → báo thông báo, KHÔNG truy xuất/chat, KHÔNG lưu", async () => {
    let embedCalled = false;
    let saved = false;
    const svc = createRagService({
      ...makeDeps({}),
      embed: async () => {
        embedCalled = true;
        return [0.1];
      },
      reindexing: async () => true,
      saveTurn: () => {
        saved = true;
      },
    });
    const res = await svc.ask(ask());
    expect(res.answer).toMatch(/tái lập chỉ mục/i);
    expect(res.citations).toEqual([]);
    expect(embedCalled).toBe(false); // không truy xuất trên vector chưa đầy đủ
    expect(saved).toBe(false); // không lưu thông báo tạm vào lịch sử
  });

  it("notebook đã nhúng xong → hoạt động bình thường (per-notebook)", async () => {
    const svc = createRagService({
      ...makeDeps({}),
      reindexing: async () => false,
    });
    const res = await svc.ask(ask());
    expect(res.answer).not.toMatch(/tái lập chỉ mục/i);
  });

  it("guard nhận đúng notebookId đang hỏi (chặn theo từng notebook)", async () => {
    const seen: string[] = [];
    const svc = createRagService({
      ...makeDeps({}),
      reindexing: async (nb) => {
        seen.push(nb);
        return nb === "nb-dang-reindex";
      },
    });
    const blocked = await svc.ask(ask({ notebookId: "nb-dang-reindex" }));
    expect(blocked.answer).toMatch(/tái lập chỉ mục/i);
    const ok = await svc.ask(ask({ notebookId: "nb-xong" }));
    expect(ok.answer).not.toMatch(/tái lập chỉ mục/i);
    expect(seen).toEqual(["nb-dang-reindex", "nb-xong"]);
  });
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

  it("grounded có context, model trả lời thật nhưng KHÔNG chèn [n] (vd tóm tắt) → gắn NGUỒN ĐÃ TRUY HỒI làm citation (verifiable), KHÔNG ẩn", async () => {
    const svc = createRagService(
      makeDeps({ chatReply: () => "Tài liệu nói về A và B." }),
    );
    const res = await svc.ask(ask());
    expect(res.notFound).toBe(false);
    expect(res.answer).toContain("A và B"); // câu trả lời được hiển thị
    // nguồn dự phòng = chunk đã truy hồi (a) → người dùng mở/đối chiếu được
    expect(res.citations.map((c) => c.chunkId)).toEqual(["a"]);
  });

  it("grounded model tự nói 'không tìm thấy' (0 citation) → notFound", async () => {
    const svc = createRagService(
      makeDeps({ chatReply: () => "Rất tiếc, không tìm thấy thông tin này." }),
    );
    const res = await svc.ask(ask());
    expect(res.notFound).toBe(true);
    expect(res.answer).toBe("Không tìm thấy trong nguồn.");
    expect(res.citations).toEqual([]);
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

describe("rag-service.askStream (039)", () => {
  it("nối token qua onToken + finalize chip hậu kiểm", async () => {
    const tokens: string[] = [];
    const svc = createRagService(makeDeps({}));
    const res = await svc.askStream(ask(), {
      onToken: (d) => tokens.push(d),
    });
    expect(tokens.join("")).toContain("Trả lời"); // đã stream từng delta
    expect(res.answer).toContain("Trả lời");
    expect(res.citations.length).toBeGreaterThan(0); // chip [1] hậu kiểm
  });

  it("grounded không căn cứ → notFound, KHÔNG stream (không gọi model)", async () => {
    const tokens: string[] = [];
    const svc = createRagService(makeDeps({ hits: [] }));
    const res = await svc.askStream(ask(), {
      onToken: (d) => tokens.push(d),
    });
    expect(res.notFound).toBe(true);
    expect(tokens).toHaveLength(0);
  });

  it("phần đã nhận (nội dung ngắn như bị Dừng) → finalize trên phần đó", async () => {
    const svc = createRagService(makeDeps({ chatReply: () => "Một phần [1]" }));
    const res = await svc.askStream(ask(), {});
    expect(res.answer).toContain("Một phần");
    expect(res.citations.map((c) => c.n)).toEqual([1]);
  });
});
