# markdown-render clarify — chốt 6 ambiguity (029-markdown-render)

- Ngày: 2026-07-12
- Feature: `029-markdown-render` (issue #29)
- Nguồn: `docs/intake/029-markdown-render.md` + yêu cầu người dùng
- Người quyết định: hoanghainh1188 (2026-07-12).

## Quyết định

**1. (CỐT LÕI) ~~HAND-ROLL markdown tối giản~~ → ĐÃ REVISE, xem mục "Sửa đổi" bên dưới.** _(Nguyên bản:_
tự parse subset thành cây React node. Đã thay bằng `react-markdown` sau khi kiểm thử thực tế cho thấy parser
tay xử lý xuống dòng/biên không đúng CommonMark._)_

**2. Áp cho Chat (câu trả lời AI) + Studio (mọi kind).** KHÔNG áp cho tin người dùng (giữ text thuần).

**3. Chip `[n]` tokenize ở lớp INLINE** (cùng chỗ đậm/nghiêng/code) → chip `<button className="cite">` giữ
`onCite`. `[n]` trong khối code / code inline → giữ LITERAL (không thành chip).

**4. Link `[text](https://…)` / URL trần → render TEXT** (styled), KHÔNG điều hướng ra ngoài (Constitution I
local-first — tránh egress từ nội dung do model sinh).

**5. An toàn:** chỉ React node, KHÔNG `innerHTML`. Không animation mới.

**6. `white-space`:** bỏ `pre-wrap` toàn khối (markdown tự xử lý đoạn/xuống dòng); khối code giữ `pre`/mono.

## Điểm chạm

- `src/renderer/shared/markdown/` (MỚI): `parseMarkdown(text)` → cây block (THUẦN, test kỹ = CRUX) +
  `renderMarkdown(blocks, citeByN, onCite)` → React node (chip inline). Thay `renderWithChips` ở 2 nơi.
- `MessageBubble.tsx` (013): câu trả lời AI dùng renderer markdown.
- `StudioResultCard.tsx` (021): nội dung dùng renderer markdown.
- CSS: style cho heading/list/code/inline trong `.bubble-text`/`.studio-card-body`.

## Hệ quả

- THUẦN renderer — KHÔNG main/IPC/DB/migration. Chip `[n]` giữ hành vi (Constitution II). Parser thuần →
  unit-test ≥80%. Chống hồi quy: e2e chip cũ (rag-qa/studio/source-viewer) vẫn xanh.
- Ngoài phạm vi: ~~bảng~~/ảnh/HTML thô, link điều hướng ngoài, đổi dữ liệu đã lưu. _(bảng: nay ĐƯỢC hỗ trợ
  qua remark-gfm sau khi revise.)_

## Sửa đổi (revise) — 2026-07-12, cùng ngày, sau kiểm thử live

**Đổi decision #1: HAND-ROLL → `react-markdown` + `remark-gfm`.**

- **Lý do:** Kiểm thử live phát hiện parser tay xử lý **xuống dòng** sai chuẩn CommonMark (coi mọi `\n`
  đơn là ngắt dòng cứng `<br>` → văn bản LLM bọc nhiều dòng bị bẻ bậc thang). Trước đó cũng đã phải vá một
  lỗi ReDoS trong regex inline. Tự cài đặt CommonMark bằng tay sẽ còn gặp lỗi biên (list lồng, bảng,
  blockquote, escape…). `development-workflow.md` ưu tiên **thư viện đã kiểm chứng hơn code tự viết**.
- **Ràng buộc GIỮ NGUYÊN:** vẫn CHỈ dựng React node — react-markdown mặc định **KHÔNG** bật `rehype-raw`
  nên HTML/`<script>` trong nội dung LLM giữ **literal** (XSS-safe by construction, không `innerHTML`). Là
  dependency **chỉ ở renderer** (không đụng main/IPC/mạng) → không phá vỡ ranh giới Constitution III, không
  egress. Link vẫn render **text** (override component `a` → `<span className="md-link">`, Constitution I).
  Chip `[n]` vẫn bấm được: chuyển từ tokenize inline sang **remark plugin `remarkCite`** (tách `[n]` trong
  text node → phần tử `cite-chip` → nút `.cite` giữ `onCite`); `[n]` trong code/inline-code vẫn **literal**
  (remark không duyệt text bên trong node code).
- **Được thêm (miễn phí từ remark-gfm):** bảng, blockquote, `~~gạch ngang~~`, autolink — đúng chuẩn.
- **Điểm chạm mới:** `src/renderer/shared/markdown/remark-cite.ts` (plugin) + `MarkdownContent.tsx`
  (dùng `<ReactMarkdown remarkPlugins={[remarkGfm, remarkCite]} components={…}>`). Gỡ `parse.ts` +
  `markdown-parse.test.ts`. `markdown-render.test.ts` bổ sung ca **soft-break** (xuống dòng đơn = khoảng
  trắng) + `[n]`-trong-code = literal + `<script>` không thực thi.
- **Dependency:** `react-markdown ^10`, `remark-gfm ^4`, `unist-util-visit ^5` (bundle renderer +~370KB —
  chấp nhận với app desktop local, không tải qua mạng lúc chạy).
