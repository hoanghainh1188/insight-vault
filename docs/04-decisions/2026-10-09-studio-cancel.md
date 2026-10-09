# Huỷ lượt tạo kết quả Studio (149)

- Ngày: 2026-10-09
- Feature liên quan: `149-studio-cancel` (issue #149) — spec `specs/20261009-113857-studio-cancel/`.
- Câu hỏi gốc: lượt tạo Studio cho notebook lớn có thể mất nhiều phút; #146 cho thấy tiến độ nhưng không dừng được. Rời notebook giữa lúc tạo
  thì lượt vẫn chạy ngầm; lượt cũ về muộn sau A → B → A có thể ghi đè trạng thái lượt mới.
- Người quyết định: Hải (17 quyết định clarify, `2026-10-09-studio-cancel-clarify.md`).
- **Thay thế một phần**: 146 #3 ("Huỷ tách issue") — nay làm; 146 #8 ("rời notebook: chạy tiếp, không phục hồi") — thay bằng **tự huỷ**; dòng
  "Ngoài phạm vi: A→B→A" của ADR `2026-10-08-studio-progress.md` — nay sửa.

## Quyết định

1. **IPC** `studio:cancel(generationId, reason?)` ⇒ `{ cancelled }` (invoke, whitelist, preload `studioCancel`). Idempotent; id sai / lạ / đã xong /
   của cửa sổ khác ⇒ `false`, không ném. `reason` chỉ `user` | `navigate` (khác ⇒ `user`), dùng cho nhật ký.
2. **Sổ lượt** `createGenerationRegistry` (thuần, `src/main/services/studio/generation-registry.ts`): `generationId → {notebookId, kind, owner, AbortController,
reason}`; chỉ **chủ sở hữu** (`WebContents` đã gọi `studio:generate`) huỷ được; lượt mới cùng `(notebookId, kind)` ⇒ lượt cũ bị huỷ `superseded`;
   cửa sổ `destroyed` ⇒ `abortAllFor`; `window-all-closed` ⇒ `abortAll`; `finish` ở `finally` trả lý do để ghi `studio.cancelled {kind, phase, reason}`
   (`cancelLogFields` — không id / notebook / nội dung). Lượt không có `generationId` hợp lệ vẫn chạy như 146, không huỷ được.
3. **Huỷ thật ở provider**: `AbortSignal` đi `generate(input, {onProgress, signal})` → `runMapReduce({signal})` → `deps.chat(…, {numCtx, signal})` →
   `provider.chat(req, {signal})`. Nhánh **không-stream** của Ollama và `callJson` (OpenAI / Anthropic / Gemini) nối signal ngoài vào controller timeout
   bằng `linkAbort` (gỡ listener ở `finally`; phạm vi gồm cả đọc body) và ném **`ChatAbortedError`** — kiểm TRƯỚC `errorForCause` (vốn biến mọi
   `AbortError` thành `OnlineProviderError(timeout)` ⇒ bật nút 098). Timeout thật giữ hành vi cũ; timeout khi đang đọc body cũng ánh xạ về timeout.
4. **Điểm kiểm huỷ** (`assertNotAborted`): đầu mỗi phần map; **trong vòng thử lại** (huỷ ⇒ ném ngay, không gọi lần 2 — vòng retry cũ bắt mọi lỗi); mỗi lô
   rút gọn; trước bước viết; sau `contextInfo()`; **ngay trước `upsert`** (đã huỷ ⇒ không ghi DB). Không phát tiến độ sau huỷ. Huỷ ⇒
   `UserFacingError("studioCancelled")`. Đã lưu trước khi huỷ có hiệu lực ⇒ kết quả hiển thị bình thường.
5. **Renderer**: `useStudio.generate` trả `done | failed | cancelled | stale`; mọi ghi state sau `await` qua `isCurrentGeneration` (theo `generationId`,
   thay `stale()` theo notebookId — sửa A→B→A); kết cục huỷ (`outcomeOf`) không khối lỗi, không "Tạo bằng AI cục bộ"; `cancel(kind)` + `cancelling` ("Đang
   huỷ…", disabled); đổi notebook / unmount ⇒ `studioCancel(id, "navigate")` mọi lượt + câu "Đã huỷ tạo …".
6. **UI**: `StudioCancel` trong vùng kết quả mỗi khi đang tạo — cạnh khung chờ (ngoài phần `aria-hidden`) trước sự kiện tiến độ đầu, cùng hàng dòng pha khi
   có tiến độ, trên card cũ khi Tạo lại; nhãn `common.cancel`, `aria-label` "Huỷ tạo {loại}"; không hỏi xác nhận; nút gọn (cột hẹp: dòng pha xuống hai
   dòng, không tràn). Sau huỷ: câu đọc màn hình "Đã huỷ tạo {loại}." / "Cancelled creating {kind}."; focus về "Tạo lại" (có card) hoặc nút loại — chỉ khi
   focus đang ở nút Huỷ.

## Bổ sung sau review (code / bảo mật / glossary, 2026-10-09)

- **Focus sau huỷ (review B1, blocking)**: bản đầu trả focus bằng `queueMicrotask` — trong app thật React chưa commit trạng thái nghỉ nên nút đích còn
  `disabled` và focus rơi về `body` (unit test xanh nhờ `act()`; e2e chưa kiểm). Nay trả focus trong effect sau commit (`pendingFocus`, chờ `loading[kind]`
  về `false`, đọc `results` hiện tại); ý định trả focus được dọn ở mọi kết cục (N1). E2E thêm kiểm `toBeFocused` cả hai nhánh (đã xác nhận e2e ĐỎ với bản cũ).
- **`generationId` trùng (N4 / bảo mật 1)**: `register` cùng id ⇒ lượt cũ bị huỷ `superseded`; `finish(id, signal)` chỉ xoá entry của đúng lượt.
- **Kiểm huỷ ở đầu mỗi lần thử (N5)**: cả khi `chat` trả về bình thường sau huỷ.
- **Tải lại / renderer crash (N3)**: `render-process-gone` và `did-navigate` (điều hướng toàn trang, không phải đổi hash) ⇒ huỷ mọi lượt của cửa sổ.
- **Supersede xuyên cửa sổ (bảo mật 2)**: chủ ý — lượt mới cùng `(notebookId, kind)` thay lượt cũ dù ở cửa sổ khác (cùng một người dùng, cùng đích lưu);
  quyền **huỷ theo yêu cầu** vẫn chỉ của cửa sổ khởi tạo.
- **Điều chỉnh so với clarify #1 (N6)**: `studio:cancel(generationId, reason?)` thêm `reason` (`user` | `navigate`) chỉ để log đúng lý do (#14).
- **Đổi hành vi nhỏ (N7)**: timeout nhánh không-stream của Ollama nay bao cả lúc đọc body (trước đây gỡ sau khi có header).
- Glossary (append): kết cục lượt tạo (`StudioGenerateOutcome` / `outcomeOf`), nút Huỷ (`StudioCancel` / `cancelling`), đích focus sau huỷ
  (`cancelFocusTarget`), nhật ký huỷ (`studio.cancelled` / `cancelLogFields`).

## Kiểm chứng

- Unit (TDD): `chat-abort`, `ollama-client` (huỷ khi chờ / khi đọc body / trước khi gọi; timeout vẫn khác), `online-http-abort` (badge về nghỉ, timeout thân
  / body), `online-providers` (3 provider), `generation-registry` (+ `cancelLogFields`), `studio-map-reduce` (không retry khi huỷ, không bước cuối, không
  'writing'), `studio-service` (không chat sau `contextInfo`, không `upsert`, signal truyền xuống), `studio-generation`, `studio-cancel-hook` (A→B→A, tự huỷ,
  local, song song), `studio-cancel-ui`, `studio-channels-whitelist`.
- E2E `tests/e2e/studio-cancel.spec.ts` (Ollama giả HTTP): huỷ ở "Đang đọc phần 2/" ⇒ server thấy kết nối bị đóng ≤ 2 s, **0 request mới** trong 3 s, thẻ về
  nghỉ, không khối lỗi, không lưu; Tạo lại + Huỷ giữ card cũ; rời notebook ⇒ kết nối đóng, không lưu; supersede ⇒ lượt đầu reject `studioCancelled`;
  900 px vi / en không tràn.
- Thủ công Ollama thật (qwen2.5:7b, notebook 3 bài Wikipedia, 2026-10-09): huỷ ở "Đang đọc phần 2/3" (sau 3 s sinh) ⇒ UI về nghỉ **40 ms**, không khối lỗi,
  không lưu; request thăm dò ngay sau huỷ trả lời trong **2,9 s** (mốc trước đó 6,1 s gồm nạp model; một lượt map ~50 s) ⇒ lượt bị huỷ không còn giữ Ollama.

## Giới hạn đã biết

- Yêu cầu AI online đã tới nhà cung cấp trước khi huỷ có thể vẫn bị tính phí (giao diện không nói "chưa gửi dữ liệu").
- Phép đo "Ollama dừng sinh" là gián tiếp (độ trễ request thăm dò); nếu Ollama cấu hình chạy song song nhiều request, phép đo không phân biệt được — UI vẫn
  về nghỉ và không lưu trong mọi trường hợp.
- Không có "Huỷ tất cả"; không khôi phục tiến độ khi quay lại notebook (đã tự huỷ khi rời).
