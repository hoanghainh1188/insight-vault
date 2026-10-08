import type { Widen } from "../translate";

// 123 — khoá dịch domain "search" (vi nguồn as const; en phải cùng cấu trúc + placeholder).

export const searchVi = {} as const;

export const searchEn: Widen<typeof searchVi> = {};
