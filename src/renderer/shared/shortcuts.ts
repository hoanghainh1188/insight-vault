// Phím tắt toàn cục (043) — logic khớp THUẦN (test được) + dữ liệu bảng trợ giúp.

export type ShortcutAction = "new-notebook" | "focus-search" | "help";

export interface KeyLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  /** Con trỏ đang ở ô nhập (input/textarea/contenteditable) — chặn phím không-modifier như "?". */
  inField: boolean;
}

/**
 * Khớp sự kiện phím → hành động (hoặc null). Cmd/Ctrl+N/K hoạt động cả khi đang gõ (modifier). "?" chỉ khi
 * KHÔNG ở ô nhập (tránh nuốt khi người dùng gõ dấu hỏi).
 */
export function matchShortcut(e: KeyLike): ShortcutAction | null {
  const mod = e.metaKey || e.ctrlKey;
  const k = e.key.toLowerCase();
  if (mod && k === "n") return "new-notebook";
  if (mod && k === "k") return "focus-search";
  if (!mod && !e.inField && e.key === "?") return "help";
  return null;
}

export interface ShortcutDoc {
  keys: string[]; // token; "$mod" → ⌘ (mac) / Ctrl
  desc: string;
}

export const SHORTCUTS: ShortcutDoc[] = [
  { keys: ["$mod", "N"], desc: "Tạo notebook mới" },
  { keys: ["$mod", "K"], desc: "Tìm kiếm notebook" },
  { keys: ["Enter"], desc: "Gửi câu hỏi (khung Chat)" },
  { keys: ["Shift", "Enter"], desc: "Xuống dòng trong câu hỏi" },
  { keys: ["Esc"], desc: "Đóng hộp thoại / trình xem nguồn" },
  { keys: ["?"], desc: "Mở bảng phím tắt này" },
];

/** Có phải macOS không (để hiển thị ⌘ thay Ctrl). */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac/i.test(navigator.platform || navigator.userAgent || "");
}

/** Nhãn hiển thị cho 1 token phím. */
export function keyLabel(token: string, isMac: boolean): string {
  if (token === "$mod") return isMac ? "⌘" : "Ctrl";
  return token;
}
