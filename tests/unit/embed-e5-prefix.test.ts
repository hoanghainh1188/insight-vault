import { describe, it, expect } from "vitest";
import { withE5Prefix } from "../../src/main/services/embedding/e5-prefix";

describe("withE5Prefix", () => {
  it("gắn tiền tố query cho câu truy vấn", () => {
    expect(withE5Prefix("hợp đồng lao động", "query")).toBe(
      "query: hợp đồng lao động",
    );
  });

  it("gắn tiền tố passage cho đoạn văn", () => {
    expect(withE5Prefix("Điều 5. Quyền và nghĩa vụ", "passage")).toBe(
      "passage: Điều 5. Quyền và nghĩa vụ",
    );
  });

  it("chuỗi rỗng vẫn được gắn tiền tố", () => {
    expect(withE5Prefix("", "query")).toBe("query: ");
    expect(withE5Prefix("", "passage")).toBe("passage: ");
  });
});
