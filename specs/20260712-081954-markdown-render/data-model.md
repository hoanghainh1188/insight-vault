# Data Model — Markdown render (029)

**Không có thực thể dữ liệu / lưu trữ / migration.** Thuần trình bày.

## Kiểu nội bộ renderer (parse.ts)

```ts
type Inline =
  | { kind: "text"; value: string }
  | { kind: "bold"; children: Inline[] }
  | { kind: "italic"; children: Inline[] }
  | { kind: "code"; value: string }
  | { kind: "cite"; n: number }       // chip [n]
  | { kind: "link"; text: string };   // render text, không mở

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; inline: Inline[] }
  | { kind: "paragraph"; inline: Inline[] }
  | { kind: "bullet"; items: Inline[][] }
  | { kind: "ordered"; items: Inline[][] }
  | { kind: "code"; lines: string[] };  // giữ literal, không parse inline/chip
```

`cite.n` ánh xạ `citeByN` (Citation 013) khi render → chip mở Source Viewer (019). Không đổi Citation/Locator.
