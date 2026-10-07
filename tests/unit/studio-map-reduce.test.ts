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
      if (sys.startsWith("Rút gọn"))
        return ns.map((n) => `- ý gọn [${n}]`).join("\n");
      if (sys.startsWith("Bạn trích GHI CHÚ")) {
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
    expect(calls[calls.length - 1][0].content).toMatch(/GIỮ NGUYÊN/);
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
      if (sys.startsWith("Rút gọn")) {
        calls.push("condense");
        return `- gộp [${ns[0]}]`;
      }
      if (sys.startsWith("Bạn trích GHI CHÚ")) {
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
