# Studio đợt 2 — quyết định clarify (178)

- Ngày: 2026-10-10
- Feature: `178-studio-enhance-2` (issue #178) — intake `docs/intake/178-studio-enhance-2.md`, spec
  `specs/20261010-070229-studio-enhance-2/spec.md`.
- Người quyết định: Hải (2026-10-10). 7 câu hỏi trực tiếp (5 câu bắt buộc a–e + G1, G4 của intake), cả 7 chọn phương án khuyên dùng.
- **Bổ sung / thay thế một phần** các quyết định trước (không sửa file cũ):
  - ADR 021 (`2026-07-11-studio-clarify.md`) #4 (`studio_result` UNIQUE(notebook_id, kind)) và #6 ("Tạo lại" = upsert ghi đè, 1 bản mới nhất
    mỗi loại) — **thay bằng lịch sử phiên bản** (#1 dưới đây). #10 ("không progress bar… 1 lượt") đã được 146 nới; nay thêm stream (#5).
  - ADR 146 / 149 mục "Ngoài phạm vi: stream token Studio" — **nay làm**, theo đúng nguyên tắc kênh push của 146: chỉ gửi về cửa sổ đã gọi.
  - Plan đã duyệt (2026-10-10) chỉ thêm 2 cột (`custom_prompt`, `source_ids_json`) — **mở rộng thêm 3 cột** theo #7.

## Quyết định

1. **(a) Trần phiên bản**: tối đa **10** phiên bản mỗi `(notebook, kind)`. Lưu bản thứ 11 ⇒ xoá bản cũ nhất trong cùng giao dịch lưu, im
   lặng (không cảnh báo). Không ghim phiên bản ở v1. Hằng số đặt một chỗ (`constants.ts`). Với `custom`, trần tính chung cho loại `custom`
   của notebook (không tách theo nội dung yêu cầu).
2. **(b) 4 loại mới** (định danh — nhãn vi / en — định nghĩa; mọi mục có `[n]`):
   - `studyGuide` — Hướng dẫn học / Study guide — khái niệm chính (1–2 câu mỗi khái niệm), 5–10 câu hỏi ôn tập kèm đáp án ngắn, từ khoá.
   - `briefing` — Bản tóm lược / Briefing — 1 trang cho người ra quyết định: bối cảnh, phát hiện chính, hệ quả/khuyến nghị (chỉ khi nguồn
     nêu), câu hỏi còn mở. Hướng hành động; khác `summary` "Tóm tắt tài liệu" (đi theo từng nguồn).
   - `timeline` — Dòng thời gian / Timeline — "mốc thời gian — sự kiện" theo thứ tự thời gian; không suy diễn ngày; sự kiện không rõ ngày gom
     vào "Không rõ thời điểm"; nguồn không có mốc nào ⇒ nói rõ.
   - `keyTerms` — Bảng thuật ngữ / Glossary — "thuật ngữ — định nghĩa" theo thứ tự chữ cái, chỉ thuật ngữ được định nghĩa/giải thích trong
     nguồn. Định danh `keyTerms` (cùng kiểu `keyPoints`) để **không trùng** khái niệm glossary của dự án (`docs/00-glossary.md`).
   - Thứ tự hiển thị: 4 loại cũ (summary, keyPoints, faq, outline) rồi studyGuide, briefing, timeline, keyTerms.
3. **(c) Yêu cầu tuỳ chỉnh**: tối đa **500 ký tự** sau khi trim; cho phép xuống dòng; ô nhập có đếm "n/500"; main kiểm (kiểu chuỗi, trim,
   không rỗng, ≤ 500) và trả mã lỗi có kiểu. **Không lưu preset** ở v1 — dùng lại qua lịch sử phiên bản + "Tạo lại" (dùng đúng
   `custom_prompt` của phiên bản đang xem).
4. **(d) Bố cục nút**: lưới **2 cột** cho 8 loại cố định (2×4), bên dưới là **một hàng riêng** "Yêu cầu tuỳ chỉnh" (ô nhập + nút Tạo).
   Không dùng menu "Thêm". Nhãn dài được xuống dòng, không cắt; không cuộn ngang ở 262 px, vi và en.
5. **(e) Hiển thị stream**: hiện **chữ tạm nhưng gỡ mọi `[n]`** trong lúc stream (không chip, không số thô — Constitution II); xong thì
   **thay toàn bộ** bằng bản hậu kiểm có chip. Huỷ / rời notebook / bị lượt mới thay ⇒ bỏ toàn bộ chữ tạm, không lưu (khác Chat vốn giữ
   phần đã nhận). Khi "Tạo lại", vùng chữ tạm nằm trên, phiên bản đang xem vẫn hiển thị bên dưới đến khi bản mới lưu xong. Chữ tạm
   không nằm trong vùng `aria-live`; chỉ đọc mốc.
6. **(G1) Khoá sổ lượt cho `custom`**: theo `(notebookId, "custom")` như mọi loại — mỗi notebook một lượt tuỳ chỉnh hiện hành; gửi yêu
   cầu mới ⇒ main huỷ lượt cũ (supersede của 149), lượt cũ không lưu. Không đổi `createGenerationRegistry`.
7. **(G4) Metadata phiên bản**: lưu thêm `parts` (INTEGER NULL), `truncated` (INTEGER 0/1 NULL), `local` (INTEGER 0/1 NULL — tạo bằng AI
   cục bộ) trong **cùng migration v11** (không v12). Dòng có từ trước nâng cấp = NULL ⇒ không hiện ghi chú, như hiện nay. Card hiển thị
   "Tổng hợp từ N phần" / "chưa tổng hợp phần cuối" / nhãn "AI cục bộ" theo phiên bản đang xem.

## Mặc định nhận theo intake (không hỏi riêng)

- `sourceIds[]`: khử trùng, tối đa 50 phần tử; có cả `sourceId` và `sourceIds` ⇒ dùng `sourceIds`; bất kỳ id không thuộc notebook / không
  `ready` ⇒ từ chối cả lượt với mã lỗi có kiểu, không gọi AI. Mảng rỗng = mọi nguồn `ready`.
- Xoá một phiên bản **có hỏi xác nhận** (mất dữ liệu — khác Huỷ của 149 vốn không hỏi).
- `custom_prompt` hiển thị lại dạng text node (không HTML/markdown); không ghi vào log; không đưa vào tên tệp export.
- Văn bản yêu cầu chỉ trong tin nhắn user; system prompt giữ nguyên khung `common()` (quy tắc `[n]`, không bịa, ngôn ngữ đầu ra).
- Chỉ lượt viết cuối stream; kênh push `studio:streamToken` `{ generationId, delta }` gửi qua `sender` của lượt; không gửi sau
  `signal.aborted`; `assertNotAborted(signal)` ngay sau lượt stream, trước hậu kiểm/lưu.
- Migration v11: rebuild bảng (tạo mới → `INSERT … SELECT` → drop → rename → tạo lại index), giữ `id`/`created_at`, FK
  `ON DELETE CASCADE`; thêm index `(notebook_id, kind, created_at)`.
- Thuật ngữ mới append vào `docs/00-glossary.md` trong branch feature; sửa dòng `StudioKind` / `StudioResult` cũ ⇒ PR glossary riêng.
- Security-reviewer **bắt buộc** cho PR 3 (`custom`) và PR 4 (nhiều nguồn + stream).

## Ngoài phạm vi

So sánh/diff hai phiên bản; ghim phiên bản; preset yêu cầu; chạy song song nhiều lượt `custom`; stream cho lượt map/condense; chia sẻ
ghi chú map giữa các loại; đổi giới hạn map-reduce; "Huỷ tất cả"; ETA; đồng bộ đám mây; sửa tay nội dung kết quả.
