# Research — 019-source-viewer (Phase 0)

Quyết định lớn đã chốt ở 2 ADR (`2026-07-11-source-viewer-clarify.md`, `-source-viewer-strategy.md`).
File này ghi verify kỹ thuật cho crux (tái dựng + highlight offset).

## R1 — Tái dựng toàn văn từ chunk (đã VERIFY thực tế)

- **Decision**: `reconstructText(chunks)` nối `chunk.text` theo `charStart` tăng dần, **fill gap ranh giới
  trang bằng `"\n".repeat(gap)`**, cắt overlap bằng `pos - charStart`.
- **Verify (đã chạy với `chunker.ts` thật)**: `reconstruct(chunks) === joinPages(pages)` **tuyệt đối** cho:
  (a) 1 trang dài non-PDF, (b) PDF 3 trang, (c) 1 chunk ngắn. VÀ mọi `T.slice(charStart,charEnd) ===
chunk.text` → highlight bằng offset toàn cục khớp 100%.
- **Phát hiện quan trọng**: bản naïve KHÔNG fill gap SAI cho PDF — `chunker.ts` join trang bằng
  `PAGE_SEP="\n\n"`, locator tính cả separator (`base += 2`), nhưng `chunk.text` không chứa separator → lệch
  2 ký tự/ranh giới trang → highlight sai. **Fill gap bằng newlines là bắt buộc** (Constitution II).
- **Rationale**: local hoàn toàn (không re-parse/re-fetch → Constitution I cho URL); offset khớp locator vì
  cùng nguồn dữ liệu đã tạo locator.
- **Alternatives**: re-parse file (URL không được — egress; file có thể lệch nếu sửa); lưu full_text riêng
  (đụng 011 + trùng dung lượng). Loại (xem ADR).

## R2 — Highlight bằng offset TOÀN CỤC

- **Decision**: `locator.charStart/charEnd` là offset toàn cục vào `T` → highlight = segment
  `[before | T[charStart:charEnd) | after]`, KHÔNG cần tính offset theo trang. Đồng nhất mọi loại nguồn.
- **Verify**: đã khẳng định ở R1 (`T.slice(charStart,charEnd) === chunk.text`).
- **Render an toàn (Constitution III)**: chia text thành 3 đoạn (React text node), bọc đoạn giữa bằng
  `<mark>`/span — KHÔNG `dangerouslySetInnerHTML` (chống XSS từ nội dung tài liệu không tin cậy).

## R3 — pageBreaks cho PDF

- **Decision**: `derivePageBreaks(chunks)` = với mỗi `page` (non-null), `offset = min(charStart)` các chunk
  của trang đó; sắp theo `offset`. Non-PDF (`page=null`) → `[]`.
- **Rationale**: PDF không vắt trang (chunking-strategy) → chunk của trang k nằm gọn; `min charStart` = đầu
  trang k trong `T`. Cho pager "Trang N/M" + chèn mốc trang.

## R4 — Kênh source:getContent

- **Decision**: `source:getContent(sourceId)` → `SourceContent { kind, title, pageCount, text, pageBreaks }`
  hoặc `null` (source đã xoá). Đọc `source-repo.getById` + `listChunks` ở main; tái dựng; trả về. KHÔNG log
  content. Renderer nhận để hiển thị (A6: hợp lệ — người dùng chủ động xem).
- **Rationale**: 1 kênh đủ; viewer đã có `Citation.locator` từ cú bấm chip.

## R5 — Không đụng 011/013

- `source-repo` (011): CHỈ đọc (`getById`, `listChunks`) — KHÔNG sửa schema/method. Logic tái dựng ở service
  mới `source-viewer/`.
- `Citation`/`Locator` (013): dùng nguyên. Điểm chạm: `ChatColumn.onCite` (013), `SourceItem.onOpen` (011),
  `Workspace` (quản state viewer) — additive, tách commit (rule 5).

## Tổng hợp

- KHÔNG dependency/schema/migration mới. Crux (reconstruct/highlight) đã verify tuyệt đối → rủi ro thấp.
- Điểm test kỹ nhất: `reconstruct.ts` (fill gap PDF) + `highlight.ts` (biên đoạn) — Constitution II.
