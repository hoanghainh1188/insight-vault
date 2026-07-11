# Data Model — Studio (021-studio)

## Bảng mới: `studio_result` (migration #3)

Lưu kết quả tổng hợp Studio theo notebook. Append-only migration (PRAGMA user_version 2→3).

| Cột              | Kiểu    | Ràng buộc                                                        | Ý nghĩa                                        |
| ---------------- | ------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| `id`             | TEXT    | PRIMARY KEY                                                      | ID kết quả (uuid)                              |
| `notebook_id`    | TEXT    | NOT NULL, REFERENCES `notebook(id)` ON DELETE CASCADE            | Notebook chứa kết quả                          |
| `kind`           | TEXT    | NOT NULL, CHECK(kind IN ('summary','keyPoints','faq','outline')) | Loại tổng hợp                                  |
| `content`        | TEXT    | NOT NULL                                                         | Nội dung văn bản (kèm token `[n]`)             |
| `citations_json` | TEXT    | NOT NULL                                                         | `Citation[]` serialize (JSON) — khôi phục chip |
| `created_at`     | INTEGER | NOT NULL                                                         | Mốc tạo (epoch ms)                             |
| `updated_at`     | INTEGER | NOT NULL                                                         | Mốc cập nhật gần nhất                          |

**Ràng buộc bảng**: `UNIQUE(notebook_id, kind)` → mỗi notebook giữ đúng 1 bản mới nhất mỗi loại (FR-008).

**Upsert**: `INSERT INTO studio_result (…) VALUES (…) ON CONFLICT(notebook_id, kind) DO UPDATE SET
content=excluded.content, citations_json=excluded.citations_json, updated_at=excluded.updated_at`
(giữ `id`/`created_at` cũ khi ghi đè, hoặc thay tuỳ chọn — repo quyết định, test chốt hành vi).

**Xoá theo**: FK `ON DELETE CASCADE` + `PRAGMA foreign_keys=ON` (đã bật ở 011) → xoá notebook xoá luôn kết
quả (FR-009).

## Kiểu qua IPC (shared/ipc/types.ts) — THÊM

```ts
export type StudioKind = "summary" | "keyPoints" | "faq" | "outline";

export interface StudioResult {
  id: string;
  notebookId: string;
  kind: StudioKind;
  content: string; // text kèm [n]
  citations: Citation[]; // đã hậu kiểm; có thể rỗng nếu content rỗng
  createdAt: number;
  truncated?: boolean; // true khi số chunk đưa vào context < tổng chunk notebook (chỉ tổng hợp phần đầu)
}

export interface StudioGenerateInput {
  notebookId: string;
  kind: StudioKind;
}
```

`Citation` + `Locator` tái dùng nguyên từ 013 (KHÔNG sửa):
`Citation { n, chunkId, sourceId, sourceTitle, locator }`, `Locator { page, charStart, charEnd }`.

## Kiểu nội bộ main (không qua IPC)

- Tái dùng `ScoredChunk { chunk, sourceTitle, score }` + `RetrievedChunk` + `BuiltContext` (013). Studio
  dựng `ScoredChunk` từ `Chunk` (011) với `score = 0` (thứ tự do mảng quyết định, `buildContext` không sort).
- `STUDIO_CONTEXT_BUDGET = 8000` (hằng riêng trong `src/main/services/studio/`).

## Quan hệ

```text
notebook (1) ──< source (n, 011) ──< chunk (n, 011)     # nguồn nguyên liệu ngữ cảnh
notebook (1) ──< studio_result (n ≤ 4, MỚI)             # ≤1 bản mỗi kind
studio_result.citations[*].chunkId ─→ chunk.id          # chip trỏ chunk THẬT (Constitution II)
```

## Validation (biên hệ thống)

- `kind` PHẢI thuộc 4 giá trị hợp lệ (CHECK ở DB + validate ở service trước khi gọi LLM).
- `notebookId` PHẢI tồn tại; nếu notebook không có nguồn `ready` → service từ chối tạo (UI đã vô hiệu nút,
  service vẫn kiểm — fail fast, thông báo thân thiện).
- `content` rỗng sau chat → KHÔNG lưu bản rỗng; trả lỗi thân thiện.
- `citations_json` parse an toàn khi đọc lại; parse lỗi → coi như citations rỗng (không vỡ UI).

## State transitions (một lượt tạo)

```text
idle ──(bấm nút kind)──> loading[kind]
loading[kind] ──(chat ok, content≠rỗng)──> upsert → saved → hiển thị card[kind] (idle)
loading[kind] ──(runtime chưa ready / chat lỗi / content rỗng)──> error[kind] (không lưu)
saved ──(bấm lại kind)──> loading[kind] → upsert ghi đè (thay card cũ cùng kind)
```
