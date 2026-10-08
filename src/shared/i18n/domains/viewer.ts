import type { Widen } from "../translate";

// 123 — khoá dịch domain "viewer" (vi nguồn as const; en phải cùng cấu trúc + placeholder).

export const viewerVi = {} as const;

export const viewerEn: Widen<typeof viewerVi> = {};
