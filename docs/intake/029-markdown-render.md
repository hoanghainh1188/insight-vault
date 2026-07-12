# Design intake — 029-markdown-render

- Feature: `029-markdown-render` (issue #29) — hiển thị markdown cho Chat + Studio, giữ chip `[n]`
- Nguồn: yêu cầu người dùng (2026-07-12). Kế thừa 013 (MessageBubble/renderWithChips), 021
  (StudioResultCard), 019 (openCitation). THUẦN renderer.
- Blocked-by: không.

## Bối cảnh

Câu trả lời Chat + kết quả Studio render TEXT THUẦN + chip `[n]` (`renderWithChips` — split theo `[\d+]`).
021 cố ý bỏ markdown (tránh XSS/dependency). Nay muốn markdown dễ đọc, VẪN giữ chip `[n]` bấm được.

## Phạm vi

- Render markdown AN TOÀN (React node, KHÔNG innerHTML) cho MessageBubble (Chat) + StudioResultCard.
- Subset: tiêu đề `#..###`, `**đậm**`, `*nghiêng*`, `` `code inline` ``, danh sách `- `/`1. `, khối code ` ``` `,
  đoạn văn, xuống dòng. Link: render text (không điều hướng ra ngoài — local-first).
- Chip `[n]` inline trong markdown, giữ `onCite` → Source Viewer.
- Tách helper dùng chung `renderer/shared/markdown/` (2 nơi hiện lặp `renderWithChips`).

## Ambiguities (cho /speckit-clarify)

**#1 (CỐT LÕI) Hand-roll vs lib.**

- (a) **Hand-roll markdown tối giản → React elements — KHUYẾN NGHỊ.** Tự parse subset trên thành cây React
  (không innerHTML → XSS-safe by construction; không dependency/CDN — khớp ethos dự án như `icons.tsx`).
  Kiểm soát tuyệt đối việc chèn chip `[n]` inline. Nhược: tự viết parser (nhiều test), subset giới hạn.
- (b) Lib npm cục bộ (`react-markdown` + `rehype-sanitize`): markdown đầy đủ hơn, render React (không
  innerHTML) + sanitize. Nhược: thêm vài dependency; tích hợp chip `[n]` phải qua custom renderer/plugin AST
  (phức tạp hơn); phải audit sanitize config.
  → Khuyến nghị (a): an toàn nhất + no-dep + kiểm soát chip. (Nếu muốn markdown đầy đủ/bảng/ảnh sau → cân nhắc
  (b) ở feature riêng.)

**#2 Áp cho đâu.** Chat (câu trả lời AI, KHÔNG áp cho tin người dùng — giữ text) + Studio (mọi kind). →
Khuyến nghị vậy.

**#3 Chip `[n]` trong markdown.** Tokenize `[n]` ở lớp INLINE (cùng chỗ xử lý đậm/nghiêng/code) → chip là
`<button className="cite">`; `[n]` trong khối code KHÔNG thành chip (giữ literal). → Khuyến nghị.

**#4 Link.** Markdown link `[text](https://…)` → render **text** (styled, KHÔNG điều hướng ra ngoài — Constitution I
local-first). URL trần → render text. → Khuyến nghị (không mở link ngoài).

**#5 reduced-motion / an toàn.** Không animation mới. KHÔNG `dangerouslySetInnerHTML`/`innerHTML` — chỉ React
node. → Khuyến nghị.

**#6 `white-space`.** Bỏ `pre-wrap` toàn khối (markdown tự xử lý xuống dòng/đoạn); khối code giữ `pre`. →
Khuyến nghị.

## Prompt for /speckit-specify (rút gọn — hoàn chỉnh sau clarify)

> Hiển thị markdown an toàn cho câu trả lời Chat (013) + kết quả Studio (021), GIỮ chip [n] bấm được (mở
> Source Viewer 019). Hand-roll parser markdown tối giản → React elements (KHÔNG innerHTML/CDN/dependency —
> XSS-safe, local-first): tiêu đề #..###, **đậm**, _nghiêng_, `code`, danh sách -/1., khối code ```, đoạn,
> xuống dòng. Chip [n] tokenize ở lớp inline (không trong khối code). Link → render text, không điều hướng
> ngoài. Tách helper renderer/shared dùng chung (thay renderWithChips ở MessageBubble + StudioResultCard).
> Ràng buộc: Constitution I (no-CDN/egress), II (chip [n] giữ hành vi/locator), III (render React node không
> innerHTML), IV (parser thuần test kỹ). Ngoài phạm vi: bảng/ảnh/HTML thô, link điều hướng ngoài, đổi dữ liệu
> đã lưu, main/IPC/DB.
