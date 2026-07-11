import type { NotebookColor } from "./ipc/types";

// Palette màu cố định cho notebook (A1) — họ màu prototype S1. DÙNG CHUNG main (validate) + renderer (picker).
export const PALETTE: readonly NotebookColor[] = [
  "#1E6B57",
  "#3B6EA5",
  "#8A5A9E",
  "#B4713C",
  "#2F8A6B",
  "#B4453C",
  "#6D7A8C",
  "#C08A2E",
] as const;

export const DEFAULT_COLOR: NotebookColor = PALETTE[0];

export function isPaletteColor(v: unknown): v is NotebookColor {
  return typeof v === "string" && (PALETTE as readonly string[]).includes(v);
}
