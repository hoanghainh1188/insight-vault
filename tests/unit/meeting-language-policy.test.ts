import { describe, it, expect } from "vitest";
import {
  initialLanguageState,
  languagePolicy,
  needsDetection,
  windowLanguage,
  languageForSegment,
  type LanguageState,
} from "../../src/main/services/meeting-capture/language-policy";

// 186 PR B (R7, D6 + ADR spike S2) — chính sách ngôn ngữ khi ghi. THUẦN.
// Spike S2: Whisper thiếu `language` mặc định tiếng Anh ⇒ không bao giờ trả null cho một cửa sổ; `multi` = phát hiện theo cửa sổ.

const detected = (lang: "vi" | "en", atSec: number, confidence = 0.9) =>
  ({ type: "detected", lang, confidence, atSec }) as const;

function run(
  s: LanguageState,
  ...events: Parameters<typeof languagePolicy>[1][]
): LanguageState {
  return events.reduce(languagePolicy, s);
}

describe("khởi tạo", () => {
  it("vi/en ⇒ khoá tay từ 0 s, không phát hiện", () => {
    const s = initialLanguageState("en");
    expect(s.locked).toEqual({ lang: "en", source: "user" });
    expect(s.changes).toEqual([{ atSec: 0, lang: "en", source: "user" }]);
    expect(needsDetection(s, 100, 100)).toBe(false);
    expect(windowLanguage(s)).toBe("en");
  });

  it("auto ⇒ chưa khoá; nháp trước khi khoá phát hiện theo cửa sổ", () => {
    const s = initialLanguageState("auto");
    expect(s.locked).toBeNull();
    expect(windowLanguage(s)).toBe("perWindow");
  });

  it("multi ⇒ luôn phát hiện theo cửa sổ, chính sách không khoá", () => {
    const s = run(initialLanguageState("multi"), detected("vi", 30));
    expect(s.locked).toBeNull();
    expect(windowLanguage(s)).toBe("perWindow");
    expect(needsDetection(s, 60, 60)).toBe(false);
  });
});

describe("auto: khoá sau 30 s lời nói, đánh giá lại mỗi 120 s", () => {
  it("chưa đủ 30 s lời nói ⇒ chưa phát hiện; đủ ⇒ phát hiện", () => {
    const s = initialLanguageState("auto");
    expect(needsDetection(s, 29, 40)).toBe(false);
    expect(needsDetection(s, 30, 40)).toBe(true);
  });

  it("phát hiện đầu tiên ⇒ khoá auto, áp từ 0 s, lần đánh giá sau = +120 s", () => {
    const s = run(initialLanguageState("auto"), detected("vi", 35));
    expect(s.locked).toEqual({ lang: "vi", source: "auto" });
    expect(s.changes).toEqual([{ atSec: 0, lang: "vi", source: "auto" }]);
    expect(windowLanguage(s)).toBe("vi");
    expect(needsDetection(s, 60, 154)).toBe(false);
    expect(needsDetection(s, 60, 155)).toBe(true);
  });

  it("khác ngôn ngữ khoá, tin cậy ≥ 0,7, 2 lần LIÊN TIẾP ⇒ gợi ý", () => {
    const s0 = run(initialLanguageState("auto"), detected("vi", 30));
    const once = run(s0, detected("en", 150));
    expect(once.suggestion).toBeNull();
    const twice = run(once, detected("en", 270));
    expect(twice.suggestion).toBe("en");
    expect(twice.locked?.lang).toBe("vi");
  });

  it("chuỗi bị ngắt (về lại ngôn ngữ khoá, hoặc tin cậy < 0,7) ⇒ đếm lại", () => {
    const s0 = run(initialLanguageState("auto"), detected("vi", 30));
    expect(
      run(s0, detected("en", 150), detected("vi", 270), detected("en", 390))
        .suggestion,
    ).toBeNull();
    expect(
      run(s0, detected("en", 150), detected("en", 270, 0.6)).suggestion,
    ).toBeNull();
  });

  it("chấp nhận gợi ý ⇒ khoá ngôn ngữ mới, thêm thay đổi tại thời điểm chấp nhận", () => {
    const s = run(
      initialLanguageState("auto"),
      detected("vi", 30),
      detected("en", 150),
      detected("en", 270),
      { type: "acceptSuggestion", atSec: 280 },
    );
    expect(s.locked).toEqual({ lang: "en", source: "auto" });
    expect(s.suggestion).toBeNull();
    expect(s.changes).toEqual([
      { atSec: 0, lang: "vi", source: "auto" },
      { atSec: 280, lang: "en", source: "auto" },
    ]);
    expect(windowLanguage(s)).toBe("en");
  });

  it("từ chối ⇒ không gợi ý lại ngôn ngữ đó; về lại ngôn ngữ khoá rồi đổi tiếp ⇒ gợi ý được lại", () => {
    const base = run(
      initialLanguageState("auto"),
      detected("vi", 30),
      detected("en", 150),
      detected("en", 270),
      { type: "dismissSuggestion" },
    );
    expect(base.suggestion).toBeNull();
    expect(
      run(base, detected("en", 390), detected("en", 510)).suggestion,
    ).toBeNull();
    expect(
      run(base, detected("vi", 390), detected("en", 510), detected("en", 630))
        .suggestion,
    ).toBe("en");
  });

  it("khoá tay giữa chừng ⇒ dừng phát hiện, bỏ gợi ý, thêm thay đổi nguồn user", () => {
    const s = run(
      initialLanguageState("auto"),
      detected("vi", 30),
      detected("en", 150),
      detected("en", 270),
      { type: "userLock", lang: "en", atSec: 300 },
    );
    expect(s.locked).toEqual({ lang: "en", source: "user" });
    expect(s.suggestion).toBeNull();
    expect(s.changes.at(-1)).toEqual({
      atSec: 300,
      lang: "en",
      source: "user",
    });
    expect(needsDetection(s, 999, 999)).toBe(false);
    expect(
      run(s, detected("vi", 400), detected("vi", 520)).suggestion,
    ).toBeNull();
  });

  it("khoá tay đúng ngôn ngữ đang dùng ⇒ không thêm thay đổi trùng", () => {
    const s = run(initialLanguageState("auto"), detected("vi", 30), {
      type: "userLock",
      lang: "vi",
      atSec: 100,
    });
    expect(s.changes).toHaveLength(1);
    expect(s.locked?.source).toBe("user");
  });

  it("không mutate trạng thái cũ", () => {
    const s0 = Object.freeze(initialLanguageState("auto"));
    const s1 = languagePolicy(s0, detected("vi", 30));
    expect(s0.locked).toBeNull();
    expect(s1).not.toBe(s0);
  });
});

describe("languageForSegment (bản chốt)", () => {
  const changes = [
    { atSec: 0, lang: "vi" as const, source: "auto" as const },
    { atSec: 400, lang: "en" as const, source: "auto" as const },
  ];

  it("không có thay đổi ⇒ null", () => {
    expect(languageForSegment([], 0, 300)).toBeNull();
  });

  it("phân đoạn nằm trọn một khoảng ⇒ ngôn ngữ khoảng đó", () => {
    expect(languageForSegment(changes, 0, 300)).toBe("vi");
    expect(languageForSegment(changes, 600, 900)).toBe("en");
  });

  it("phân đoạn cắt ngang thời điểm đổi ⇒ ngôn ngữ chiếm phần lớn", () => {
    expect(languageForSegment(changes, 300, 600)).toBe("en"); // vi 100 s, en 200 s
    expect(languageForSegment(changes, 200, 500)).toBe("vi"); // vi 200 s, en 100 s
  });

  it("thay đổi không theo thứ tự vẫn đúng", () => {
    expect(languageForSegment([...changes].reverse(), 300, 600)).toBe("en");
  });
});
