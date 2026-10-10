# Nhiều nguồn + stream lượt viết Studio — quyết định thực thi (178, PR 4)

- Ngày: 2026-10-10
- Feature: `178-studio-enhance-2` (issue #178) — PR 4. Clarify: `2026-10-10-studio-enhance-2-clarify.md` (#5). Research: R6–R8.

## Quyết định

1. **Phạm vi nguồn** (`resolveSourceScope`, thuần, `src/main/services/studio/source-scope.ts`): `sourceIds` (nếu có) thắng
   `sourceId` cũ (025, vẫn chạy); phải là mảng chuỗi không rỗng; khử trùng giữ thứ tự; > `STUDIO_MAX_SOURCE_IDS` (50, dùng chung
   `src/shared/studio-scope.ts`) id khác nhau ⇒ `studioSourcesInvalid {max}`; id không thuộc notebook ⇒ `studioSourcesInvalid`; thuộc
   notebook nhưng chưa `ready` ⇒ `studioSourceNotReady`. Lỗi ⇒ từ chối **cả lượt** trước khi đọc chunk / gọi AI (không bỏ qua âm thầm).
   Rỗng / thiếu ⇒ mọi nguồn ready, lưu `source_ids_json = NULL`. Ngân sách vẫn chia cân bằng giữa các nguồn trong phạm vi (#65).
2. **Lưu & hiển thị phạm vi**: `source_ids_json` (cột có sẵn từ v11) = mảng đã chuẩn hoá; JSON hỏng / sai dạng ⇒ bỏ trường, phiên bản vẫn
   đọc được. Thẻ hiện "Phạm vi: N nguồn" (+ "K nguồn đã xoá" khi id không còn trong notebook) — text node.
3. **Bộ chọn phạm vi** `StudioScopePicker`: nút disclosure "Phạm vi: Tất cả nguồn / N nguồn" (`aria-expanded`, `aria-controls`) mở danh
   sách checkbox có nhãn trong cột (không phải menu ARIA), nút "Tất cả nguồn", Esc đóng + trả focus; chỉ hiện khi > 1 nguồn ready; chạm
   trần 50 ⇒ khoá các ô chưa chọn + ghi chú. Đổi notebook ⇒ về "tất cả"; nguồn hết ready ⇒ tự rơi khỏi phạm vi gửi đi.
4. **Stream chỉ lượt viết cuối**: `deps.chat(messages, { numCtx, signal, onToken })`; `onToken` chỉ vào lượt đơn hoặc lượt `writeChat` cuối
   của `runMapReduce` — map / condense không stream. Tiến độ 146 không đổi (stream bổ sung, không thay thế).
5. **`assertNotAborted` ngay sau lượt stream** (trong `runMapReduce` và ở service, **trước** `postprocessCitations` / insert): nhánh stream
   của cả 4 provider (Ollama, OpenAI, Anthropic, Gemini — `streamLines`) khi huỷ **trả phần dở, không ném** ⇒ thiếu điểm kiểm này thì lượt
   đã huỷ bị hậu kiểm + lưu. Hợp đồng này được khoá bằng test (`online-http-abort.test.ts`). Service bọc `onToken`: bỏ delta sau
   `signal.aborted` (kể cả provider vẫn gọi), nuốt lỗi callback.
6. **Kênh `studio:streamToken`** (push, không vào `ChannelResponse`): `createStudioTokenEmitter` gửi `{generationId, delta}` bằng
   `sender.send` của **chính lượt** đã gọi `studio:generate` — **không** `getAllWindows()` (khác `rag:streamToken`); id không hợp lệ ⇒ không
   stream (hành vi không-stream); không gửi khi `signal.aborted` hoặc `sender.isDestroyed()`; payload không mang notebookId / kind / nội
   dung nguồn / yêu cầu. Preload `onStudioStreamToken(cb) → unsubscribe`.
7. **Hiển thị chữ tạm** (clarify #5): renderer nối `streamText[kind]` chỉ cho lượt hiện hành (`activeIds`), bấm Huỷ ⇒ bỏ ngay + chặn token
   tới muộn; xong ⇒ thay bằng phiên bản đã hậu kiểm; lỗi / huỷ / đổi notebook / lượt bị thay ⇒ bỏ. `StudioStreamPreview` hiển thị
   `stripCitationMarkers(text)` dạng văn bản thường (gỡ `[n]`, `[n, m]`, `[n-m]`, mẩu `[` / `[12` chưa đóng ở cuối), không markdown, không
   chip, **không** `aria-live` / `role=status` (trình đọc màn hình chỉ nghe mốc bắt đầu / xong / huỷ / lỗi). "Tạo lại" ⇒ chữ tạm ở trên
   phiên bản đang xem.

8. **Sau review (2026-10-10)** — không có Blocking / CRITICAL / HIGH; đã sửa (test trước):
   - Security M1: `stripCitationMarkers` chạy lại mỗi token trên cả buffer ⇒ bỏ tiền tố `[ \t]*` trong regex (backtracking bậc hai:
     100 KB khoảng trắng mất ~11 s), gỡ khoảng trắng trước chip bằng vòng lặp, mẩu chưa đóng chỉ xét từ `[` cuối — tuyến tính.
   - Security M2: mảng `sourceIds` thô > `STUDIO_MAX_RAW_SOURCE_IDS` (200) ⇒ `studioSourcesInvalid` ngay (không duyệt mảng khổng lồ
     toàn id trùng). Security L2: chữ tạm mỗi loại ≤ `STUDIO_STREAM_TEXT_MAX` (200.000 ký tự).
   - Code-review: nguồn đã chọn hết ready ⇒ `pruneScope` bỏ khỏi phạm vi **và** báo trình đọc màn hình (`studio.scope.changed`) — không
     nới âm thầm; **"Tạo lại" dùng phạm vi của phiên bản đang xem** (thiếu = mọi nguồn; nguồn đã xoá ⇒ main từ chối rõ, như yêu cầu
     tuỳ chỉnh dùng yêu cầu của phiên bản); "Thử lại" / "Tạo bằng AI cục bộ" dùng phạm vi của lượt vừa lỗi; đổi notebook xoá danh sách
     nguồn cũ ngay.
   - Glossary-steward: append các tên mới; dòng cũ "Lọc tổng hợp theo 1 nguồn" (025, dropdown) để PR glossary riêng (T074).

## Giới hạn đã biết

- Lượt viết cuối khi stream **không có timeout** không-stream (120 / 300 s) — giống Chat (039); người dùng có nút Huỷ (149).
- Token không gộp ở main (mỗi delta một `sender.send`, như Chat); nếu đo thấy nghẽn ⇒ gộp theo khung 30–50 ms ở `token-emitter` hoặc
  `requestAnimationFrame` ở renderer (security L2, hoãn).
- `studio:streamToken` / `studio:progress` nằm trong whitelist chung dù chỉ là kênh push — không có handler invoke, preload không lộ
  invoke thô (security L1, giữ nhất quán với 146).
