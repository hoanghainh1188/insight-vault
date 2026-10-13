import { describe, it, expect } from "vitest";
import {
  shouldAutoScroll,
  nextFollow,
  INITIAL_FOLLOW,
} from "../../src/renderer/features/meeting-capture/auto-scroll";

// 186 PR B (FR-021) — tự cuộn thông minh: chỉ bám đáy khi người dùng đang ở đáy; cuộn lên ⇒ dừng bám + nút "Quay về hiện tại"
// khi có nội dung mới. THUẦN.

describe("shouldAutoScroll", () => {
  it("ở đáy hoặc cách đáy ≤ ngưỡng ⇒ true", () => {
    expect(
      shouldAutoScroll({
        scrollTop: 600,
        scrollHeight: 1000,
        clientHeight: 400,
      }),
    ).toBe(true);
    expect(
      shouldAutoScroll({
        scrollTop: 560,
        scrollHeight: 1000,
        clientHeight: 400,
      }),
    ).toBe(true);
  });

  it("cách đáy > ngưỡng ⇒ false; ngưỡng chỉnh được", () => {
    expect(
      shouldAutoScroll({
        scrollTop: 500,
        scrollHeight: 1000,
        clientHeight: 400,
      }),
    ).toBe(false);
    expect(
      shouldAutoScroll({
        scrollTop: 500,
        scrollHeight: 1000,
        clientHeight: 400,
        threshold: 120,
      }),
    ).toBe(true);
  });

  it("nội dung ngắn hơn khung ⇒ true", () => {
    expect(
      shouldAutoScroll({ scrollTop: 0, scrollHeight: 200, clientHeight: 400 }),
    ).toBe(true);
  });
});

describe("nextFollow", () => {
  it("mặc định bám đáy, không hiện nút", () => {
    expect(INITIAL_FOLLOW).toEqual({ following: true, showJump: false });
  });

  it("cuộn lên ⇒ thôi bám; có nội dung mới ⇒ hiện nút", () => {
    const up = nextFollow(INITIAL_FOLLOW, { type: "scroll", atBottom: false });
    expect(up).toEqual({ following: false, showJump: false });
    expect(nextFollow(up, { type: "content" })).toEqual({
      following: false,
      showJump: true,
    });
  });

  it("nội dung mới khi đang bám ⇒ không hiện nút", () => {
    expect(nextFollow(INITIAL_FOLLOW, { type: "content" })).toBe(
      INITIAL_FOLLOW,
    );
  });

  it("tự cuộn về đáy hoặc bấm nút ⇒ bám lại, ẩn nút", () => {
    const away = { following: false, showJump: true };
    expect(nextFollow(away, { type: "scroll", atBottom: true })).toEqual(
      INITIAL_FOLLOW,
    );
    expect(nextFollow(away, { type: "jump" })).toEqual(INITIAL_FOLLOW);
  });
});
