import { describe, it, expect } from "vitest";
import {
  applyDraftEvent,
  playbackAt,
  selectionRange,
} from "../../src/renderer/features/meeting-capture/draft-view";
import type { MeetingDraftLine } from "../../src/shared/ipc/types";

// 186 PR B — quy tắc thuần của màn nháp: nhận push meeting:draft, bấm timestamp ⇒ (phân đoạn, offset), bôi chọn ⇒ khoảng
// thời gian để gắn đánh dấu.

const line = (
  id: string,
  tStart: number,
  tEnd: number,
  text = id,
  pending = false,
): MeetingDraftLine => ({ id, tStart, tEnd, text, pending });

describe("applyDraftEvent", () => {
  it("full ⇒ thay toàn bộ; phần đổi ⇒ gộp theo id; dòng rỗng ⇒ bỏ khỏi danh sách", () => {
    const a = applyDraftEvent([], {
      sessionId: "s",
      full: true,
      windows: [line("w1", 10, 20), line("w0", 0, 10)],
    });
    expect(a.map((l) => l.id)).toEqual(["w0", "w1"]);
    const b = applyDraftEvent(a, {
      sessionId: "s",
      full: false,
      windows: [line("w1", 10, 20, ""), line("w2", 20, 25, "mới", true)],
    });
    expect(b.map((l) => l.id)).toEqual(["w0", "w2"]);
    expect(b[1]?.pending).toBe(true);
  });
});

describe("playbackAt", () => {
  const segs = [
    { index: 0, durationSec: 300, closed: true },
    { index: 1, durationSec: 42, closed: false },
  ];
  it("thời gian audio ⇒ phân đoạn + offset", () => {
    expect(playbackAt(segs, 12)).toEqual({ seg: 0, offsetSec: 12 });
    expect(playbackAt(segs, 310)).toEqual({ seg: 1, offsetSec: 10 });
  });
  it("ngoài phạm vi ⇒ null", () => {
    expect(playbackAt(segs, 400)).toBeNull();
    expect(playbackAt(segs, -1)).toBeNull();
    expect(playbackAt([], 0)).toBeNull();
  });
});

describe("selectionRange", () => {
  const lines = [line("w0", 0, 10), line("w1", 10, 20), line("w2", 20, 30)];
  it("các dòng được chọn ⇒ [tStart đầu, tEnd cuối]", () => {
    expect(selectionRange(lines, ["w2", "w1"])).toEqual({
      tStart: 10,
      tEnd: 30,
    });
  });
  it("không chọn dòng nào ⇒ null", () => {
    expect(selectionRange(lines, [])).toBeNull();
    expect(selectionRange(lines, ["khác"])).toBeNull();
  });
});
