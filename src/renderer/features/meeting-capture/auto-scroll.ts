// 186 PR B (FR-021) — tự cuộn thông minh cho transcript nháp. THUẦN. Chỉ bám đáy khi người dùng đang ở (gần) đáy; cuộn lên ⇒
// thôi bám và khi có nội dung mới thì hiện nút "Quay về hiện tại".

export const AUTO_SCROLL_THRESHOLD_PX = 48;

export function shouldAutoScroll(m: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  threshold?: number;
}): boolean {
  const gap = m.scrollHeight - m.clientHeight - m.scrollTop;
  return gap <= (m.threshold ?? AUTO_SCROLL_THRESHOLD_PX);
}

export interface FollowState {
  following: boolean;
  showJump: boolean;
}

export type FollowEvent =
  | { type: "scroll"; atBottom: boolean }
  | { type: "content" }
  | { type: "jump" };

export const INITIAL_FOLLOW: FollowState = Object.freeze({
  following: true,
  showJump: false,
});

export function nextFollow(s: FollowState, e: FollowEvent): FollowState {
  switch (e.type) {
    case "jump":
      return INITIAL_FOLLOW;
    case "scroll":
      return e.atBottom
        ? INITIAL_FOLLOW
        : { following: false, showJump: s.showJump };
    case "content":
      return s.following || s.showJump ? s : { ...s, showJump: true };
  }
}
