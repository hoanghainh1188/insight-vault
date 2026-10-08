import type { Widen } from "../translate";

// 123 — khoá dịch domain "ai" (vi nguồn as const; en phải cùng cấu trúc + placeholder).

export const aiVi = {} as const;

export const aiEn: Widen<typeof aiVi> = {};
