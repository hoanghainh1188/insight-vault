# Research — 149 Huỷ lượt tạo Studio

## R1 — Sổ lượt đang chạy + quyền sở hữu

- **Decision**: module thuần `createGenerationRegistry<S>()` (S = định danh chủ sở hữu, ở main là `WebContents`):
  `register({generationId, notebookId, kind, owner}) ⇒ {signal, superseded}` — nếu đã có lượt cùng `(notebookId, kind)` thì abort lượt đó với lý do
  `superseded` và trả về để ghi log; `cancel(generationId, owner, reason) ⇒ boolean` — chỉ khi tồn tại **và** cùng owner; `finish(generationId)` xoá
  (idempotent); `abortAllFor(owner, reason)` (cửa sổ `destroyed`); `abortAll(reason)` (`window-all-closed`). Lý do huỷ lưu trên entry để log
  `studio.cancelled` đúng `reason`. Lượt không có `generationId` hợp lệ ⇒ không đăng ký (vẫn chạy, không huỷ được — giữ hợp đồng tuỳ chọn của 146).
- **Rationale**: tách khỏi `ipcMain` để test tất định (khuôn `streamControllers` 039 nhưng có chủ sở hữu + supersede); supersede ở main là lớp phòng
  thủ dù renderer đã tự huỷ (#10, #12).
- **Alternatives**: Map trực tiếp trong `register.ts` (khó test supersede / owner); từ chối lượt trùng (người dùng chọn "lượt mới thắng").

## R2 — Điểm kiểm huỷ

- **Decision**: `signal?.throwIfAborted()`-tương đương (`assertNotAborted(signal)` ném `ChatAbortedError`) ở: đầu mỗi phần map; trong `catch` của vòng
  thử lại — nếu `isChatAborted(e) || signal.aborted` ⇒ ném lại ngay (không thử lần 2); đầu mỗi lô / vòng rút gọn; trước `progress("writing")` + bước
  cuối; trong `studio-service` sau `await contextInfo()`, trước bước một-lượt, và **ngay trước `upsert`**. Tiến độ chỉ phát qua một hàm đã kiểm
  `aborted` (không phát sau huỷ). Chat nhận `signal` ⇒ huỷ giữa lượt LLM được ngắt bởi provider (R3).
- **Rationale**: vòng thử lại hiện bắt mọi lỗi (`if (attempt === 1) throw e`) ⇒ abort ở lần đầu sẽ gọi lại lần 2 (phát hiện của intake). Kiểm trước
  `upsert` bảo đảm "không lưu dở dang" kể cả khi lượt LLM cuối đã trả về.
- **Alternatives**: chỉ dựa vào provider ném (bỏ sót retry + khoảng giữa bước + upsert).

## R3 — Nối signal ngoài với timeout nội bộ

- **Decision**: hàm thuần `linkAbort(outer: AbortSignal | undefined, controller: AbortController) ⇒ () => void` — nếu `outer.aborted` thì abort ngay;
  ngược lại `addEventListener("abort", …, {once: true})`, trả hàm gỡ listener gọi ở `finally`. Ollama không-stream: phạm vi liên kết bao cả `fetch`
  **và** `res.json()` (body đọc sau headers vẫn huỷ được). `callJsonInner` tương tự.
- **Rationale**: không phụ thuộc `AbortSignal.any` (có ở Node 22 nhưng không gỡ được listener và khó giả trong test); không rò listener trên signal sống lâu.
- **Alternatives**: `AbortSignal.any([outer, AbortSignal.timeout(ms)])` — gọn nhưng không phân biệt nguồn abort rõ ràng cho R4.

## R4 — Lỗi huỷ ≠ timeout

- **Decision**: `class ChatAbortedError extends Error` (name `"ChatAbortedError"`) trong `ai-runtime/abort.ts`; ở `catch` của Ollama / `callJsonInner`:
  nếu `outer?.aborted` ⇒ ném `ChatAbortedError` **trước** khi ánh xạ `errorForCause` (vốn biến mọi `AbortError` thành `OnlineProviderError`
  kind `timeout` ⇒ bật nút 098). Timeout thật (outer chưa aborted) giữ nguyên hành vi. `studio-service` bắt `ChatAbortedError` (hoặc `signal.aborted`) ⇒
  ném `UserFacingError("studioCancelled")`.
- **Rationale**: renderer phân loại bằng mã đã có (123: main trả mã) — không cần kênh mới; `onlineKind` của lỗi huỷ là `null` ⇒ không bật "Tạo bằng AI cục bộ".
- **Alternatives**: resolve `{cancelled:true}` (đổi kiểu trả `studio:generate`); renderer tự suy từ cờ (sai khi huỷ do supersede / rời notebook).

## R5 — Kết cục ở renderer

- **Decision**: hàm thuần `outcomeOf(error) ⇒ "cancelled" | "failed"` (mã `studioCancelled`); `useStudio.generate` trả `"done" | "failed" | "cancelled" |
"stale"`; `cancelling[kind]` chỉ để UI tức thì ("Đang huỷ…", disabled) — nguồn sự thật là kết cục `invoke`. Lượt resolve bình thường dù đã bấm Huỷ ⇒
  `done`. `StudioColumn.run` announce theo kết cục (`done` ⇒ câu xong; `cancelled` ⇒ `a11y.studioCancelled`; `stale` ⇒ im lặng). Focus: hàm thuần
  `cancelFocusTarget(hasResult) ⇒ "regenerate" | "kind"`; chỉ áp khi `document.activeElement` là nút Huỷ vừa bấm.
- **Rationale**: tách quyết định khỏi React để test; tránh treo câu "Đang tạo…" cho trình đọc màn hình.

## R6 — Tự huỷ khi rời notebook + race A→B→A

- **Decision**: `useStudio` ghi `activeIds` (đã có từ 146); effect đổi `notebookId` / unmount gọi `studioCancel(id, "navigate")` cho mọi lượt đang chạy.
  `studio:cancel(generationId, reason?)` — `reason ∈ "user" | "navigate"` (mặc định `"user"`; giá trị khác ⇒ `"user"`), chỉ để log đúng lý do (#14);
  `"window"` / `"superseded"` do main tự đặt. Announce `a11y.studioCancelled` cho lượt tự huỷ (giống `chatCancelled`).
  Thay `stale()` bằng `isCurrentGeneration(activeIds, kind, generationId)` ở MỌI chỗ ghi state sau `await` (results, loading, localKinds, errors,
  onlineFailed, progress).
- **Rationale**: A→B→A vẫn có thể xảy ra khi kết quả về trước khi huỷ tới; so `generationId` là đúng định nghĩa "lượt hiện hành".
- **Alternatives**: epoch theo notebook (thêm state); chỉ dựa vào tự huỷ (không đủ — race giữa resolve và cancel).

## R7 — e2e

- **Decision**: mở rộng khuôn `tests/e2e/studio-progress.spec.ts`: Ollama giả HTTP ghi số request `/api/chat` và sự kiện `close` của request khi client
  ngắt; `/api/chat` treo ~20 s cho lượt map thứ 2. Tài liệu ~40.000 ký tự ⇒ nhiều phần. Bấm Huỷ khi thấy "Đang đọc phần 2/" ⇒ (a) server thấy `close` trong
  ≤ 2 s, (b) không request mới trong 3 s sau đó, (c) thẻ về nghỉ, không `studio-error-*`, (d) `studioList` không có kết quả mới. Kịch bản Tạo lại + Huỷ
  giữ card cũ. Ảnh chụp 900 px vi/en. Thủ công (quickstart): Ollama thật dừng GPU sau huỷ (quan sát `ollama ps` / hoạt động GPU).
