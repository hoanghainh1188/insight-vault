import { describe, it, expect } from "vitest";
import { searchTranscript } from "../../src/renderer/features/meeting-capture/viewer/transcript-search";

// 186 PR C2 (R18) — tìm trong transcript: bỏ dấu + không phân biệt hoa thường như FTS (073, kể cả đ→d); trả vị trí trên văn bản
// GỐC để tô sáng đúng chỗ. THUẦN.

const at = (text: string, r: { start: number; end: number }[]) =>
  r.map((m) => text.slice(m.start, m.end));

describe("searchTranscript", () => {
  const text =
    "Đề xuất dời demo. Chúng ta DỜI buổi demo sang thứ Sáu; đội đồng ý.";

  it("không dấu khớp có dấu, không phân biệt hoa thường, nhiều kết quả theo thứ tự", () => {
    const r = searchTranscript(text, "doi");
    expect(at(text, r)).toEqual(["dời", "DỜI", "đội"]);
  });

  it("đ ↔ d", () => {
    expect(at(text, searchTranscript(text, "de xuat"))).toEqual(["Đề xuất"]);
    expect(at(text, searchTranscript(text, "dong y"))).toEqual(["đồng ý"]);
  });

  it("query có dấu cũng khớp như nhau", () => {
    expect(searchTranscript(text, "Dời")).toEqual(
      searchTranscript(text, "doi"),
    );
  });

  it("query rỗng / chỉ khoảng trắng ⇒ []", () => {
    expect(searchTranscript(text, "")).toEqual([]);
    expect(searchTranscript(text, "   ")).toEqual([]);
  });

  it("ký tự đặc biệt được tìm theo nghĩa đen (không phải regex)", () => {
    const t = "Giá (dự kiến) là 1.5$ + thuế [VAT].*";
    expect(at(t, searchTranscript(t, "(du kien)"))).toEqual(["(dự kiến)"]);
    expect(at(t, searchTranscript(t, "[vat].*"))).toEqual(["[VAT].*"]);
    expect(searchTranscript(t, ".*x")).toEqual([]);
  });

  it("khoảng trắng thừa trong query được gộp", () => {
    expect(at(text, searchTranscript(text, "  buoi   demo "))).toEqual([
      "buổi demo",
    ]);
  });

  it("không chồng lấn: 'aa' trong 'aaaa' ⇒ 2 kết quả", () => {
    expect(searchTranscript("aaaa", "aa")).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ]);
  });

  it("văn bản ở dạng tổ hợp (NFD) ⇒ vị trí bao trọn cả dấu", () => {
    const nfd = "Chào bạn".normalize("NFD");
    const [m] = searchTranscript(nfd, "chao");
    expect(nfd.slice(m!.start, m!.end).normalize("NFC")).toBe("Chào");
  });
});
