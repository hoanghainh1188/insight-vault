import { describe, it, expect } from "vitest";
import { fakeRerankScore } from "../../src/main/services/rerank/fake-score";

// 109 (T029): điểm giả TẤT ĐỊNH cho e2e (IV_RERANK_FAKE) — tỉ lệ từ (≥ 3 ký tự, không phân biệt hoa/thường, bỏ dấu câu) của
// câu hỏi có mặt trong đoạn.

describe("fakeRerankScore", () => {
  it("không trùng từ nào ⇒ 0; trùng hết ⇒ 1; tất định", () => {
    expect(fakeRerankScore("giá vé máy bay", "Phở là món ăn")).toBe(0);
    expect(fakeRerankScore("Phở món", "phở là MÓN ăn.")).toBe(1);
    expect(fakeRerankScore("phở giá", "phở")).toBe(0.5);
    expect(fakeRerankScore("phở giá", "phở")).toBe(
      fakeRerankScore("phở giá", "phở"),
    );
  });

  it("câu hỏi không có từ ≥ 3 ký tự ⇒ 0", () => {
    expect(fakeRerankScore("là gì?", "là gì")).toBe(0);
  });
});
