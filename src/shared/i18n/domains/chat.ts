import type { Widen } from "../translate";

// 123 — khoá dịch domain "chat" (vi nguồn as const; en phải cùng cấu trúc + placeholder).

export const chatVi = {} as const;

export const chatEn: Widen<typeof chatVi> = {};
