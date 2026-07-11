# Data Model — 019-source-viewer (Phase 1)

KHÔNG schema/migration mới. Chỉ ĐỌC `source`/`chunk` (011) + THÊM type trao đổi.

## Shared types (`src/shared/ipc/types.ts` — THÊM)

```ts
/** Mốc trang cho PDF: nơi mỗi trang bắt đầu trong `text` (offset ký tự toàn cục). */
export interface PageBreak {
  page: number; // 1-based
  offset: number; // charStart của trang trong text
}

/** Nội dung nguồn để hiển thị ở viewer — dựng runtime từ chunk, không lưu bền. */
export interface SourceContent {
  kind: SourceKind; // pdf | docx | txt | md | url (từ 011)
  title: string;
  pageCount: number | null; // PDF: số trang; khác: null
  text: string; // toàn văn đã-làm-sạch tái dựng (== T gốc lúc chunk)
  pageBreaks: PageBreak[]; // chỉ PDF; non-PDF: []
}
```

`source:getContent(sourceId)` → `SourceContent | null` (null nếu source đã xoá — A7).

## Type nội bộ main (source-viewer service)

```ts
// Input tối thiểu cho reconstruct (từ Chunk của 011): text + offset. Hàm THUẦN, test được.
interface ReconstructInput {
  text: string;
  charStart: number;
  charEnd: number;
  page: number | null;
}
// reconstructText(chunks: ReconstructInput[]): string   // nối + fill gap + cắt overlap
// derivePageBreaks(chunks: ReconstructInput[]): PageBreak[]  // min charStart theo page
```

## Type nội bộ renderer (highlight)

```ts
// Chia text để render highlight — hàm THUẦN.
interface Segment {
  text: string;
  kind: "plain" | "highlight";
  pageMark?: number; // nếu segment bắt đầu 1 trang mới (chèn mốc "Trang N")
}
// buildSegments(text, charStart|null, charEnd|null, pageBreaks): Segment[]
//   citation rỗng (mở từ cột Nguồn) → không có segment 'highlight'.
```

## State viewer (renderer)

```ts
interface ViewerState {
  open: boolean;
  sourceId: string | null;
  citation: Citation | null; // null khi mở trực tiếp từ cột Nguồn (A9) → không highlight
}
```

## Luồng dữ liệu

```
Bấm chip [n] (Citation) / bấm nguồn (sourceId)
  → useSourceViewer.open(citation | sourceId)
  → window.api.sourceGetContent(sourceId) → SourceContent | null
  → null → "Nguồn không còn tồn tại"; else:
  → buildSegments(text, citation?.locator, pageBreaks) → Segment[]
  → render overlay panel; auto-scroll tới segment 'highlight' (hoặc đầu nếu không citation)
```

## Ràng buộc (từ FR/Constitution)

- Highlight `[charStart, charEnd)` khớp CHÍNH XÁC `chunk.text` (FR-002/SC-002) — reconstruct đã verify.
- `text` = toàn văn đã-làm-sạch; render bằng text node (không innerHTML) — chống XSS.
- `getContent` đọc CHỈ ở main; không log `text` (Constitution III).
- URL: `text` là bản đã lưu (từ chunk) — không fetch lại (Constitution I).
