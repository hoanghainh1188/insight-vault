import { describe, it, expect } from "vitest";
import {
  buildRewritePrompt,
  rewriteQuery,
} from "../../src/main/services/rag/rewrite";
import type { RagTurn } from "@shared/ipc/types";

const hist: RagTurn[] = [
  { role: "user", content: "Hợp đồng này thời hạn bao lâu?" },
  { role: "assistant", content: "12 tháng." },
];

describe("buildRewritePrompt (055)", () => {
  it("gồm system + history + câu hỏi", () => {
    const msgs = buildRewritePrompt("còn điều khoản phạt của nó?", hist);
    expect(msgs[0].role).toBe("system");
    const user = msgs[msgs.length - 1].content;
    expect(user).toContain("Hợp đồng này thời hạn"); // history
    expect(user).toContain("còn điều khoản phạt của nó?"); // câu hỏi
  });
  it("không history → vẫn hợp lệ", () => {
    const msgs = buildRewritePrompt("câu hỏi đầu", []);
    expect(msgs[msgs.length - 1].content).toContain("câu hỏi đầu");
  });
});

describe("rewriteQuery (055)", () => {
  it("trả truy vấn viết lại (gỡ nháy bao)", async () => {
    const out = await rewriteQuery(
      "nó là gì?",
      hist,
      async () => '"Hợp đồng là gì?"',
    );
    expect(out).toBe("Hợp đồng là gì?");
  });
  it("LLM rỗng → câu gốc", async () => {
    const out = await rewriteQuery("câu gốc", hist, async () => "   ");
    expect(out).toBe("câu gốc");
  });
  it("LLM lỗi → câu gốc (fallback, không ném)", async () => {
    const out = await rewriteQuery("câu gốc", hist, async () => {
      throw new Error("timeout");
    });
    expect(out).toBe("câu gốc");
  });
  it("guardrail: LLM 'phình' câu quá dài → dùng câu gốc", async () => {
    const long = "x".repeat(400);
    const out = await rewriteQuery("câu ngắn", hist, async () => long);
    expect(out).toBe("câu ngắn");
  });
});
