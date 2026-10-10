# Data model — Studio đợt 2 (178)

## Bảng `studio_result` sau migration v11 (PR 1 — duy nhất)

| Cột               | Kiểu / ràng buộc                                                                                                             | Ghi chú                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `id`              | TEXT PRIMARY KEY                                                                                                             | Giữ nguyên id cũ khi chuyển dữ liệu                           |
| `notebook_id`     | TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE                                                                      | Xoá notebook ⇒ xoá mọi phiên bản (FR-008)                     |
| `kind`            | TEXT NOT NULL CHECK (kind IN ('summary','keyPoints','faq','outline','studyGuide','briefing','timeline','keyTerms','custom')) | Mở sẵn cho PR 2–3                                             |
| `content`         | TEXT NOT NULL                                                                                                                | Text kèm `[n]`                                                |
| `citations_json`  | TEXT NOT NULL                                                                                                                | Đã hậu kiểm                                                   |
| `custom_prompt`   | TEXT NULL                                                                                                                    | Chỉ khi `kind = 'custom'`; ≤ 500 code point, đã chuẩn hoá     |
| `source_ids_json` | TEXT NULL                                                                                                                    | Mảng id đã chuẩn hoá; NULL = mọi nguồn ready (và mọi dòng cũ) |
| `parts`           | INTEGER NULL                                                                                                                 | Số phần đã tổng hợp; NULL ở dòng cũ                           |
| `truncated`       | INTEGER NULL CHECK (truncated IN (0,1))                                                                                      | NULL ở dòng cũ                                                |
| `local`           | INTEGER NULL CHECK (local IN (0,1))                                                                                          | 1 = tạo bằng "Tạo bằng AI cục bộ" (target local, 098)         |
| `created_at`      | INTEGER NOT NULL                                                                                                             | Giữ nguyên dòng cũ                                            |
| `updated_at`      | INTEGER NOT NULL                                                                                                             | = `created_at` với phiên bản mới (phiên bản không bị sửa)     |

Index: `idx_studio_notebook (notebook_id)` (tạo lại), `idx_studio_versions (notebook_id, kind, created_at)` (mới). **Không** còn UNIQUE(notebook_id, kind).

Bất biến: với mọi `(notebook_id, kind)`, số dòng ≤ `STUDIO_MAX_VERSIONS = 10` sau mỗi giao dịch insert (bản cũ nhất theo `created_at`, rồi `rowid`, bị xoá).

## Kiểu chia sẻ (`src/shared/ipc/types.ts`)

```ts
type StudioKind =
  // PR 2 thêm 4 loại; PR 3 thêm "custom"
  | "summary"
  | "keyPoints"
  | "faq"
  | "outline"
  | "studyGuide"
  | "briefing"
  | "timeline"
  | "keyTerms"
  | "custom";

interface StudioResult {
  // = một PHIÊN BẢN
  id: string;
  notebookId: string;
  kind: StudioKind;
  content: string;
  citations: Citation[];
  createdAt: number;
  parts?: number; // PR 1: nay đọc từ DB (trước chỉ có ở kết quả vừa tạo)
  truncated?: boolean; // PR 1: nay đọc từ DB
  local?: boolean; // PR 1 (G4): thay localKinds của renderer
  customPrompt?: string; // PR 3
  sourceIds?: string[]; // PR 4; thiếu = mọi nguồn
}

interface StudioGenerateInput {
  notebookId: string;
  kind: StudioKind;
  sourceId?: string; // 025 — giữ tương thích
  sourceIds?: string[]; // PR 4 — thắng sourceId; ≤ 50 sau khử trùng
  customPrompt?: string; // PR 3 — bắt buộc khi kind = "custom"
  target?: AiTarget;
  outputLanguage?: "vi" | "en";
  generationId?: string;
}

interface StudioDeleteVersionInput {
  notebookId: string;
  id: string;
} // PR 1
interface StudioStreamTokenEvent {
  generationId: string;
  delta: string;
} // PR 4
```

## Trạng thái renderer (`useStudio`)

| Trạng thái                                                                 | Thay cho   | Ghi chú                                                                    |
| -------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| `versions: Partial<Record<StudioKind, StudioResult[]>>`                    | `results`  | Mới nhất trước; nạp một lần từ `studio:list` khi đổi notebook              |
| `selected: Partial<Record<StudioKind, string>>`                            | —          | Id phiên bản đang xem; thiếu/không còn ⇒ mới nhất                          |
| `streamText: Partial<Record<StudioKind, string>>`                          | —          | PR 4 — buffer thô theo lượt hiện hành; hiển thị qua `stripCitationMarkers` |
| `loading`, `errors`, `onlineFailed`, `cancelling`, `progress`, `activeIds` | giữ nguyên | 146/149                                                                    |
| ~~`localKinds`~~                                                           | bỏ         | Đọc `version.local`                                                        |

Chuyển trạng thái một phiên bản: _đang tạo_ (chỉ ở renderer, `streamText`) → _đã lưu_ (insert thành công, thành bản mới nhất + được chọn) → _bị dọn_ (vượt
trần) hoặc _bị xoá_ (người dùng, sau xác nhận). Huỷ / lỗi / bị thay ⇒ không có phiên bản.

## Validation (main — nguồn sự thật)

| Đầu vào                  | Quy tắc                                                                                 | Lỗi                                               |
| ------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `kind`                   | ∈ `STUDIO_ALL_KINDS`                                                                    | `Error("Invalid Studio request.")` (như hiện tại) |
| `customPrompt`           | kind=custom: chuỗi; CRLF→LF; gỡ ký tự điều khiển trừ `\n`,`\t`; trim; 1..500 code point | `studioCustomPromptEmpty` / `TooLong` / `Invalid` |
| `sourceIds`              | mảng chuỗi; khử trùng; ≤ 50; mỗi id thuộc notebook và `ready`                           | `studioSourcesInvalid` / `studioSourceNotReady`   |
| delete `{notebookId,id}` | chuỗi không rỗng; chỉ xoá khi dòng khớp cả `notebook_id`                                | `{deleted:false}` (không ném)                     |
