# Data Model — Workspace enhancements (025)

**KHÔNG migration/lược đồ mới.** `studio_result` (021) giữ nguyên. Thay đổi chỉ ở kiểu qua IPC (additive) +
2 khoá localStorage (không phải dữ liệu nghiệp vụ). **KHÔNG map-reduce** → không `partsCount`.

## Kiểu IPC (shared/ipc/types.ts) — THÊM/MỞ RỘNG

```ts
// MỞ RỘNG (additive)
export interface StudioGenerateInput {
  notebookId: string;
  kind: StudioKind;
  sourceId?: string; // MỚI: lọc theo 1 nguồn; bỏ trống = toàn bộ nguồn ready
}

// StudioResult (021) GIỮ NGUYÊN — vẫn có truncated? (cắt cụt khi vượt ngân sách mới). KHÔNG thêm partsCount.

// MỚI — export .md
export interface StudioExportInput {
  content: string;
  suggestedName: string;
}
export interface StudioExportResult {
  saved: boolean;
  path?: string;
}
```

`Citation`/`Locator` tái dùng nguyên (013) — chip `[n]` luôn trỏ đúng **đoạn** (1-lượt, không map-reduce).

## Hằng số (main) — THAY ĐỔI

- `STUDIO_CONTEXT_BUDGET`: **8000 → 16000** (`src/main/services/studio/constants.ts`). Ảnh hưởng cả 021
  (studio 1-lượt) — bao phủ rộng hơn, vẫn dưới context window model local.

## Kiểu nội bộ main

- `sanitizeName(name: string): string` — bỏ ký tự cấm `/\:*?"<>|`, cắt độ dài, rỗng → mặc định
  ("studio"). THUẦN → test.
- Persist studio: `studio_result` KHÔNG đổi.

## localStorage (renderer — sở thích UI, không phải dữ liệu nghiệp vụ)

| Khoá                   | Giá trị                            | Ý nghĩa                                         |
| ---------------------- | ---------------------------------- | ----------------------------------------------- |
| `workspace-col-widths` | JSON `{src:number, studio:number}` | Độ rộng cột Nguồn/Studio (px), toàn cục         |
| `last-notebook-id`     | string (notebook id)               | Notebook mở gần nhất (cho nút Workspace ở rail) |

- `col-widths`: clamp `src`∈[220,460], `studio`∈[200,420]; parse hỏng/thiếu → default `{src:300,studio:260}`.
- `last-notebook-id`: notebook đã xoá → placeholder CTA (kiểm tồn tại qua `notebookList`).

## Validation (biên hệ thống)

- `sourceId` (nếu có) PHẢI thuộc notebook + ready; không → coi như không có nguồn (lỗi thân thiện / rỗng).
- `kind` ∈ 4 giá trị (như 021).
- Export: `suggestedName` sanitize; huỷ dialog → không ghi.
- localStorage: mọi đọc try/parse an toàn → default khi hỏng (không throw).

## State (một lượt generate)

```text
idle ──(bấm kind, scope=all|sourceId)──> loading[kind]
loading ──(chat ok, content≠rỗng)──> 1-lượt buildContext(budget 16000) + chip [n] chính xác → upsert → card
                                       (truncated=true + ghi chú nếu vẫn vượt 16000)
loading ──(0 chunk / runtime lỗi / content rỗng)──> error[kind] (không lưu)
```
