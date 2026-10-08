import type { Widen } from "../translate";

// 123 — khoá dịch domain "crash" (vi nguồn as const; en phải cùng cấu trúc + placeholder).

export const crashVi = {} as const;

export const crashEn: Widen<typeof crashVi> = {};
