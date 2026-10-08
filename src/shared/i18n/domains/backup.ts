import type { Widen } from "../translate";

// 123 — khoá dịch domain "backup" (vi nguồn as const; en phải cùng cấu trúc + placeholder).

export const backupVi = {} as const;

export const backupEn: Widen<typeof backupVi> = {};
