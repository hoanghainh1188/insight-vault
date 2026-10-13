// 186 PR C1 — phím tắt khi app focus (research R17, clarify A6 — không dùng phím tắt toàn cục). THUẦN.
// Mod+Shift+P: tạm dừng/tiếp tục · Mod+Shift+M: đánh dấu · Mod+Shift+E: kết thúc (chỉ mở hộp xác nhận).
// Mod = Cmd trên macOS, Ctrl trên Windows/Linux. Khớp theo VỊ TRÍ phím (`code`) để bố cục bàn phím khác vẫn dùng được; tổ hợp
// Mod+Shift không đụng việc gõ chữ nên vẫn chạy khi đang ở ô nhập văn bản.

export type MeetingShortcut = "togglePause" | "mark" | "end";

export interface ShortcutKeyEvent {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  repeat: boolean;
}

const BY_LETTER: Readonly<Record<string, MeetingShortcut>> = {
  P: "togglePause",
  M: "mark",
  E: "end",
};
const LETTER_OF: Readonly<Record<MeetingShortcut, string>> = {
  togglePause: "P",
  mark: "M",
  end: "E",
};

const isMac = (platform: string): boolean => platform === "darwin";

export function matchMeetingShortcut(
  e: ShortcutKeyEvent,
  platform: string,
): MeetingShortcut | null {
  const mod = isMac(platform)
    ? e.metaKey && !e.ctrlKey
    : e.ctrlKey && !e.metaKey;
  if (!mod || !e.shiftKey || e.altKey || e.repeat) return null;
  const letter = /^Key[A-Z]$/.test(e.code)
    ? e.code.slice(3)
    : e.key.toUpperCase();
  return BY_LETTER[letter] ?? null;
}

/** Nhãn hiển thị cạnh nút + giá trị `aria-keyshortcuts`. */
export function shortcutLabel(
  action: MeetingShortcut,
  platform: string,
): { display: string; aria: string } {
  const k = LETTER_OF[action];
  return isMac(platform)
    ? { display: `⌘⇧${k}`, aria: `Meta+Shift+${k}` }
    : { display: `Ctrl+Shift+${k}`, aria: `Control+Shift+${k}` };
}
