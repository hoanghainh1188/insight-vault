import { describe, it, expect } from "vitest";
import {
  DOWNGRADE_RTF,
  PARTIAL_OFF_RTF,
  fallbackFailed,
  initialDraftPerf,
  recordDraftRtf,
  summarizeRtf,
  fallbackNowReady,
} from "../../src/main/services/meeting-capture/draft-model-policy";

// 186 PR B — tự hạ cấp model nháp (ADR meeting-asr-spike mục 4–5, chốt tạm 2026-10-13). THUẦN, không mutate.
// Trung bình trượt 3 cửa sổ đủ: > 0,5 ⇒ chuyển nháp sang model dự phòng (một lần, không nâng lại); > 0,25 ⇒ tắt lượt 5 s.

const feed = (
  rtfs: number[],
  s = initialDraftPerf(),
): ReturnType<typeof initialDraftPerf> =>
  rtfs.reduce((acc, r) => recordDraftRtf(acc, r), s);

describe("recordDraftRtf", () => {
  it("bắt đầu ở model chính, bật lượt 5 s", () => {
    const s = initialDraftPerf();
    expect(s.tier).toBe("primary");
    expect(s.partialPass).toBe(true);
    expect(s.downgraded).toBe(false);
  });

  it("chưa đủ 3 mẫu ⇒ chưa quyết gì dù rất chậm", () => {
    const s = feed([2, 2]);
    expect(s.tier).toBe("primary");
    expect(s.partialPass).toBe(true);
  });

  it("trung bình > 0,5 ⇒ hạ cấp, tắt lượt 5 s, xoá cửa sổ đo", () => {
    const s = feed([0.6, 0.7, 0.8]);
    expect(s.tier).toBe("fallback");
    expect(s.downgraded).toBe(true);
    expect(s.partialPass).toBe(false);
    expect(s.recent).toEqual([]);
  });

  it("một cửa sổ chậm lẻ không hạ cấp (trung bình trượt)", () => {
    const s = feed([0.1, 1.2, 0.1]);
    expect(1.4 / 3).toBeLessThan(DOWNGRADE_RTF);
    expect(s.tier).toBe("primary");
  });

  it("0,25 < trung bình ≤ 0,5 ⇒ chỉ tắt lượt 5 s (không bật lại)", () => {
    const s = feed([0.3, 0.3, 0.3]);
    expect(0.3).toBeGreaterThan(PARTIAL_OFF_RTF);
    expect(s.tier).toBe("primary");
    expect(s.partialPass).toBe(false);
    expect(feed([0.05, 0.05, 0.05], s).partialPass).toBe(false);
  });

  it("đã hạ cấp thì không hạ/nâng tiếp dù nhanh hay chậm", () => {
    const down = feed([0.9, 0.9, 0.9]);
    expect(feed([0.01, 0.01, 0.01], down).tier).toBe("fallback");
    expect(feed([3, 3, 3], down).tier).toBe("fallback");
  });

  it("bỏ qua giá trị không hợp lệ", () => {
    const s = feed([Number.NaN, -1, Number.POSITIVE_INFINITY]);
    expect(s.recent).toEqual([]);
    expect(s.all).toEqual([]);
  });

  it("không mutate trạng thái vào", () => {
    const s = initialDraftPerf();
    recordDraftRtf(s, 0.2);
    expect(s.recent).toEqual([]);
    expect(s.all).toEqual([]);
  });

  it("model dự phòng không có (offline) ⇒ quay về model chính, không thử hạ cấp nữa", () => {
    const s = fallbackFailed(feed([0.9, 0.9, 0.9]));
    expect(s.tier).toBe("primary");
    expect(s.fallbackUnavailable).toBe(true);
    expect(feed([0.9, 0.9, 0.9], s).tier).toBe("primary");
  });

  it("initialDraftPerf(false) ⇒ không có lượt 5 s ngay từ đầu", () => {
    expect(initialDraftPerf(false).partialPass).toBe(false);
  });
});

describe("summarizeRtf", () => {
  it("rỗng ⇒ null", () => {
    expect(summarizeRtf([])).toBeNull();
  });

  it("trung bình + p95 (làm tròn 3 chữ số)", () => {
    const values = Array.from({ length: 20 }, (_, i) => (i + 1) / 100);
    expect(summarizeRtf(values)).toEqual({
      count: 20,
      mean: 0.105,
      p95: 0.19,
    });
  });
});

describe("model dự phòng chưa có trên máy (quyết định 2026-10-13)", () => {
  it("chậm nhưng chưa có model dự phòng ⇒ KHÔNG hạ cấp (không tự tải), đánh dấu không khả dụng", () => {
    const s = [0.9, 0.9, 0.9].reduce(
      (acc, r) => recordDraftRtf(acc, r, false),
      initialDraftPerf(),
    );
    expect(s.tier).toBe("primary");
    expect(s.downgraded).toBe(false);
    expect(s.fallbackUnavailable).toBe(true);
    expect(s.partialPass).toBe(false);
  });

  it("người dùng tải model dự phòng ⇒ hạ cấp được ở lần chậm kế tiếp", () => {
    const blocked = [0.9, 0.9, 0.9].reduce(
      (acc, r) => recordDraftRtf(acc, r, false),
      initialDraftPerf(),
    );
    const ready = fallbackNowReady(blocked);
    expect(ready.fallbackUnavailable).toBe(false);
    const s = [0.9, 0.9, 0.9].reduce(
      (acc, r) => recordDraftRtf(acc, r, true),
      ready,
    );
    expect(s.tier).toBe("fallback");
  });
});
