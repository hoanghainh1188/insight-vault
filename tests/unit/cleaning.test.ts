import { describe, it, expect } from "vitest";
import { cleanText } from "../../src/main/services/ingestion/cleaning";

describe("cleanText", () => {
  it("chuẩn hoá CRLF → LF", () => {
    expect(cleanText("a\r\nb\rc")).toBe("a\nb\nc");
  });
  it("gộp space/tab thừa", () => {
    expect(cleanText("a    b\t\tc")).toBe("a b c");
  });
  it("bỏ khoảng trắng cuối dòng + gộp dòng trống", () => {
    expect(cleanText("a  \n\n\n\nb")).toBe("a\n\nb");
  });
  it("trim đầu/cuối", () => {
    expect(cleanText("\n\n  xin chào  \n\n")).toBe("xin chào");
  });
  it("giữ nội dung unicode", () => {
    expect(cleanText("Việt 📓 Nam")).toBe("Việt 📓 Nam");
  });
});
