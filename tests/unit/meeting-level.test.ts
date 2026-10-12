import { describe, it, expect } from "vitest";
import {
  classifyLevel,
  nextLevel,
  INITIAL_LEVEL,
  LEVEL_HOLD_MS,
  CLIP_HOLD_MS,
} from "../../src/renderer/features/meeting-capture/level";

// 186 PR B (FR-024) — chỉ báo âm lượng 3 trạng thái (có nhãn chữ), có độ trễ để không nhấp nháy. THUẦN.

const ok = { rmsDbfs: -25, peakDbfs: -6 };
const weak = { rmsDbfs: -55, peakDbfs: -40 };
const clip = { rmsDbfs: -8, peakDbfs: -0.5 };

describe("classifyLevel", () => {
  it("peak > -1 ⇒ clipping (ưu tiên); rms < -50 ⇒ weak; còn lại ok", () => {
    expect(classifyLevel(clip)).toBe("clipping");
    expect(classifyLevel({ rmsDbfs: -60, peakDbfs: -0.2 })).toBe("clipping");
    expect(classifyLevel(weak)).toBe("weak");
    expect(classifyLevel(ok)).toBe("ok");
    expect(classifyLevel({ rmsDbfs: -50, peakDbfs: -1 })).toBe("ok");
  });

  it("-Infinity (im lặng tuyệt đối) ⇒ weak", () => {
    expect(
      classifyLevel({
        rmsDbfs: Number.NEGATIVE_INFINITY,
        peakDbfs: Number.NEGATIVE_INFINITY,
      }),
    ).toBe("weak");
  });
});

describe("nextLevel (trễ chuyển trạng thái)", () => {
  it("bắt đầu ok; weak phải giữ đủ LEVEL_HOLD_MS mới chuyển", () => {
    let s = nextLevel(INITIAL_LEVEL, weak, 0);
    expect(s.state).toBe("ok");
    s = nextLevel(s, weak, LEVEL_HOLD_MS - 1);
    expect(s.state).toBe("ok");
    s = nextLevel(s, weak, LEVEL_HOLD_MS);
    expect(s.state).toBe("weak");
  });

  it("dao động qua lại ⇒ không đổi trạng thái", () => {
    let s = INITIAL_LEVEL;
    for (let t = 0; t < 3000; t += 100)
      s = nextLevel(s, t % 200 === 0 ? weak : ok, t);
    expect(s.state).toBe("ok");
  });

  it("clipping hiện NGAY, rời clipping cần CLIP_HOLD_MS", () => {
    let s = nextLevel(INITIAL_LEVEL, clip, 0);
    expect(s.state).toBe("clipping");
    s = nextLevel(s, ok, 100);
    s = nextLevel(s, ok, 100 + CLIP_HOLD_MS - 1);
    expect(s.state).toBe("clipping");
    s = nextLevel(s, ok, 100 + CLIP_HOLD_MS);
    expect(s.state).toBe("ok");
  });

  it("không mutate", () => {
    const s0 = Object.freeze({ ...INITIAL_LEVEL });
    nextLevel(s0, weak, 0);
    expect(s0.state).toBe("ok");
  });
});
