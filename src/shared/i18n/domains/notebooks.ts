import type { Widen } from "../translate";

// 123 — khoá dịch domain "notebooks" (vi nguồn as const; en phải cùng cấu trúc + placeholder).

export const notebooksVi = {} as const;

export const notebooksEn: Widen<typeof notebooksVi> = {};
