# Implementation Plan: Huỷ lượt tạo kết quả Studio

**Branch**: `149-studio-cancel` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/20261009-113857-studio-cancel/spec.md`; quyết định `docs/04-decisions/2026-10-09-studio-cancel-clarify.md`; intake
`docs/intake/149-studio-cancel.md`; kế thừa 146 (`generationId`, `studio:progress`, `createStudioProgressEmitter`, `safeHandleWithSender`).

## Summary

Thêm invoke `studio:cancel(generationId)` và một **sổ lượt đang chạy** thuần ở main (`createGenerationRegistry`: mỗi lượt một `AbortController`, khoá
theo `generationId`, chủ sở hữu = `sender`, supersede theo `(notebookId, kind)`). `AbortSignal` đi xuyên `studioService.generate` → `runMapReduce` →
`deps.chat` → `provider.chat`; nhánh **không-stream** của Ollama và `callJson` (3 provider online) tôn trọng signal và ném **lỗi huỷ chuyên dụng**
(`ChatAbortedError`) thay vì timeout. Huỷ kiểm ở mọi ranh giới bước (kể cả vòng thử lại) và ngay trước `upsert`; kết cục huỷ là
`UserFacingError("studioCancelled")`. Renderer: nút Huỷ trong vùng kết quả, kết cục `done | failed | cancelled | stale`, `isCurrentGeneration` thay
`stale()`, tự huỷ khi đổi notebook / unmount, thông báo + focus sau huỷ. Thuật toán, `[n]`, `parts`, `truncated`, DB không đổi.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Electron 43 (Node 22 — `AbortSignal.any` có sẵn nhưng không dùng, xem R3), React 18

**Primary Dependencies**: có sẵn (không thêm).

**Storage**: không đổi (không migration). Lượt bị huỷ không `upsert`.

**Testing**: vitest unit — registry (register / cancel / finish / supersede / sender sai / id lạ / abortAllFor), map-reduce (abort trước / giữa phần, trong
retry không gọi lại, trong condense, trước final, không phát tiến độ sau huỷ), studio-service (abort sau `contextInfo`, trước `upsert` ⇒ repo không gọi),
ollama-client + online-http (signal ⇒ `ChatAbortedError`, timeout vẫn là timeout, listener được gỡ), whitelist kênh, `isCurrentGeneration`, `useStudio`
(kết cục huỷ, A→B→A, tự huỷ khi đổi notebook / unmount, card cũ giữ), `StudioCancel` jsdom (nhãn, aria, "Đang huỷ…", focus, announce vi/en), catalog i18n;
e2e Playwright: Ollama giả HTTP chậm ⇒ Huỷ ở "Đang đọc phần 2/N" ⇒ server thấy kết nối đóng + không request mới, UI nghỉ, không khối lỗi, DB không đổi;
Tạo lại + Huỷ giữ card cũ; 900 px không tràn.

**Target Platform**: macOS arm64 + Windows x64.

**Project Type**: desktop-app (Electron main / renderer).

**Performance Goals**: UI về nghỉ ≤ 2 s sau khi bấm Huỷ (SC-001) — không phụ thuộc timeout 120/300 s.

**Constraints**: không nội dung / id trong log; không egress mới; không lưu kết quả dở dang; kết quả lượt hoàn tất không đổi (SC-007).

**Scale/Scope**: 4 loại Studio, tối đa 12 phần, vài lượt song song.

Không còn NEEDS CLARIFICATION (R1–R7 ở research.md).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc                     | Đánh giá                                                                                                                                                     | Sau Phase 1 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| I. Local-first                 | Không kết nối mới; huỷ **giảm** egress (ngắt `fetch` online thật, `withEgress` kết thúc); tự huỷ khi rời notebook / đóng cửa sổ ⇒ không chạy ngầm.           | ✅          |
| II. Verifiable Citations       | Không đổi `[n]` / hậu kiểm / `parts` / `truncated`; lượt bị huỷ không lưu (kiểm trước `upsert`).                                                             | ✅          |
| III. Desktop Security Boundary | Invoke mới whitelist + preload; main kiểm `generationId` + chủ sở hữu `sender`; payload chỉ id; log không nội dung / id.                                     | ✅ contract |
| IV. Test-First & Coverage      | Registry, điểm kiểm huỷ, phân loại lỗi huỷ, `isCurrentGeneration`, chọn thông báo — hàm thuần test trước; ngưỡng 80% giữ.                                    | ✅          |
| V. Phased Delivery             | Hoàn thiện Studio (Pha 1).                                                                                                                                   | ✅          |
| Terminology                    | Append glossary: huỷ lượt tạo Studio (`studio:cancel`), sổ lượt (`createGenerationRegistry`), `ChatAbortedError` / `studioCancelled`, `isCurrentGeneration`. | ✅          |

## Project Structure

```text
specs/20261009-113857-studio-cancel/ plan.md · research.md · data-model.md · quickstart.md · contracts/studio-cancel.md · tasks.md

src/shared/ipc/channels.ts                     # SỬA — studioCancel: "studio:cancel" + ChannelResponse {cancelled: boolean}
src/shared/codes/user-error.ts (+ core.ts)     # SỬA — mã studioCancelled (thông điệp dự phòng vi/en ở domains/core.ts)
src/main/services/ai-runtime/abort.ts          # MỚI (thuần) — ChatAbortedError, isChatAborted, linkAbort(outer, controller) ⇒ unlink
src/main/services/ai-runtime/ollama-client.ts  # SỬA — nhánh không-stream tôn trọng opts.signal (fetch + đọc body), ném ChatAbortedError
src/main/services/ai-runtime/online/online-http.ts   # SỬA — CallJsonOptions.signal; kiểm aborted trước errorForCause ⇒ ChatAbortedError
src/main/services/ai-runtime/online/{openai,anthropic,gemini}-provider.ts # SỬA — truyền opts.signal vào callJson
src/main/services/ai-runtime/provider.ts       # SỬA chú thích — signal áp cho cả nhánh không-stream
src/main/services/studio/generation-registry.ts # MỚI (thuần) — createGenerationRegistry (register/cancel/finish/abortAllFor, supersede)
src/main/services/studio/map-reduce.ts         # SỬA — signal: kiểm ranh giới bước, rethrow trong retry, không phát tiến độ sau huỷ
src/main/services/studio/studio-service.ts     # SỬA — generate(input, {onProgress, signal}); kiểm sau contextInfo + trước upsert; ném studioCancelled
src/main/index.ts                              # SỬA — deps.chat(messages, {numCtx, signal}) ⇒ provider.chat(req, {signal})
src/main/ipc/register.ts                       # SỬA — studio:generate đăng ký sổ + finally; studio:cancel; abortAllFor(sender) khi destroyed; window-all-closed; log
src/preload/index.ts                           # SỬA — studioCancel(generationId)
src/renderer/features/studio/studio-generation.ts # MỚI (thuần) — isCurrentGeneration, outcomeOf(error), cancelFocusTarget
src/renderer/features/studio/useStudio.ts      # SỬA — kết cục 4 trạng thái, cancelling[kind], cancel(kind), tự huỷ khi đổi notebook/unmount
src/renderer/features/studio/StudioCancel.tsx  # MỚI — nút Huỷ / "Đang huỷ…"
src/renderer/features/studio/StudioColumn.tsx  # SỬA — đặt StudioCancel, announce huỷ, focus sau huỷ
src/renderer/features/studio/studio.css        # SỬA — hàng pha + nút Huỷ (không tràn 900 px)
src/shared/i18n/domains/{studio,a11y,core}.ts # SỬA — studio.cancelAria, studio.cancelling, a11y.studioCancelled, lỗi studioCancelled
tests/unit/ (generation-registry, chat-abort, ollama-client, online-http-abort, online-providers, studio-map-reduce, studio-service, studio-generation, studio-cancel-hook, studio-cancel-ui, studio-channels-whitelist)
tests/e2e/studio-cancel.spec.ts
docs/04-decisions/2026-10-09-studio-cancel.md (+ INDEX), docs/00-glossary.md (append)
```

**Structure Decision**: mọi quyết định (sổ lượt, điểm kiểm huỷ, phân loại huỷ ≠ timeout, lượt hiện hành, đích focus) là hàm / module thuần có test; I/O mỏng
ở IPC / preload / `index.ts`; component trình bày tách riêng.

## Phase 0 — Research

[research.md](./research.md): R1 sổ lượt + quyền sở hữu · R2 điểm kiểm huỷ · R3 nối signal với timeout · R4 lỗi huỷ ≠ timeout · R5 kết cục ở renderer
· R6 tự huỷ khi rời notebook + A→B→A · R7 e2e.

## Phase 1 — Design

[data-model.md](./data-model.md) · [contracts/studio-cancel.md](./contracts/studio-cancel.md) · [quickstart.md](./quickstart.md)

### Thứ tự thực hiện gợi ý

1. Glossary append → `ChatAbortedError` / `linkAbort` (TDD) → Ollama không-stream + `callJson` + 3 provider (TDD, timeout vẫn đúng).
2. `createGenerationRegistry` (TDD) → map-reduce + studio-service điểm kiểm huỷ (TDD; test hồi quy cũ giữ kỳ vọng) → mã `studioCancelled` → kênh + whitelist test
   → IPC `register.ts` + `index.ts` + preload.
3. `isCurrentGeneration` / `outcomeOf` / `cancelFocusTarget` (TDD) → `useStudio` (TDD: kết cục, A→B→A, tự huỷ) → `StudioCancel` + `StudioColumn` (jsdom) → i18n.
4. e2e (huỷ giữa phần 2, Tạo lại + Huỷ, 900 px) → thủ công Ollama thật → ADR + INDEX → test gate.

## Complexity Tracking

Không có vi phạm hiến pháp cần biện minh.
