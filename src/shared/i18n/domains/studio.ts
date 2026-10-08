import type { Widen } from "../translate";

// 123 — khoá dịch domain "studio" (vi nguồn as const; en phải cùng cấu trúc + placeholder).

export const studioVi = {} as const;

export const studioEn: Widen<typeof studioVi> = {};
