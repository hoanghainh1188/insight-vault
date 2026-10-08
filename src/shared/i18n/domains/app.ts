import type { Widen } from "../translate";

// 123 — khoá dịch domain "app" (vi nguồn as const; en phải cùng cấu trúc + placeholder).

export const appVi = {} as const;

export const appEn: Widen<typeof appVi> = {};
