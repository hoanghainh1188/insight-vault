# Research — Markdown render (029)

6 ambiguity chốt (clarify). #1 = hand-roll (người dùng chọn). Mục này chốt thiết kế parser.

## R1 — parse.ts (THUẦN — CRUX)

- **Decision**: `parseMarkdown(text): Block[]`. Quét theo DÒNG:
  - Khối mã ` ``` ` (fence) → `CodeBlock{lines}` (giữ literal, KHÔNG parse inline/chip bên trong).
  - Tiêu đề `#`/`##`/`###` (đầu dòng) → `Heading{level, inline}`.
  - Danh sách `- `/`* ` → `BulletList{items: Inline[][]}`; `1. ` → `OrderedList`.
  - Dòng trống ngăn đoạn; còn lại gộp thành `Paragraph{inline}`.
- Inline parse (trong heading/para/list item, KHÔNG trong code block): tokenize theo thứ tự an toàn →
  `code` (`` `x` ``), `bold` (`**x**`), `italic` (`*x*`), `cite` (`[n]`), `link` (`[text](url)` → text),
  `text`. Trả `Inline[]` (kiểu rời rạc, KHÔNG chuỗi HTML).
- **Rationale**: thuần (string → cấu trúc) → test tất định. Chip `[n]` là 1 loại inline token → chỉ sinh
  trong ngữ cảnh không-code (FR-004). KHÔNG regex sinh HTML → không XSS.
- **Alternatives**: lib (bác — dependency + AST phức tạp cho chip); regex→HTML+innerHTML (bác — XSS).

## R2 — MarkdownContent.tsx (render Block[] → React node)

- **Decision**: map Block → React element (`<h1..3>`, `<p>`, `<ul>/<ol><li>`, `<pre><code>`); map Inline →
  `<strong>`/`<em>`/`<code>`/text/`<span>` (link text) và `cite` → `<button className="cite">` (tái dùng
  `formatCitationLabel` + `onCite` như `renderWithChips` cũ). CHỈ React node (không `dangerouslySetInnerHTML`).
- **Rationale**: an toàn theo cấu trúc; chip giữ hành vi 013/019.

## R3 — Điểm chạm

- `MessageBubble.tsx` (013): thay `renderWithChips(content, citeByN, onCite)` cho câu trả lời AI bằng
  `<MarkdownContent content={content} citeByN={citeByN} onCite={onCite}/>`. Tin user giữ text thuần.
- `StudioResultCard.tsx` (021): thay `renderWithChips(...)` trong `.studio-card-body` tương tự.
- Gỡ `renderWithChips`/`CHIP_RE` lặp ở 2 file (chuyển vào MarkdownContent).
- CSS: `.bubble-text`/`.studio-card-body` bỏ `pre-wrap`; thêm style heading/list/code (`.md-*` hoặc trực
  tiếp element trong scope).

## Tổng kết

Không NEEDS CLARIFICATION. Không dependency/IPC/DB. CRUX = `parse.ts` (test kỹ: block/inline/chip-không-
trong-code/an-toàn HTML). Chip `[n]` giữ hành vi. Chống hồi quy = e2e chip cũ xanh.
