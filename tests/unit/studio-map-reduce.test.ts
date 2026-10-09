import { describe, it, expect, vi } from "vitest";
import {
  numberAll,
  packBatches,
  runMapReduce,
} from "../../src/main/services/studio/map-reduce";
import { postprocessCitations } from "../../src/main/services/rag/citation";
import type { ScoredChunk } from "../../src/main/services/rag/rag-types";
import type { ChatMessage } from "@shared/ipc/types";

// 105 — map-reduce GIỮ [n] tới ĐÚNG ĐOẠN (ADR studio-large-clarify): đánh số TOÀN CỤC, ghi chú theo lô kèm [n]
// (hậu kiểm theo lô), bước cuối giữ nguyên [n] ⇒ chip trỏ đoạn thật — khác phương án đã bác (citation mức nguồn).

function chunk(sourceId: string, ordinal: number, text: string): ScoredChunk {
  return {
    chunk: {
      id: `${sourceId}-${ordinal}`,
      sourceId,
      notebookId: "nb1",
      ordinal,
      text,
      locator: {
        page: 1,
        charStart: ordinal * 100,
        charEnd: ordinal * 100 + text.length,
      },
    },
    sourceTitle: `Tài liệu ${sourceId}`,
    score: 0,
  } as unknown as ScoredChunk;
}

const groups = (perSource: number, len = 400): ScoredChunk[][] =>
  ["A", "B"].map((s) =>
    Array.from({ length: perSource }, (_, i) =>
      chunk(s, i, `${s}${i} `.repeat(len / 4)),
    ),
  );

describe("numberAll", () => {
  it("đánh số [n] toàn cục theo nguồn → thứ tự đọc; bảng n → đoạn thật", () => {
    const { blocks, map } = numberAll(groups(2));
    expect(blocks.map((b) => b.n)).toEqual([1, 2, 3, 4]);
    expect(map.get(1)!.chunk.id).toBe("A-0");
    expect(map.get(3)!.chunk.id).toBe("B-0");
    expect(blocks[2].text.startsWith("[3]")).toBe(true);
  });
});

describe("packBatches", () => {
  it("gom tham lam vừa ngân sách; đoạn quá khổ đứng riêng 1 lô", () => {
    const blocks = [
      { n: 1, text: "a".repeat(40) },
      { n: 2, text: "b".repeat(40) },
      { n: 3, text: "c".repeat(200) },
      { n: 4, text: "d".repeat(40) },
    ];
    expect(packBatches(blocks, 100).map((b) => b.map((x) => x.n))).toEqual([
      [1, 2],
      [3],
      [4],
    ]);
  });
});

describe("runMapReduce", () => {
  /** chat giả: lượt map trả ghi chú trích [n] đầu tiên của lô + 1 số bịa; lượt cuối trả lại các [n] nhận được. */
  function fakeChat() {
    const calls: ChatMessage[][] = [];
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      calls.push(messages);
      const sys = messages[0].content;
      const user = messages[1].content;
      const ns = [...user.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
      if (sys.startsWith("Condense the NOTES"))
        return ns.map((n) => `- ý gọn [${n}]`).join("\n");
      if (sys.startsWith("Extract NOTES")) {
        return `- ý chính [${ns[0]}] [999]`; // [999] bịa ⇒ phải bị gỡ theo lô
      }
      return `Tóm tắt toàn bộ ${ns.map((n) => `[${n}]`).join(" ")}.`;
    });
    return { chat, calls };
  }

  it("nhiều lô ⇒ N lượt map + 1 lượt cuối; [n] cuối cùng trỏ ĐÚNG đoạn thật, số bịa bị gỡ", async () => {
    const { chat, calls } = fakeChat();
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat,
    });
    expect(out.parts).toBeGreaterThan(1);
    expect(chat).toHaveBeenCalledTimes(out.parts + 1);
    expect(out.truncated).toBe(false);
    const finalUser = calls[calls.length - 1][1].content;
    expect(finalUser).not.toContain("[999]");
    const { citations } = postprocessCitations(out.raw, out.map);
    expect(citations.length).toBeGreaterThan(1);
    for (const c of citations)
      expect(out.map.get(c.n)!.chunk.id).toBe(c.chunkId);
    // lượt cuối được nhắc giữ nguyên [n]
    expect(calls[calls.length - 1][0].content).toMatch(/KEEP the \[n\] chips/);
  });

  it("vượt số lượt map tối đa ⇒ truncated, chỉ tổng hợp số phần cho phép", async () => {
    const { chat } = fakeChat();
    const out = await runMapReduce({
      kind: "keyPoints",
      groups: groups(10),
      budget: 500,
      chat,
      maxMapCalls: 3,
    });
    expect(out.parts).toBe(3);
    expect(out.truncated).toBe(true);
  });

  it("ghi chú gộp lại vẫn quá ngân sách ⇒ rút gọn ghi chú (giữ [n]) trước bước cuối", async () => {
    const calls: string[] = [];
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      const sys = messages[0].content;
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      if (sys.startsWith("Condense the NOTES")) {
        calls.push("condense");
        return `- gộp [${ns[0]}]`;
      }
      if (sys.startsWith("Extract NOTES")) {
        calls.push("map");
        return ns.map((n) => `- ${"chi tiết ".repeat(30)}[${n}]`).join("\n");
      }
      calls.push("reduce");
      return `Kết luận [${ns[0]}].`;
    });
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat,
    });
    expect(calls).toContain("condense");
    expect(calls[calls.length - 1]).toBe("reduce");
    expect(postprocessCitations(out.raw, out.map).citations).toHaveLength(1);
  });
});

describe("runMapReduce — hậu kiểm chặt (review 105)", () => {
  it("bước cuối viết số HỢP LỆ TOÀN CỤC nhưng KHÔNG có trong ghi chú ⇒ bị gỡ (không trỏ đoạn model chưa đọc)", async () => {
    let seenFinal: number[] = [];
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      const sys = messages[0].content;
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      if (sys.startsWith("Extract NOTES")) return `- ý [${ns[0]}]`;
      seenFinal = ns;
      return `Kết luận [${ns[0]}] và [2].`; // [2] có trong notebook nhưng không có trong ghi chú
    });
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat,
    });
    expect(seenFinal).not.toContain(2);
    const { citations } = postprocessCitations(out.raw, out.map);
    expect(citations.map((c) => c.n)).toEqual([seenFinal[0]]);
  });

  it("chip dạng gộp [1, 2] trong ghi chú được tách ra (không mất ý)", async () => {
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      const sys = messages[0].content;
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      if (sys.startsWith("Extract NOTES"))
        return `- ý chung [${ns[0]}, ${ns[1]}]`;
      return `Kết luận ${ns.map((n) => `[${n}]`).join(" ")}.`;
    });
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat,
    });
    expect(
      postprocessCitations(out.raw, out.map).citations.length,
    ).toBeGreaterThan(out.parts);
  });

  it("mọi lô không trích được ghi chú có [n] ⇒ ném lỗi rõ (không để bước cuối bịa)", async () => {
    const chat = vi.fn(async () => "Không có gì để ghi chú.");
    await expect(
      runMapReduce({ kind: "summary", groups: groups(3), budget: 900, chat }),
    ).rejects.toThrow(/studioNoNotes/);
    expect(chat).toHaveBeenCalledTimes(3 * 2); // mỗi lô thử lại 1 lần rồi mới bỏ
  });

  it("một lô rỗng ⇒ đánh dấu truncated (phần tài liệu đó không được tổng hợp)", async () => {
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      const sys = messages[0].content;
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      // lô đầu (đoạn [1]) luôn không trích được — kể cả lần thử lại
      if (sys.startsWith("Extract NOTES"))
        return ns[0] === 1 ? "rỗng" : `- ý [${ns[0]}]`;
      return `Kết luận ${ns.map((n) => `[${n}]`).join(" ")}.`;
    });
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat,
    });
    expect(out.truncated).toBe(true);
  });

  it("một lượt map lỗi ⇒ thử lại 1 lần rồi chạy tiếp", async () => {
    let failed = false;
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      if (messages[0].content.startsWith("Extract NOTES")) {
        if (!failed) {
          failed = true;
          throw new Error("Ollama tạm lỗi");
        }
        return `- ý [${ns[0]}]`;
      }
      return `Kết luận [${ns[0]}].`;
    });
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat,
    });
    expect(out.truncated).toBe(false);
    expect(postprocessCitations(out.raw, out.map).citations).toHaveLength(1);
  });

  it("rút gọn: [n] không thuộc lô ghi chú đầu vào bị gỡ; vẫn quá dài sau các vòng ⇒ cắt + truncated", async () => {
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      const sys = messages[0].content;
      const input = messages[1].content;
      const ns = [...input.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
      // model "không chịu rút gọn" + bịa thêm [2] (có trong notebook nhưng KHÔNG có trong ghi chú)
      if (sys.startsWith("Condense the NOTES")) return `${input}\n- bịa [2]`;
      if (sys.startsWith("Extract NOTES"))
        return `- ${"x ".repeat(300)}[${ns[0]}]`;
      return `Kết luận ${ns.map((n) => `[${n}]`).join(" ")}.`;
    });
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat,
    });
    expect(out.truncated).toBe(true);
    const finalUser = (chat.mock.calls.at(-1)![0] as ChatMessage[])[1].content;
    expect(finalUser.length).toBeLessThanOrEqual(900);
    expect(finalUser).not.toContain("[2]");
  });
});

describe("123: ngôn ngữ đầu ra cho mọi bước map-reduce", () => {
  it("map, condense, bước cuối đều dặn cùng ngôn ngữ (en); mặc định vi", async () => {
    for (const [lang, word] of [
      ["en", "Write in English"],
      [undefined, "Write in Vietnamese"],
    ] as const) {
      const systems: string[] = [];
      const chat = vi.fn(async (messages: ChatMessage[]) => {
        const sys = messages[0].content;
        systems.push(sys);
        const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
          Number(m[1]),
        );
        if (sys.startsWith("Condense the NOTES")) return `- gộp [${ns[0]}]`;
        if (sys.startsWith("Extract NOTES"))
          return ns.map((n) => `- ${"chi tiết ".repeat(30)}[${n}]`).join("\n");
        return `Kết luận [${ns[0]}].`;
      });
      await runMapReduce({
        kind: "faq",
        groups: groups(3),
        budget: 900,
        chat,
        ...(lang ? { outputLanguage: lang } : {}),
      });
      expect(systems.length).toBeGreaterThan(2);
      for (const sys of systems) expect(sys).toContain(word);
    }
  });
});

// 146 (contract studio-progress): onProgress phát reading 1/N..N/N (trước lượt map đầu tiên của phần đó), condensing ≤ 1 lần (chỉ khi có
// vòng rút gọn), writing 1 lần trước bước cuối. Lỗi callback bị nuốt; kết quả giống hệt khi không có onProgress.
describe("runMapReduce — onProgress (146)", () => {
  type Ev = { phase: string; index?: number; total?: number };

  /** chat giả ghi lại thứ tự gọi xen kẽ với sự kiện tiến độ. */
  function tracedChat(
    log: string[],
    opts: { condense?: boolean; failFirstMap?: boolean } = {},
  ) {
    let failed = false;
    return vi.fn(async (messages: ChatMessage[]) => {
      const sys = messages[0].content;
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      if (sys.startsWith("Condense the NOTES")) {
        log.push("chat:condense");
        return `- gộp [${ns[0]}]`;
      }
      if (sys.startsWith("Extract NOTES")) {
        log.push("chat:map");
        if (opts.failFirstMap && !failed) {
          failed = true;
          throw new Error("tạm lỗi");
        }
        return opts.condense
          ? ns.map((n) => `- ${"chi tiết ".repeat(30)}[${n}]`).join("\n")
          : `- ý [${ns[0]}]`;
      }
      log.push("chat:final");
      return `Kết luận [${ns[0]}].`;
    });
  }

  const label = (e: Ev): string =>
    e.phase === "reading" ? `reading ${e.index}/${e.total}` : e.phase;

  it("nhiều phần, không rút gọn ⇒ reading 1/N..N/N rồi writing; mỗi sự kiện ngay trước lượt gọi của nó", async () => {
    const log: string[] = [];
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat: tracedChat(log),
      onProgress: (e: Ev) => log.push(label(e)),
    });
    const N = out.parts;
    expect(N).toBeGreaterThan(1);
    const expected: string[] = [];
    for (let i = 1; i <= N; i++) expected.push(`reading ${i}/${N}`, "chat:map");
    expected.push("writing", "chat:final");
    expect(log).toEqual(expected);
  });

  it("bị cắt ở maxMapCalls ⇒ total = parts (số phần thực chạy)", async () => {
    const evs: Ev[] = [];
    const out = await runMapReduce({
      kind: "keyPoints",
      groups: groups(10),
      budget: 500,
      chat: tracedChat([]),
      maxMapCalls: 3,
      onProgress: (e: Ev) => evs.push(e),
    });
    expect(out.parts).toBe(3);
    const reading = evs.filter((e) => e.phase === "reading");
    expect(reading.map((e) => [e.index, e.total])).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("lần thử lại trong cùng phần KHÔNG phát thêm sự kiện", async () => {
    const log: string[] = [];
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat: tracedChat(log, { failFirstMap: true }),
      onProgress: (e: Ev) => log.push(label(e)),
    });
    expect(log.filter((l) => l.startsWith("reading"))).toHaveLength(out.parts);
    expect(log.slice(0, 3)).toEqual([
      `reading 1/${out.parts}`,
      "chat:map",
      "chat:map",
    ]);
  });

  it("có vòng rút gọn ⇒ condensing đúng 1 lần, trước lượt rút gọn đầu tiên, sau mọi reading", async () => {
    const log: string[] = [];
    await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat: tracedChat(log, { condense: true }),
      onProgress: (e: Ev) => log.push(label(e)),
    });
    expect(log.filter((l) => l === "condensing")).toHaveLength(1);
    const ci = log.indexOf("condensing");
    expect(log[ci + 1]).toBe("chat:condense");
    expect(log.slice(ci).some((l) => l.startsWith("reading"))).toBe(false);
    expect(log.filter((l) => l === "writing")).toHaveLength(1);
    expect(log[log.length - 2]).toBe("writing");
  });

  it("onProgress ném lỗi ⇒ lượt tạo vẫn xong; kết quả giống hệt khi không truyền onProgress", async () => {
    const base = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat: tracedChat([]),
    });
    const withThrow = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat: tracedChat([]),
      onProgress: () => {
        throw new Error("renderer đã đóng");
      },
    });
    expect(withThrow.raw).toBe(base.raw);
    expect(withThrow.parts).toBe(base.parts);
    expect(withThrow.truncated).toBe(base.truncated);
    expect([...withThrow.map.keys()]).toEqual([...base.map.keys()]);
  });
});
