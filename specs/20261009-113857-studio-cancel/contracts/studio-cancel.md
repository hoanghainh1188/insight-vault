# Contract — huỷ lượt tạo Studio

## IPC

- `studio:cancel(generationId: string, reason?: "user" | "navigate") ⇒ { cancelled: boolean }` (invoke, whitelist).
  - `generationId` không hợp lệ (`isValidGenerationId`) / không tồn tại / đã kết thúc / của cửa sổ khác ⇒ `{ cancelled: false }`, không ném.
  - `reason` khác hai giá trị ⇒ coi như `"user"`. Không log `generationId`.
- `studio:generate` (không đổi chữ ký): nếu `generationId` hợp lệ ⇒ đăng ký vào sổ (supersede lượt cũ cùng `(notebookId, kind)`), truyền `signal` xuống
  `generate`; `finally` luôn `finish`. Bị huỷ ⇒ reject `UserFacingError("studioCancelled")`. Lượt xong / lưu trước khi huỷ có hiệu lực ⇒ resolve bình thường.
- Cửa sổ gọi `destroyed` ⇒ `abortAllFor(sender, "window")`; `window-all-closed` ⇒ `abortAll("window")`.
- Log: `logEvent("studio.cancelled", { kind, phase, reason })` một lần mỗi lượt bị huỷ (`phase` = pha tiến độ gần nhất hoặc `"start"`).

## Preload

- `studioCancel(generationId: string, reason?: "user" | "navigate"): Promise<{ cancelled: boolean }>`. Không `invoke` chung.

## Main — dịch vụ

- `abort.ts`: `ChatAbortedError`, `isChatAborted(e)`, `assertNotAborted(signal?)`, `linkAbort(outer?, controller) ⇒ unlink`.
- `ollama-client.chat(req, {signal})` nhánh không-stream: huỷ ⇒ `ChatAbortedError` (cả khi đang đọc body); timeout ⇒ như cũ.
- `callJson({…, signal})`: huỷ ⇒ `ChatAbortedError` (không qua `errorForCause`); `withEgress` kết thúc; timeout ⇒ `OnlineProviderError(timeout)` như cũ.
- OpenAI / Anthropic / Gemini: nhánh không-stream truyền `opts.signal` vào `callJson`.
- `runMapReduce({…, signal})`: kiểm đầu mỗi phần, trong retry (ném lại, không thử lần 2), mỗi lô / vòng rút gọn, trước bước viết; không phát tiến độ sau huỷ.
- `studioService.generate(input, { onProgress?, signal? })`: kiểm sau `contextInfo()`, trước một-lượt, **trước `upsert`**; `ChatAbortedError` /
  `signal.aborted` ⇒ `UserFacingError("studioCancelled")`.
- `createGenerationRegistry()` — xem data-model.

## Renderer

- `isCurrentGeneration(activeIds, kind, generationId): boolean` thuần — mọi ghi state sau `await` qua hàm này.
- `outcomeOf(error): "cancelled" | "failed"` thuần (mã `studioCancelled`).
- `cancelFocusTarget(hasResult): "regenerate" | "kind"` thuần.
- `useStudio`: `generate(...) ⇒ Promise<"done" | "failed" | "cancelled" | "stale">`; `cancel(kind)`; `cancelling[kind]`; đổi notebook / unmount ⇒
  `studioCancel(id, "navigate")` cho mọi lượt + announce huỷ.
- `StudioCancel`: nút "Huỷ" (`common.cancel`), `aria-label` `studio.cancelAria` {kind}; sau bấm "Đang huỷ…" (`studio.cancelling`) `disabled`; testid
  `studio-cancel-<kind>`.
- i18n: `studio.cancelAria`, `studio.cancelling`, `a11y.studioCancelled` ("Đã huỷ tạo {label}." / "Cancelled creating {label}."), lỗi `studioCancelled`.
