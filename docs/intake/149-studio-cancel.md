# Intake — 149-studio-cancel

- Issue: #149 (repo `hoanghainh1188/insight-vault`) — "Studio: huỷ lượt tạo đang chạy" (follow-up của #146, clarify decision #3)
- Slug: `studio-cancel`
- Ngày intake: 2026-10-09
- Loại: bổ sung hành vi cho Studio, là phần việc **146 (studio-progress) đã chủ động tách ra** ("Nút Huỷ → tách issue riêng; sự kiện
  mang `generationId` để thêm Huỷ sau", `2026-10-08-studio-progress-clarify.md` #3; "Không Huỷ ở bản này — tách issue #149",
  `2026-10-08-studio-progress.md`). KHÔNG loại nguồn mới, KHÔNG có Figma, KHÔNG có basic/detail design của khách hàng
  (`docs/01-basic-design/`, `docs/02-detail-design/` chỉ có README). Chạm nhiều tầng: ai-runtime (Ollama + 3 provider online), main
  (`map-reduce`, `studio-service`, wiring `index.ts`, `register.ts`), shared (kênh IPC + khoá i18n + mã lỗi), preload (whitelist),
  renderer (`useStudio`, `StudioColumn`, `StudioProgress`, a11y). **Không đổi** thuật toán tổng hợp, citation `[n]`, lược đồ DB.

## Input sources

- **GitHub issue #149** — brief chính. Phiên intake KHÔNG có Bash (`gh issue view` không chạy được); nội dung issue do agent điều phối dán lại:
  _"Follow-up of #146 (clarify decision #3). Studio has no cancel: `deps.chat` does not pass an `AbortSignal` and Ollama's non-streaming
  path ignores it. Add a Cancel button on the Studio card that aborts the current generation (map/condense/final calls), keyed by the
  `generationId` introduced in #146; no partial result saved. Also consider restoring in-flight progress / blocking duplicate generations
  after navigating away and back (clarify decision #8)."_ **Khuyến nghị:** người phụ trách đối chiếu với thân issue thật trước `/speckit-specify`.
- **Chỉ thị bổ sung từ chủ dự án (qua agent điều phối):** race tồn đọng từ #146 — đổi notebook A → B → A giữa lúc tạo, kết quả lượt A cũ về muộn
  vẫn được ghi vì `stale()` so `notebookId` — **phải được xử lý trong #149** (xem ambiguity #11). Ghi ở mục "Bổ sung sau review" của
  `2026-10-08-studio-progress.md`.
- `docs/OVERVIEW.md` — 3 điểm bất biến (Local-first, Kiểm chứng được, Offline & tự chủ). Huỷ không chạm cam kết nào, nhưng phải dừng egress
  online thật sự (xem #17).
- `docs/03-ui/prototype.html` (cột Studio, dòng ≈ 421–435) — chỉ 4 nút "Tạo nhanh" + 1 thẻ mẫu; **không có** trạng thái đang tạo, tiến độ hay nút huỷ
  ⇒ nút Huỷ là **UI mới, không có nguồn thiết kế gốc** (như tiến độ ở 146). Không sửa prototype.
- `.specify/memory/constitution.md` (v1.0.0) — I (egress online phải dừng + chỉ báo riêng tư đúng), II (không lưu kết quả dở dang ⇒ không citation
  nửa vời), III (kênh mới whitelist, id kiểm, không log nội dung), IV (test-first, coverage ≥ 80% business logic), V (không vi phạm).
- `docs/00-glossary.md` — đã tra: có `Studio`, `StudioKind`, `StudioResult`, `generationId` (146), `StudioProgressEvent`/`StudioProgressPhase` (146),
  `createStudioProgressEmitter` (146), `StudioProgressState`/`ActiveGenerationIds` (146), `map-reduce` (105), `local retry` (098), `announce` (091),
  `reprocess … huỷ giữ bản cũ` (112). **Chưa có** thuật ngữ huỷ lượt tạo Studio / sổ lượt đang chạy (xem mục thuật ngữ mới). `rag:stop` (039)
  chưa có trong glossary (không bắt buộc).
- `docs/04-decisions/INDEX.md` + ADR đã đọc (kế thừa, KHÔNG hỏi lại — xem "Đã chốt / kế thừa"): `2026-10-08-studio-progress-clarify.md` +
  `2026-10-08-studio-progress.md` (146), `2026-10-07-studio-large-clarify.md` (105), `2026-07-11-studio-clarify.md` (021),
  `2026-07-15-studio-balanced-context.md` (065), `2026-10-07-online-fallback-clarify.md` (098), `2026-10-08-i18n*.md` (123).
  Không có file ADR riêng cho 039 (streaming/`rag:stop`); mẫu lấy trực tiếp từ code `register.ts` ≈ 315–353.
- Code đã đọc (chỉ để mô tả điểm tích hợp, KHÔNG phải thiết kế mới): `src/main/services/studio/{studio-service,map-reduce,progress-emitter}.ts`,
  `src/main/ipc/register.ts` (≈ 148–156 `safeHandleWithSender`; 315–353 `rag:askStream`/`rag:stop`/`window-all-closed`; 371–388 `studio:generate`),
  `src/main/index.ts` (≈ 486–507 `makeStudioService`), `src/main/services/ai-runtime/{provider,ollama-client}.ts`,
  `src/main/services/ai-runtime/online/{online-http,online-error,openai-provider,anthropic-provider,gemini-provider}.ts`,
  `src/main/services/app-shell/privacy-state.ts` (`withEgress`), `src/shared/ipc/{types,channels}.ts`, `src/preload/index.ts`,
  `src/renderer/features/studio/{useStudio.ts,StudioColumn.tsx,StudioProgress.tsx,StudioResultCard.tsx,studio-progress.ts}`,
  `src/renderer/features/rag-qa/useChat.ts` (≈ 107–115, 300–304: tiền lệ Dừng + huỷ khi đổi notebook), `src/shared/i18n/domains/{a11y,core,chat}.ts`.
- Figma: không dùng. Design token: không đổi (tái dùng class nút sẵn có như `btn-outline-sm` — chốt ở #6).
- **Không đọc/xác minh trong phiên này:** `studio.css`, `src/main/logging.ts` (ràng buộc trường của `logEvent`), `@shared/codes/user-error` (cách thêm mã lỗi),
  nội dung `tests/unit/studio-*.test.ts` và `tests/e2e/studio*.spec.ts`, phiên bản Electron/Node thực tế (ảnh hưởng `AbortSignal.any`), và hành vi Ollama thật
  khi client ngắt kết nối giữa lúc sinh (cần đo ở plan — #3).

## Sự kiện cần ghi nhận (từ issue + code, để spec không phải đoán)

Nhóm A — vì sao hiện chưa huỷ được (tầng dưới):

1. **`deps.chat` của Studio không có `signal`:** `StudioServiceDeps.chat(messages, {numCtx})` → `index.ts` ≈ 494: `pickProvider(target).chat({messages, numCtx})` — không
   truyền `opts`. `LLMProvider.chat(req, opts?: ChatStreamOpts)` ĐÃ có `signal` (dùng cho stream 039), nhưng chú thích `provider.ts` ghi "Studio giữ nguyên".
2. **Ollama không-stream bỏ qua `signal`:** `ollama-client.ts` — `chat()` chỉ nhánh `opts.onToken` truyền `signal`; nhánh `stream:false` đi qua `call()` tạo
   `AbortController` RIÊNG gắn timeout (120 s, hoặc 300 s khi có `num_ctx` — Studio luôn có) và không nhận signal ngoài. Nhánh stream **nuốt** abort (trả phần đã nhận),
   còn nhánh không-stream khi abort sẽ **ném** `AbortError` (DOMException) thô — không phải `UserFacingError`.
3. **Provider online không-stream cũng không nhận `signal`:** OpenAI/Anthropic/Gemini gọi `callJson({... timeoutMs})` (không truyền `opts.signal`); `callJsonInner` tạo
   `AbortController` riêng + timer 60 s. **Bẫy:** `errorForCause` ánh xạ MỌI `AbortError` → `OnlineProviderError(kind:"timeout")` ⇒ nếu chỉ nối signal ngoài vào controller hiện
   có, một lượt bị huỷ sẽ hiện như "AI online hết thời gian" và còn bật nút "Tạo bằng AI cục bộ" (098). Cần phân biệt huỷ-do-người-dùng với timeout.
4. **`withEgress` có `finally`** (`privacy-state.ts` ≈ 77–87) ⇒ abort ném ra làm chỉ báo "đang gửi dữ liệu ra ngoài" (103) tắt đúng — nhưng chỉ khi abort thực sự làm `fetch` ném.
5. **Vòng retry trong `runMapReduce` sẽ nuốt abort:** map: `for attempt<2 … try { chat } catch (e) { if (attempt===1) throw e }` (≈ 245–251) — lỗi abort ở lần 0 bị coi là "lỗi tạm" và
   **gọi lại lần 2**. `condense()` (≈ 164–184) và bước cuối không có điểm kiểm tra giữa các lượt. `studioService.generate` còn `await contextInfo()` (Ollama gọi `/api/show`)
   TRƯỚC lượt đầu, và `studioRepo.upsert` ở cuối (≈ 131) — hai điểm cần kiểm abort.
6. **Studio đã có `generationId` đi từ renderer → main** (`StudioGenerateInput.generationId`, 146; main kiểm `isValidGenerationId` `/^[A-Za-z0-9_-]{1,64}$/`; thiếu/sai ⇒ không phát tiến độ).
   `studio:generate` dùng `safeHandleWithSender` (có `sender`), kết quả/lỗi về qua `invoke`; không có sổ lượt đang chạy ở main.

Nhóm B — tiền lệ cần tái dùng:

7. **Chat 039:** `streamControllers: Map<streamId, AbortController>` ở `register.ts`; `rag:stop(streamId)` → `controller.abort()` trả `{stopped:true}` (idempotent, không ném khi id không tồn tại);
   `finally` xoá entry; `app.on("window-all-closed")` abort hết (Constitution I — không egress ngầm khi người dùng không còn thấy nút Dừng). Renderer: `useChat` gọi `ragStop` khi **đổi notebook**
   (kèm `announce(chatCancelledMessage)`, a11y `chatCancelled`) và khi bấm Dừng (`stopRequestedRef`; a11y `chatStopped`). Khác Studio: Chat GIỮ phần đã nhận; Studio theo issue **không lưu gì**.
8. **112 (`source:reprocess` huỷ):** "lỗi/huỷ giữ bản cũ" — cùng tinh thần: huỷ Regenerate giữ kết quả cũ.

Nhóm C — renderer hiện tại:

9. **`useStudio.generate`** (≈ 113–160): `stale = notebookRef.current !== notebookId` (so `notebookId`); `activeIds.current[kind] = generationId`; trả `boolean` (true = xong, false = lỗi/stale); `finally` chỉ
   `setLoading(false)` khi `!stale()` và xoá tiến độ khi `activeIds[kind] === generationId`. Khi đổi notebook: effect đặt lại `activeIds`, `progress/results/errors/loading`… nhưng **main vẫn chạy tiếp và vẫn
   `upsert`**. **Race A → B → A:** quay lại A thì `notebookRef === A` ⇒ `stale()` của lượt A cũ = false ⇒ lượt cũ ghi `results`, `setLocalKinds`, và `finally` đặt `loading[kind]=false` — ngay cả khi người dùng
   đã bấm tạo lượt mới ở A (lượt mới mất cờ loading, nút sáng lại giữa lúc đang chạy). Tiến độ không bị ảnh hưởng (lọc theo `generationId`).
10. **UI đang tạo:** nút loại hiện "Đang tạo…" (`disabled`); chưa có kết quả ⇒ `StudioProgress` (khi đã có sự kiện) hoặc skeleton `aria-hidden`; đang Tạo lại ⇒ `StudioProgress onCard` phía trên card cũ, nút
    "Tạo lại" → "Đang tạo…" (`StudioResultCard.regenerating`). **Giữa lúc bấm và sự kiện tiến độ đầu tiên** (gom chunk + `contextInfo()`) chỉ có skeleton/nhãn nút ⇒ nút Huỷ phải sẵn từ lúc `loading[kind]`,
    không phụ thuộc có `progress` hay không. `StudioColumn.run()` announce `studioStart`, và chỉ announce `studioDone` khi `generate` trả true — sẽ có thêm một kết cục "đã huỷ".
11. **Lỗi hiện có (098):** lỗi từ `generate` → `errors[kind]` (`describeIpcError`), `onlineFailed[kind]` khi `parsed.onlineKind !== null && !local` ⇒ nút "Tạo bằng AI cục bộ"/"Thử lại". Huỷ KHÔNG được rơi vào nhánh này.
12. **i18n:** đã có `common.cancel` ("Huỷ"/"Cancel", `core.ts`), `chat.stop` ("Dừng"/"Stop"), `studio.creating`, `studio.progress.*`, `a11y.studioStart/Done/Progress*`, `a11y.chatCancelled/chatStopped`. Main không gửi văn bản hiển thị (123).

## Đã chốt / kế thừa — KHÔNG hỏi lại ở clarify

1. **Thuật toán tổng hợp giữ nguyên (105):** 1-lượt/map-reduce, `MAX_MAP_CALLS = 12`, `MAX_CONDENSE_ROUNDS = 3`, thử lại 1 lần cho lỗi tạm, `parts`/`truncated`, hậu kiểm `[n]` (Constitution II). Huỷ chỉ **dừng sớm**, không đổi kết quả của lượt hoàn tất.
2. **Huỷ theo `generationId` của 146** (issue + clarify 146 #3, #9): định danh do renderer sinh mỗi lần bấm Tạo/Tạo lại/Tạo bằng AI cục bộ; sự kiện tiến độ đã mang id.
3. **Huỷ bao phủ cả ba loại lệnh LLM** (issue): map / condense / final (và lượt 1-lượt).
4. **Không lưu kết quả dở dang** (issue): huỷ ⇒ không `upsert`, `studio_result` giữ nguyên (kết quả cũ của "Tạo lại" còn nguyên). Không migration.
5. **i18n 123:** mã + tham số từ main, renderer dịch vi + en bằng khoá có kiểu; chuỗi a11y dịch bằng translator HIỆN TẠI lúc `announce` (`trRef`).
6. **a11y 091:** `announce` cho MỐC; không `role="status"` cho dòng đổi liên tục.
7. **Constitution III:** kênh mới whitelist ở `preload` + `CHANNELS` (test `studio-channels-whitelist` cập nhật); main-only; id do renderer gửi phải được main kiểm; log không chứa nội dung.
8. **Online + dự phòng cục bộ (098) giữ nguyên:** mọi lượt đi qua `pickProvider(target)`; không thêm egress; không đổi privacy badge ngoài việc nó phải tắt khi huỷ.
9. **Ngoài phạm vi (theo issue/ADR 146):** ETA/thời gian còn lại, stream token Studio, chia sẻ ghi chú map giữa các loại, đổi `MAX_MAP_CALLS`, đổi Chat/tìm toàn văn, dịch lại kết quả cũ, lưu bền trạng thái "đang tạo" trong DB.

## Prompt for /speckit-specify

Thêm **nút Huỷ cho lượt tạo kết quả Studio** (tóm tắt tài liệu / ý chính / FAQ / dàn ý — `summary`, `keyPoints`, `faq`, `outline`) trong InsightVault. Hiện nay Studio **không huỷ được**: khi tạo cho notebook lớn bằng
map-reduce (`src/main/services/studio/map-reduce.ts`: đọc các phần để trích ghi chú → rút gọn ghi chú → viết bản cuối) trên model cục bộ, một lượt có thể mất **nhiều phút**, và người dùng chỉ còn cách chờ hoặc đóng app.
Nguyên nhân kỹ thuật: lệnh `chat` của Studio không truyền `AbortSignal` xuống provider, và nhánh **không-stream** của Ollama (cùng các provider online OpenAI/Anthropic/Gemini) bỏ qua tín hiệu huỷ (chỉ nhánh
stream của Chat 039 mới tôn trọng). Đây là phần việc mà #146 (tiến độ Studio) đã chủ động tách ra, và sự kiện tiến độ của #146 đã mang `generationId` để dùng lại. KHÔNG đổi thuật toán tổng hợp, cách đánh số/hậu kiểm
trích dẫn `[n]`, `parts`, `truncated`, hay lược đồ DB; KHÔNG đổi Chat hay tìm toàn văn.

**Mục tiêu:** trên thẻ Studio của từng loại đang tạo, người dùng thấy một nút **Huỷ**; bấm ⇒ main dừng lượt tạo hiện tại (đang ở lượt LLM map, condense hay final) và **không lưu kết quả dở dang**, giao diện trở về trạng thái
trước khi bấm tạo. Cụ thể: (1) thêm kênh IPC huỷ có whitelist ở `preload`, định danh bằng `generationId`; main giữ sổ các lượt đang chạy (mỗi lượt một `AbortController`, theo khuôn `streamControllers`/`rag:stop` của Chat);
(2) truyền `AbortSignal` xuyên `studioService.generate` → `runMapReduce` → `deps.chat` → `provider.chat`, và làm cho **nhánh không-stream của Ollama và của ba provider online thật sự huỷ được `fetch`**, đồng thời
**phân biệt huỷ do người dùng với hết thời gian** (huỷ không được hiện như lỗi timeout hay bật nút "Tạo bằng AI cục bộ"); (3) kiểm tra huỷ giữa các lượt (vòng map, vòng retry, các vòng rút gọn, trước khi viết, sau `contextInfo()`, và
ngay trước khi lưu) để một lượt đã huỷ không gọi thêm LLM và không ghi DB; (4) huỷ khi **Tạo lại** thì giữ nguyên card cũ; huỷ lượt "Tạo bằng AI cục bộ" (098) hoạt động như lượt thường.

**Hành vi mong muốn (theo issue #149 và kế thừa):**

- **Nút Huỷ** hiện trên thẻ của loại đang tạo — cả lúc chưa có kết quả (chỗ skeleton/tiến độ) lẫn khi Tạo lại (trên card cũ) — và có ngay từ lúc bắt đầu, kể cả trước khi có sự kiện tiến độ đầu tiên. Nhãn qua i18n vi + en, có tên loại cho
  trình đọc màn hình, vừa cột Studio hẹp với chuỗi English. Sau khi bấm có phản hồi tức thì (không để người dùng bấm lặp lại).
- **Kết cục huỷ không phải lỗi:** không hiện khối lỗi `describeIpcError`; trạng thái "đang tạo" và tiến độ biến mất; nút loại sáng lại; kết quả cũ (nếu có) còn nguyên; thông báo trình đọc màn hình "đã huỷ tạo {loại}" (polite, vi/en)
  và focus về chỗ hợp lý khi nút Huỷ biến mất. Việc có thêm thông báo nhìn thấy (toast) hay không chốt ở clarify.
- **Giữ nhất quán dữ liệu:** huỷ không `upsert`; không citation/kết quả nửa vời (Constitution II). Nếu lượt đã lưu xong trước khi lệnh huỷ tới thì kết quả đã lưu được hiển thị như bình thường (huỷ là no-op), không "thu hồi".
- **Online/riêng tư (Constitution I):** huỷ lượt dùng AI online phải ngắt kết nối thật và đưa chỉ báo "đang gửi dữ liệu ra ngoài" về trạng thái nghỉ; không nhắn người dùng rằng "không có dữ liệu nào đã gửi" (yêu cầu có thể đã tới nhà cung cấp).
- **Dọn dẹp:** sổ lượt đang chạy ở main được xoá khi lượt kết thúc (xong/lỗi/huỷ) và khi cửa sổ gọi bị đóng/huỷ (giống `window-all-closed` của Chat) — không egress ngầm sau khi người dùng không còn nút Huỷ.
- **Race A → B → A (chỉ thị chủ dự án):** lượt tạo cũ của notebook A về muộn sau khi người dùng đi A → B → A KHÔNG được ghi đè state của lượt mới (kết quả, cờ loading, local label); nhận diện "lượt còn hiệu lực" bằng
  `generationId` thay vì chỉ `notebookId`.
- **Rời notebook rồi quay lại:** thay vì để main chạy ngầm không ai thấy (hiện trạng của #146), spec phải chốt rõ hành vi — tự huỷ khi rời, hoặc giữ chạy + khôi phục tiến độ + chặn tạo trùng cùng loại. Phương án được chọn ở
  clarify quyết định phạm vi kênh đọc trạng thái (xem Ambiguities #10, #12).

**Tiêu chí chấp nhận (theo issue + bổ sung):**

- Bấm Huỷ giữa lượt map của notebook lớn ⇒ không còn request LLM nào được gửi sau đó (kể cả thử lại), không ghi `studio_result`, UI về trạng thái nghỉ trong thời gian ngắn (không chờ hết timeout 120/300 s).
- Huỷ ở cả ba pha (đọc/rút gọn/viết), lượt 1-lượt, trước lượt LLM đầu (đang `contextInfo()`), với Ollama và với từng provider online; huỷ ≠ lỗi timeout; không hiện "Tạo bằng AI cục bộ" sau huỷ.
- Tạo lại rồi huỷ ⇒ card cũ và dữ liệu DB nguyên vẹn.
- Chỉ báo riêng tư (103) trở về nghỉ sau khi huỷ lượt online.
- A → B → A giữa lúc tạo không gây ghi đè/mất cờ loading của lượt mới.
- Kênh huỷ whitelist (test whitelist/duy nhất tên); id không hợp lệ/không tồn tại/khác cửa sổ ⇒ no-op an toàn; không log nội dung.
- Thông báo trình đọc màn hình (vi/en); không tràn ở cửa sổ 900 px.

**Ràng buộc bất biến phải giữ (Constitution):**

- **I — Local-first:** không thêm egress; huỷ online dừng egress; privacy badge đúng ở mọi kết cục.
- **II — Kiểm chứng được:** không đổi `[n]`/hậu kiểm/`citations`/`truncated`; lượt bị huỷ không để lại kết quả.
- **III — Biên bảo mật:** kênh huỷ whitelist ở `preload`; main kiểm `generationId` (chuỗi hợp lệ) và quyền sở hữu (cùng `sender` đã bắt đầu lượt); không log nội dung/id nhạy cảm; không thêm đường FS/mạng cho renderer.
- **IV — Test-first:** logic huỷ ở `runMapReduce` (không retry khi abort, kiểm giữa các lượt), `studio-service` (không upsert), nối signal ở Ollama + `callJson` + 3 provider, sổ lượt ở `register.ts`, reducer/hook `useStudio`
  (kết cục huỷ, race A→B→A theo `generationId`), hàm chọn thông báo là hàm thuần có test trước; coverage ≥ 80%; cập nhật `studio-map-reduce`, `studio-service`, `studio-notebook-switch`, `studio-channels-whitelist`,
  `studio-progress-hook`, `studio-progress-ui`, e2e.

**Kế thừa, không phá vỡ:** `StudioResult`/`studio_result`/`studio:list`/`studio:export`; hợp đồng `studio:generate` (chỉ thêm/siết hành vi huỷ; `generationId` vẫn tuỳ chọn); `studio:progress` và `createStudioProgressEmitter`;
`describeIpcError` + nút 098; ngôn ngữ đầu ra theo giao diện lúc bấm (123); `announce`/`LiveRegion` (091).

**Ngoài phạm vi:** huỷ hàng loạt ("huỷ tất cả loại"), lưu bền bản nháp/kết quả một phần, ETA, stream token Studio, chia sẻ ghi chú map giữa các loại, đổi giới hạn map-reduce, huỷ các tác vụ khác (reindex, nạp nguồn), đổi Chat.

## Ambiguities to raise in /speckit-clarify

Đã loại (đã có quyết định, xem "Đã chốt / kế thừa"): thuật toán/`parts`/`truncated` giữ nguyên; huỷ theo `generationId`; huỷ phủ map/condense/final; không lưu kết quả dở dang; i18n main-trả-mã; `announce` chỉ mốc; kênh whitelist;
tương thích online/local fallback. Còn lại — mỗi mục kèm phương án và **đề xuất**:

1. **Hình dạng IPC.** (a) invoke mới `studio:cancel(generationId)` → `{cancelled: boolean}` (idempotent, id lạ ⇒ `false`, không ném — khuôn `rag:stop`/`source:reprocessCancel`); (b) tái dùng `studio:generate` kèm cờ; (c) kênh push từ renderer — không có.
   Phụ: input là chuỗi trần hay `{generationId}`; có cần phản hồi "huỷ xong" riêng hay chỉ dựa vào `studio:generate` reject.
   **Đề xuất:** (a), input `generationId` (chuỗi) kiểm bằng `isValidGenerationId`; trả `{cancelled}`; thêm `CHANNELS.studioCancel = "studio:cancel"` + `ChannelResponse`; preload `studioCancel(id)`; không thêm kênh push mới (kết cục về qua `invoke` của `studio:generate`).
2. **Sổ lượt đang chạy ở main: khoá, quyền sở hữu, vòng đời.** Dữ kiện #6–7. (a) `Map<generationId, {controller, sender}>` trong `register.ts` (như `streamControllers`); (b) tách module thuần `createGenerationRegistry()` để test (register/cancel/finish/abortAllFor(sender));
   khoá thêm `(notebookId, kind)` để chặn trùng (#12). Lượt thiếu/sai `generationId` ⇒ không huỷ được (vẫn chạy như 146). Ai được huỷ: chỉ `sender` đã bắt đầu? Dọn khi: `finally` của lượt; `sender` `destroyed`; `window-all-closed`.
   **Đề xuất:** (b) module thuần + wiring mỏng ở `register.ts`; huỷ chỉ hợp lệ từ cùng `sender` (id lạ/khác cửa sổ ⇒ `{cancelled:false}`); `finally` luôn xoá entry; abort theo `sender.once("destroyed")` và `window-all-closed`; `generationId` bắt buộc **để huỷ được**, không đổi contract tuỳ chọn.
3. **Truyền `AbortSignal` xuống provider (Ollama không-stream + 3 provider online) và phân biệt huỷ ≠ timeout.** Dữ kiện #1–4. (a) Dùng sẵn `ChatStreamOpts.signal` (không đổi interface; chỉ sửa chú thích "Studio giữ nguyên"), nhánh không-stream của mọi provider tôn trọng `opts.signal`; (b) interface mới `ChatOpts`.
   Cách nối với controller timeout nội bộ: `AbortSignal.any([signal, timeoutSignal])` (cần Node ≥ 20 — chưa xác minh phiên bản Electron) hay nghe `signal` rồi `controller.abort()` thủ công. Lỗi khi huỷ: ném lỗi chuyên dụng (vd `ChatAbortedError`) KHÔNG phải `OnlineProviderError(timeout)` — kiểm
   `signal.aborted` trước khi ánh xạ `errorForCause`. Ollama thật có dừng sinh khi client ngắt kết nối không (cần đo tay).
   **Đề xuất:** (a); nối thủ công `addEventListener("abort", …, {once:true})` + gỡ listener ở `finally` (không phụ thuộc phiên bản Node); khi `signal.aborted` ném lỗi huỷ chuyên dụng ở `call()` (Ollama) và `callJsonInner` (online) trước `errorForCause`; `deps.chat` của Studio nhận `opts.signal` và
   `index.ts` truyền xuống `pickProvider(target).chat(req, {signal})`; ghi vào plan bước xác minh thủ công "Ollama dừng GPU sau khi ngắt kết nối" (nếu không dừng ⇒ ghi giới hạn đã biết, vẫn huỷ UI + không lưu).
4. **Điểm kiểm tra huỷ & chống nuốt abort.** Dữ kiện #5. Cần kiểm `signal.aborted`/`throwIfAborted()`: đầu mỗi phần map; **trong vòng retry** (abort không được coi là lỗi tạm); đầu mỗi lô/vòng condense; trước bước viết; sau `await contextInfo()`; ngay trước `upsert`. Race "huỷ tới sau khi lượt vừa xong":
   (a) kiểm `aborted` ngay trước `upsert` — nếu đã huỷ thì không lưu; (b) đã `upsert` thì huỷ là no-op và kết quả hiển thị bình thường.
   **Đề xuất:** (a)+(b): `generate(input, {onProgress, signal})` (đổi tham số thứ 3 thành object — cập nhật test 146), `runMapReduce({… signal})`; `catch` trong vòng retry `rethrow` nếu `signal?.aborted`; kiểm trước `upsert`; sau `upsert` không thu hồi. Không phát sự kiện tiến độ sau khi đã huỷ.
5. **Kết cục của `studio:generate` khi bị huỷ và cách renderer nhận biết.** (a) reject bằng `UserFacingError("studioCancelled")` (main trả mã, 123), renderer nhận mã ⇒ kết cục "huỷ" (không errors/onlineFailed); (b) resolve `{cancelled:true}` — đổi kiểu trả của `studio:generate`; (c) renderer tự suy từ cờ `cancelRequested`.
   Cũng: `useStudio.generate` hiện trả `boolean` — cần kết cục 3 trạng thái (`done | failed | cancelled`, + stale) để `StudioColumn.run` biết announce gì.
   **Đề xuất:** (a) + cờ `cancelRequested[kind]` chỉ để UI tức thì (không dùng làm nguồn sự thật); `generate` trả `"done" | "failed" | "cancelled" | "stale"`; nếu lượt hoàn tất trước khi huỷ tới (resolve bình thường) thì xử lý như `done` dù đã bấm Huỷ. Mã lỗi `studioCancelled` thêm vào bảng mã + `describeIpcError` (dự phòng nếu lọt ra).
6. **Vị trí và trạng thái nút Huỷ.** Phương án: (a) nút "Huỷ" trong `StudioProgress` (cạnh dòng pha) + một biến thể cho skeleton trước tiến độ đầu; (b) đổi nhãn nút loại "Đang tạo…" → "Huỷ" (nút hẹp; dễ bấm nhầm; mất `disabled` hiện có); (c) nút trên hàng tiêu đề vùng kết quả luôn hiện khi `loading[kind]`.
   Còn: có hiện khi Tạo lại (trên card cũ) — có; kiểu nút (`btn-outline-sm` tái dùng, không token mới); nhãn hiển thị "Huỷ" (tái dùng `common.cancel`) với `aria-label` có tên loại ("Huỷ tạo Ý chính"); sau bấm: `disabled` + "Đang huỷ…" cho tới khi `generate` kết thúc; có xác nhận hỏi lại không.
   **Đề xuất:** (c) — một component `StudioCancel` hiển thị trong vùng kết quả của loại đó **mỗi khi `loading[kind]`** (không phụ thuộc có `progress`), đặt cùng hàng với dòng pha/skeleton, giữ nhãn nút loại "Đang tạo…"; không xác nhận (huỷ rẻ, không mất dữ liệu); sau bấm hiển thị "Đang huỷ…" `disabled`; kiểm ảnh chụp 900 px/en.
7. **Huỷ lượt "Tạo bằng AI cục bộ" và tương tác với lỗi online (098).** Lượt local chạy qua `studioServices.local` cùng đường huỷ (`target` không ảnh hưởng `studio:cancel`). Khi bắt đầu lượt, `errors[kind]` và `onlineFailed[kind]` đã bị xoá; huỷ xong thì: (a) về nghỉ, không lỗi cũ (người dùng bấm lại nút loại); (b) khôi phục khối lỗi online trước đó cùng nút 098.
   **Đề xuất:** (a) — đơn giản, không lưu thêm state; không đổi `localKinds` khi huỷ (nhãn "AI cục bộ" của kết quả cũ giữ nguyên).
8. **Phản hồi sau huỷ: im lặng hay hiển thị.** Dữ kiện #10: `studioStart` đã được announce nên cần câu kết thúc, nếu không "Đang tạo…" treo lơ lửng (bài học `chatCancelled`, 091 review). (a) chỉ `announce` (polite) + UI về trạng thái nghỉ; (b) thêm dòng chữ/toast "Đã huỷ" tạm thời; (c) im lặng hoàn toàn.
   **Đề xuất:** (a) — người dùng vừa bấm nút nên thay đổi UI là đủ; khoá `a11y.studioCancelled` vi "Đã huỷ tạo {label}." / en "Cancelled creating {label}."; câu này cũng dùng khi tự huỷ do rời notebook (#10)? — xem #10; hàm thuần chọn thông báo có test.
9. **Quản lý focus sau khi huỷ.** Nút Huỷ biến mất khi lượt kết thúc ⇒ focus rơi về `body`. (a) về nút loại tương ứng (`studio-btn-<kind>`); (b) về nút "Tạo lại" của card cũ nếu có; (c) tiêu đề cột Studio (như 098 `titleRef`).
   **Đề xuất:** (b) khi có card cũ, ngược lại (a); chỉ áp khi focus đang nằm trong nút Huỷ vừa bấm (không cướp focus nếu người dùng đã đi nơi khác); test bằng RTL.
10. **Rời notebook giữa lúc tạo: tự huỷ hay giữ chạy.** Dữ kiện #7, #9. Hiện (146 #8): renderer bỏ state, main chạy tiếp và `upsert`, quay lại không thấy gì. (a) **Tự huỷ** khi đổi `notebookId`/unmount `useStudio` (đúng tiền lệ Chat 039: `ragStop` + `announce` huỷ) — kéo theo: không còn lượt chạy ngầm,
    không còn nhu cầu khôi phục (#12) hay race (#11); đổi hành vi so với 146 (cập nhật `studio-notebook-switch.test.ts`, ghi ADR "thay thế" cho dòng "main vẫn chạy" của 146 #8); mất công việc nếu rời nhầm. (b) **Giữ chạy** như 146 + khôi phục tiến độ + chặn trùng (#12). (c) Tự huỷ chỉ khi rời cả Workspace, giữ khi chỉ đổi notebook.
    **Đề xuất:** (a) — rẻ nhất, nhất quán với Chat, đúng Constitution I (không LLM/egress ngầm sau khi người dùng không còn nút Huỷ), loại bỏ cả #11 lẫn #12 tận gốc; main cũng abort khi cửa sổ đóng (#2). Chủ dự án xác nhận nếu muốn (b) (chấp nhận thêm kênh đọc + sổ theo `(notebookId, kind)`).
11. **Sửa race A → B → A.** Dữ kiện #9. (a) thay `stale()` bằng kiểm `activeIds.current[kind] === generationId` (và bỏ kết quả/`setLoading`/`setLocalKinds` nếu không còn là lượt hiện tại); (b) thêm "epoch" tăng mỗi lần đổi notebook; (c) chỉ dựa vào tự huỷ ở #10(a). Chú ý `finally` hiện tắt `loading` theo `!stale()`; phải chuyển sang cùng điều kiện `generationId`.
    **Đề xuất:** (a) luôn làm (phòng thủ ngay cả khi #10(a), vì kết quả có thể về sau abort hoặc trước khi huỷ tới); gom thành hàm thuần `isCurrentGeneration(activeIds, kind, generationId)` + test hồi quy đúng kịch bản A→B→A (lượt cũ về muộn không ghi `results`/không tắt `loading` của lượt mới).
12. **Khôi phục tiến độ / chặn tạo trùng sau khi quay lại (issue: "also consider").** Chỉ cần nếu #10 chọn (b). (a) bỏ — nếu #10(a); (b) main giữ sổ `(notebookId, kind) → {generationId, tiến độ gần nhất}`, thêm kênh đọc `studio:status(notebookId)` để renderer nhận lại `generationId` khi mở lại (và tiếp tục nhận `studio:progress`), kèm cờ "đang tạo" + nút Huỷ;
    (c) chỉ **chặn trùng ở main**: tạo mới cùng `(notebookId, kind)` khi đang có lượt ⇒ huỷ lượt cũ (supersede) hoặc từ chối (reject).
    **Đề xuất:** nếu #10(a): (a) cho khôi phục, nhưng vẫn thêm (c)-supersede ở main như lớp phòng thủ (lượt mới thắng, lượt cũ bị abort — người dùng muốn kết quả mới nhất, không kẹt trạng thái); nếu #10(b): làm đủ (b)+(c), tách module sổ đã có ở #2.
13. **Nhiều loại cùng lúc.** 146 #7: tiến độ riêng từng loại. (a) Huỷ chỉ loại có nút bấm (mỗi loại một `generationId`); (b) thêm "Huỷ tất cả". **Đề xuất:** (a); "huỷ tất cả" ngoài phạm vi; khi một lượt bị huỷ, các loại khác chạy tiếp không bị ảnh hưởng (kiểm test song song).
14. **Ghi log.** Cần dấu vết huỷ để chẩn đoán nhưng KHÔNG nội dung (Constitution III). **Đề xuất:** `logEvent("studio.cancelled", { kind, phase, reason })` với `reason ∈ user | navigate | window` (mã, không văn bản); không log `notebookId`/`generationId`/messages; cần xác nhận ràng buộc trường của `logEvent` (chưa đọc `logging.ts`).
15. **Khoá i18n và thuật ngữ.** Đề xuất khoá: `studio.cancel` (hoặc tái dùng `common.cancel`) vi "Huỷ"/en "Cancel"; `studio.cancelAria` "Huỷ tạo {kind}" / "Cancel creating {kind}"; `studio.cancelling` "Đang huỷ…" / "Cancelling…"; `a11y.studioCancelled`; mã lỗi `studioCancelled` (+ thông điệp dự phòng ở `errors`).
    **Đề xuất:** tái dùng `common.cancel` cho nhãn hiển thị; thêm 3 khoá còn lại cả hai ngôn ngữ (test vi↔en); duyệt bản English theo quy ước 123.
16. **Chiến lược kiểm thử.** **Đề xuất:** (i) unit TDD: `map-reduce` (abort trước/giữa phần, trong retry không gọi lại, trong condense, trước final; không phát tiến độ sau huỷ), `studio-service` (abort sau `contextInfo`, trước `upsert`; DB không đổi), `ollama-client` (fetch giả tôn trọng signal ⇒ ném lỗi huỷ, không phải timeout),
    `online-http`/3 provider (signal ⇒ lỗi huỷ chuyên dụng; vẫn timeout đúng khi không huỷ), module sổ lượt (register/cancel/finish/sender sai/id lạ/`abortAllFor`), `studio-channels-whitelist`, `useStudio` (kết cục cancelled, race A→B→A, tự huỷ khi đổi notebook, card cũ giữ), `StudioCancel` UI + focus + announce vi/en;
    (ii) e2e: Ollama giả HTTP với `/api/chat` **treo/chậm** (≫ 1,5 s của `studio-progress.spec.ts`) ⇒ bấm Huỷ ⇒ server giả ghi nhận **kết nối bị đóng** và **không nhận thêm request** (đường nhiều phần ~40.000 ký tự: huỷ ở "Đang đọc phần 2/N"), UI về nghỉ, không khối lỗi, `studio:list` không đổi, Tạo lại + Huỷ giữ card cũ, cửa sổ 900 px không tràn;
    (iii) thủ công (ghi vào plan): Ollama thật dừng sinh sau khi huỷ; online thật (key của người dùng) badge tắt sau huỷ.
17. **Thông điệp riêng tư khi huỷ online.** Request có thể đã tới nhà cung cấp (và bị tính phí) dù huỷ. **Đề xuất:** không thêm câu "dữ liệu chưa gửi"; chỉ bảo đảm `withEgress` tắt (kiểm bằng test) và không có yêu cầu mới sau huỷ; ghi "Giới hạn đã biết" trong ADR; không đổi privacy badge (103) ngoài việc nó về nghỉ.

## Thuật ngữ mới (append vào glossary)

Chưa có trong `docs/00-glossary.md` (đã tra: `generationId` 146, `StudioProgressEvent` 146, `local retry` 098, `reprocess … huỷ` 112 đã có). Đề xuất append (không sửa term cũ; cột 日本語 để `—`):

| 日本語 | Tiếng Việt (đề xuất)                         | English (đề xuất, dùng trong code)                            | Ghi chú                                                                                                        |
| ------ | -------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| —      | Huỷ lượt tạo Studio                          | Studio cancel (`studio:cancel`, `studioCancel`)               | Invoke theo `generationId`, idempotent `{cancelled}`; không lưu kết quả dở dang — 149                          |
| —      | Sổ lượt tạo Studio đang chạy (main)          | generation registry (`createGenerationRegistry`)              | `generationId → {AbortController, sender}`; dọn ở `finally`/cửa sổ đóng; khuôn `streamControllers` (039) — 149 |
| —      | Lỗi huỷ lượt tạo (không phải lỗi người dùng) | `studioCancelled` (mã `UserFacingError`) / `ChatAbortedError` | Kết cục huỷ; phân biệt với timeout (`OnlineProviderError` kind `timeout`); renderer KHÔNG hiện khối lỗi — 149  |
| —      | Lượt còn hiệu lực (renderer)                 | current generation (`isCurrentGeneration`)                    | So `generationId` đang chạy của loại, thay `stale()` theo `notebookId` — sửa race A→B→A — 149                  |

Ghi chú: gộp bớt khi append trong branch feature (rule 5 `CLAUDE.md`: THÊM term được làm ngay). Không sửa/đổi tên `generationId`/`StudioProgressEvent` (146); nếu muốn bổ sung ngữ nghĩa "dùng để huỷ" cho `generationId` — đó là SỬA term cũ ⇒ PR riêng được steward duyệt.

## Đối chiếu constitution

- **I (Local-first):** huỷ làm giảm egress; cần bảo đảm `fetch` online bị ngắt thật và `withEgress` tắt; không thêm egress; tự huỷ khi rời notebook/đóng cửa sổ (nếu chọn) tránh LLM/egress ngầm. Điểm canh: không để chuỗi UI ngụ ý "chưa gửi gì" (#17).
- **II (Kiểm chứng được):** không đổi `[n]`/hậu kiểm/`citations`/`truncated`/`parts`; huỷ không để lại kết quả nửa vời; hậu kiểm vẫn chạy cho lượt hoàn tất.
- **III (Biên bảo mật):** kênh `studio:cancel` whitelist ở `preload` + `CHANNELS`; main kiểm `generationId` + quyền sở hữu `sender`; không log nội dung/messages; renderer không nhận quyền mới.
- **IV (Test-first):** hàm thuần/sổ lượt/logic abort có test trước, coverage ≥ 80%; wiring `ipcMain` + `index.ts` loại khỏi coverage như quy ước; cập nhật test Studio hiện có + test khoá i18n vi↔en.
- **V (Phased Delivery):** không vi phạm (hoàn thiện Studio, Pha 1).
- **Additional constraints:** i18n 123 (khoá vi + en, không chuỗi cứng); source-of-truth (prototype không có UI huỷ — ghi nhận UI mới); không thêm dependency; không migration; ADR: ghi quyết định clarify vào `docs/04-decisions/2026-10-09-studio-cancel-clarify.md` (+ append `INDEX.md`), nêu rằng nó **bổ sung/thay thế một phần** 146 #3 ("tách issue"), 146 #8 ("giữ như hiện tại") và dòng "Ngoài phạm vi: A→B→A" (không sửa file cũ).

## Suggested constitution amendments

Không đề xuất sửa trực tiếp (mọi sửa đổi constitution phải qua PR riêng được steward duyệt, rule 5). Cân nhắc về sau, không bắt buộc ở 149, gộp với gợi ý chỉ báo tiến độ của 146: một dòng ở "Additional Constraints" rằng "mọi tác vụ AI có thể kéo dài quá vài giây MUST có chỉ báo tiến độ ở mức mốc
**và** cho phép người dùng huỷ; huỷ MUST ngắt kết nối mạng thật (nếu là provider online), không lưu kết quả dở dang, và không hiện như lỗi" — để Chat (đã có Dừng), Studio, và các tác vụ dài về sau (reindex, xử lý lại) theo cùng một khuôn thay vì mỗi feature bổ sung muộn (như 105 → 146 → 149).
