# Intake — 146-studio-progress

- Issue: #146 (repo `hoanghainh1188/insight-vault`) — "Studio: hiển thị tiến độ (phần i/N) khi tạo kết quả dài"
- Slug: `studio-progress`
- Ngày intake: 2026-10-08
- Loại: cải tiến trải nghiệm (UX) nội bộ cho Studio, là phần việc **105 (studio-large) đã chủ động hoãn** ("Chưa có tiến độ i/N
  cho map-reduce … để sau", `2026-10-07-studio-large-clarify.md`). KHÔNG phải loại nguồn mới, KHÔNG có Figma, KHÔNG có basic/detail
  design của khách hàng (`docs/01-basic-design/` và `docs/02-detail-design/` chỉ có README). Chạm: main (studio-service +
  map-reduce + wiring `index.ts`), shared (kênh IPC + kiểu sự kiện + khoá i18n), preload (whitelist kênh push), renderer
  (`useStudio`, `StudioColumn`, `StudioResultCard`, a11y). **Không đổi** thuật toán tổng hợp, citation `[n]`, hay lược đồ DB.

## Input sources

- **GitHub issue #146** — brief chính. Phiên intake KHÔNG có Bash (`gh issue view` không chạy được); nội dung issue do agent điều
  phối dán lại. **Khuyến nghị:** người phụ trách đối chiếu với thân issue thật trước `/speckit-specify`, đặc biệt câu "works with
  cancel" (xem ambiguity #3 — hiện KHÔNG có nút huỷ Studio).
- `docs/OVERVIEW.md` — 3 điểm bất biến (Local-first, Kiểm chứng được, Offline & tự chủ). Tính năng này không chạm cam kết nào
  ngoài việc phải giữ chỉ báo riêng tư đúng khi dùng AI online.
- `docs/03-ui/prototype.html` (cột Studio, dòng ≈ 421–435) — chỉ có 4 nút "Tạo nhanh" + 1 thẻ mẫu; **không có** trạng thái đang
  tạo/tiến độ ⇒ phần UI tiến độ là **mới, không có nguồn thiết kế gốc** (cùng tình trạng skeleton hiện tại). Bố cục/luồng cột Studio
  giữ nguyên prototype; không sửa prototype.
- `.specify/memory/constitution.md` (v1.0.0) — Principle I (privacy indicator đúng; không egress mới), II (chip `[n]` không đổi),
  III (kênh IPC whitelisted; main-only; không log nội dung), IV (test-first, coverage ≥ 80% business logic), V (không vi phạm).
- `docs/00-glossary.md` — đã tra: có `Studio`, `StudioKind`, `StudioResult`, `truncated`, `map-reduce (runMapReduce, parts)` (105),
  `announce (announce, LiveRegion)` (091), `STUDIO_CONTEXT_BUDGET`, `context window (numCtx…)` (105), `local retry` (098),
  `output language` (123). **Chưa có** thuật ngữ sự kiện tiến độ Studio / pha / `generationId` / tiến độ bất định (xem mục thuật ngữ mới).
- `docs/04-decisions/INDEX.md` + ADR đã đọc (kế thừa, KHÔNG hỏi lại — xem "Đã chốt / kế thừa"):
  - `2026-10-07-studio-large-clarify.md` (105) — map-reduce [n] toàn cục, `MAX_MAP_CALLS`, rút gọn ghi chú, thử lại 1 lần,
    timeout 5 phút khi có `num_ctx`; dòng cuối: **"Chưa có tiến độ i/N … để sau"** ⇒ #146 là phần tiếp nối này.
  - `2026-07-11-studio-clarify.md` (021), `2026-07-15-studio-balanced-context.md` (065), `2026-07-11-studio-mapreduce-citation.md`
    (bản mức NGUỒN, **đã bác** bởi 105 — không liên quan tiến độ).
  - `2026-10-07-online-fallback-clarify.md` (098) — lỗi online ⇒ nút "Tạo bằng AI cục bộ"/"Thử lại" cho đúng lượt; bản `local` của
    studio service chạy MỌI lệnh LLM bằng Ollama.
  - `2026-10-08-i18n.md` / `…-i18n-clarify.md` (123) — mọi chuỗi UI qua khung i18n (vi + en, khoá có kiểu), main trả **mã/tham số** thay
    vì văn bản; Studio tạo theo ngôn ngữ giao diện lúc bấm; chuỗi a11y dịch bằng translator HIỆN TẠI lúc `announce`.
  - 091 (a11y) — `announce` chỉ cho MỐC trạng thái, không từng token/%; 011 (`source:progress`), 059 (`embed:reindexProgress`), 103
    (`app:privacyChanged`), 039 (`rag:streamToken` + `streamId`) — các tiền lệ kênh push main→renderer.
- Code đã đọc (chỉ để mô tả điểm tích hợp, KHÔNG phải thiết kế mới): `src/main/services/studio/{studio-service,map-reduce,context-window}.ts`,
  `src/main/index.ts` (≈ 358–364 `emitProgress`, 486–507 `makeStudioService`), `src/main/ipc/register.ts` (≈ 356–369 `studio:generate`;
  ≈ 300–330 `rag:askStream`/`rag:stop`), `src/shared/ipc/{channels,types}.ts`, `src/preload/index.ts` (`onSourceProgress`, `onReindexProgress`,
  `onRagStreamToken`), `src/renderer/features/studio/{useStudio.ts,StudioColumn.tsx,StudioResultCard.tsx,studio.css}`,
  `src/renderer/features/ai-runtime/ReindexBanner.tsx` (mẫu banner + announce theo mốc), `src/renderer/shared/a11y/{announcer.ts,LiveRegion.tsx,messages.ts}`,
  `src/shared/i18n/domains/{studio,a11y}.ts`, `src/main/services/ai-runtime/ollama-client.ts` (timeout), tests `tests/unit/studio-*.test.ts`.
- Figma: không dùng. Design token: không đổi (dùng token/class sẵn có; thanh tiến độ nếu có tái dùng kiểu của nguồn/banner — xem ambiguity #4).
- **Không đọc/xác minh trong phiên này:** `prompt.ts` (không liên quan), đường truyền `signal` của provider online ở nhánh không-stream
  (chỉ cần nếu làm nút huỷ — ambiguity #3), nội dung `tests/e2e/studio.spec.ts`, các dòng INDEX bị cắt khi grep (đã tìm theo "tiến độ/progress/studio" —
  không thấy quyết định nào khác về tiến độ Studio ngoài dòng cuối của 105).

## Sự kiện cần ghi nhận (từ issue + code, để spec không phải đoán)

Nhóm A — luồng tạo Studio hiện tại (nguồn của "phần i/N"):

1. **`studioService.generate()` biết 1-lượt hay nhiều-phần TRƯỚC khi gọi LLM lần đầu:** gom chunk các nguồn `ready` (lọc `sourceId` nếu có;
   không có chunk ⇒ `UserFacingError`), `await contextInfo()` (Ollama: đọc `context_length` qua `/api/show` — có thể mất thời gian), rồi
   `single = buildBalancedContext(…, ∞)`; `single.contextText.length <= budget` ⇒ **đúng 1 lượt `chat`**; ngược lại `runMapReduce`.
2. **`runMapReduce` có ba pha, số lượt gọi LLM:** (a) _map_: `numberAll` + `packBatches(blocks, budget)` ⇒ `allBatches`; chỉ xử lý
   `slice(0, MAX_MAP_CALLS = 12)` ⇒ **M = min(allBatches, 12) biết chắc ngay đầu pha**, mỗi lô 1 lượt `chat` (lỗi tạm/ghi chú rỗng ⇒ thử lại
   1 lần, vẫn là cùng "phần i"); không lô nào ra ghi chú ⇒ ném `studioNoNotes`; (b) _condense_: lặp khi tổng ghi chú > ngân sách, tối đa
   `MAX_CONDENSE_ROUNDS = 3` vòng, mỗi vòng `packBatches(notes)` ra k lô, mỗi lô 1 lượt `chat` ⇒ **số vòng và k KHÔNG biết trước** (có thể 0
   vòng; k chỉ biết lúc bắt đầu vòng); (c) _final_: 1 lượt `chat` ghép thành bản Studio. Tổng lượt = M + Σk + 1.
3. **Kết quả cuối có `parts = batches.length` (≤ 12) và `truncated`** (`allBatches > 12`, lô rỗng, hoặc ghi chú bị cắt); `parts` **chỉ có ở kết
   quả vừa tạo** (không lưu DB — chú thích kiểu `StudioResult.parts`), card hiện ghi chú `studio-parts` ("Tổng hợp từ N phần …") sau khi xong.
   ⇒ "N" trong tiến độ nên nhất quán với `parts` (số lượt map thực chạy), không phải số lô tối đa của tài liệu.
4. **Studio KHÔNG stream token** (khác Chat 039): mỗi lượt là một `chat` không-stream, Ollama timeout 120 s mặc định / **300 s** khi có `num_ctx`
   (`LARGE_CHAT_TIMEOUT_MS`; Studio luôn truyền `num_ctx` cho Ollama khi biết cửa sổ). ⇒ trong MỘT phần có thể **không có sự kiện nào hàng phút** —
   tiến độ mức phần thô; không thể báo % trong một phần.

Nhóm B — renderer và trạng thái hiện tại:

5. **Trạng thái theo TỪNG loại (`StudioKind`):** `useStudio` giữ `results/loading/errors/onlineFailed/localKinds` dạng `Partial<Record<StudioKind,…>>`;
   4 nút độc lập, mỗi nút bị `disabled` khi `loading[kind]`; **main không khoá** — nhiều loại có thể chạy cùng lúc (Ollama xếp hàng ở server; mỗi loại tự
   chạy lại bước map vì ghi chú không dùng chung giữa các loại).
6. **UI "đang tạo" hiện tại:** (i) nút loại hiện "Đang tạo…" (`studio.creating`); (ii) lần đầu chưa có kết quả ⇒ **skeleton** `studio-skeleton-<kind>`
   (`aria-hidden`, 3 dòng shimmer); (iii) tạo lại khi đã có kết quả ⇒ **card cũ vẫn hiện**, chỉ nút "Tạo lại" đổi thành "Đang tạo…" (`regenerating`).
   ⇒ chỗ hiển thị tiến độ phải xử lý cả hai tình huống (ii) và (iii) (ambiguity #4).
7. **Không có huỷ cho Studio:** không kênh `studio:cancel`/`studio:stop`; `deps.chat` của Studio chỉ nhận `(messages, {numCtx})` và gọi
   `provider.chat({messages, numCtx})` — **không truyền `AbortSignal`**; nhánh không-stream của Ollama dùng `AbortController` riêng gắn timeout
   (chỉ nhánh stream mới nhận `signal`). Chat có `rag:stop` (Map `streamControllers`). ⇒ "huỷ" Studio, nếu làm, là việc **mới ở nhiều tầng**, không phải
   "đi kèm" tiến độ (ambiguity #3).
8. **Chuyển notebook giữa lúc tạo:** `useStudio` đặt lại toàn bộ state khi đổi `notebookId` và bỏ kết quả/lỗi về muộn qua `notebookRef` (`stale()`) — test
   `studio-notebook-switch.test.ts`; `generate` trả `false` để UI không báo "xong" sai. **Main vẫn chạy tiếp và vẫn `upsert`** kết quả. Quay lại notebook: không
   còn biết có lượt đang chạy (nút sáng lại; bấm sẽ tạo lượt thứ hai song song). `studio:list` chỉ trả kết quả đã lưu.
9. **Báo trình đọc màn hình (091):** `StudioColumn.run()` gọi `announce(studioMessage(label,"start"))` rồi `"done"` (khoá `a11y.studioStart/Done`, translator HIỆN TẠI
   qua `trRef`); không có thông báo giữa chừng. `LiveRegion`: hàng đợi polite/assertive, giữ mỗi câu ≥ 500 ms, tối đa 10 câu mỗi mức (bỏ câu cũ nhất). Quy ước 091:
   không `role="status"` cho dòng chữ đổi liên tục; mốc báo qua `announce()`. Có sẵn `progressValueText(step,pct,tr)` ("{step}, {pct}%") cho `aria-valuetext`.
10. **i18n (123) đã phủ Studio:** `src/shared/i18n/domains/studio.ts` (vi nguồn `as const`, en `Widen<…>` — thiếu khoá/placeholder lệch bị `tsc` + test bắt) và `a11y.ts`.
    Khoá hiện có liên quan: `studio.creating`, `studio.parts` (one/other, có `{count}`), `studio.truncated`, `a11y.studioStart/Done`. Mọi chuỗi mới ở #146 phải là
    khoá mới ở hai domain này (cả vi và en), không chuỗi cứng; main KHÔNG gửi văn bản hiển thị.

Nhóm C — IPC và main:

11. **Tiền lệ kênh push main→renderer** (không nằm trong `ChannelResponse`): `source:progress` (main `emitProgress` gửi cho MỌI cửa sổ qua `BrowserWindow.getAllWindows()`),
    `embed:reindexProgress`, `backup:progress`, `app:privacyChanged`, `app:uiLanguageChanged`, `rag:streamToken` (payload `{streamId, delta}`; **`streamId` do renderer sinh**,
    main kiểm string không rỗng — dùng để tương quan + huỷ). Preload mỗi kênh có `on*(cb)` trả hàm huỷ; `CHANNELS` được test whitelist/duy nhất tên
    (`studio-channels-whitelist.test.ts`).
12. **Hai instance `studioServices.{active,local}`** tạo bởi `makeStudioService(target)` trong `src/main/index.ts`; kênh `studio:generate` chọn theo `parseAiTarget(input)`.
    Sự kiện tiến độ phải đi qua cùng một hàm phát (như `emitProgress`) để cả hai target dùng chung; provider online/local không làm đổi hình dạng sự kiện.
13. **Không log nội dung:** `studio-service`/`map-reduce` không log nội dung (Constitution III). Sự kiện tiến độ chỉ được mang số đếm + mã pha + định danh lượt — không văn bản
    ghi chú, không tiêu đề nguồn, không đoạn nguồn.

## Đã chốt / kế thừa — KHÔNG hỏi lại ở clarify

1. **Thuật toán tổng hợp giữ nguyên (105):** 1-lượt khi vừa ngân sách, ngược lại map-reduce với `[n]` toàn cục; `MAX_MAP_CALLS = 12`, `MAX_CONDENSE_ROUNDS = 3`, thử lại 1 lần,
   `parts`/`truncated` giữ ngữ nghĩa; hậu kiểm `[n]` theo đầu vào từng bước (Constitution II). #146 chỉ **quan sát** tiến trình, không đổi kết quả.
2. **Pha theo issue:** đọc các phần (map) → rút gọn (condense) → viết (final); 1-lượt ⇒ trạng thái "đang viết…" **bất định** (không có i/N).
3. **Kênh push mới, whitelist ở preload** (Constitution III), theo khuôn kênh push sẵn có (#11); main-only; **không** nội dung/tiêu đề/đoạn nguồn trong sự kiện hay log.
4. **i18n 123:** main gửi **mã + số đếm**, renderer dịch bằng khoá (vi + en) — không văn bản đã dịch qua IPC; chuỗi a11y dịch bằng translator HIỆN TẠI lúc `announce` (khuôn `trRef`).
5. **a11y 091:** `announce` chỉ cho **mốc**; không `role="status"` cho dòng chữ đổi liên tục; có `prefers-reduced-motion` cho chuyển động (đã có tiền lệ ở `app.css`/`rag-qa.css`).
6. **Sự kiện của lượt cũ bị bỏ** khi người dùng chuyển notebook (091 review S3) — giữ cơ chế `stale()`; lỗi → UI lỗi hiện có (`describeIpcError`, 098) và tiến độ biến mất.
7. **Online + dự phòng cục bộ (098):** tiến độ hoạt động với cả provider online lẫn "Tạo bằng AI cục bộ" (`target: "local"`); lượt mới = tiến độ mới; không thêm egress, không đổi
   privacy badge (103) — mỗi lượt `chat` vẫn đi qua `pickProvider(target)` như cũ.
8. **Không đổi dữ liệu bền:** `studio_result` (UNIQUE(notebook, kind), upsert) và migration giữ nguyên; tiến độ là trạng thái tạm (dự kiến KHÔNG cần migration — xác nhận ở plan).
9. **Ngoài phạm vi (theo issue/ADR):** đổi thuật toán map-reduce, giảm số lượt gọi LLM, chia sẻ ghi chú giữa các loại, stream token Studio, đổi giới hạn `MAX_MAP_CALLS`, đổi
   hành vi Chat/tìm toàn văn, dịch lại kết quả đã sinh.

## Prompt for /speckit-specify

Thêm **hiển thị tiến độ khi tạo kết quả Studio** (tóm tắt tài liệu / ý chính / FAQ / dàn ý — `summary`, `keyPoints`, `faq`, `outline`) trong InsightVault. Hiện nay, với notebook lớn, Studio tạo
kết quả theo từng phần bằng map-reduce (`src/main/services/studio/map-reduce.ts`: đọc các phần để trích ghi chú → rút gọn ghi chú nếu còn quá dài → viết bản cuối), và trên model cục bộ việc này
có thể mất **nhiều phút**; trong thời gian đó giao diện chỉ hiện khung chờ (skeleton) và nhãn "Đang tạo…", **không cho biết đang ở bước nào hay còn bao lâu**. Đây là phần việc mà
105 (studio-large) đã chủ động hoãn lại ("Chưa có tiến độ i/N cho map-reduce … để sau"). KHÔNG thêm loại nguồn mới; KHÔNG đổi thuật toán tổng hợp, cách đánh số/hậu kiểm trích dẫn `[n]`, `parts`,
`truncated`, hay lược đồ DB; KHÔNG đổi hỏi đáp (Chat) hay tìm toàn văn.

**Mục tiêu:** main process **báo tiến độ** của mỗi lượt tạo Studio gồm **pha** (đọc các phần / rút gọn / viết) và, với tài liệu lớn, **phần i trên N**; renderer hiển thị tiến độ ngay trên
thẻ Studio (tiếng Việt + English qua khung i18n 123), kèm **thông báo cho trình đọc màn hình ở các mốc** (không đọc dồn từng bước). Với notebook nhỏ — tổng hợp 1 lượt — chỉ hiện trạng thái
**"đang viết…" bất định** (không có i/N). Ví dụ kỳ vọng: notebook lớn ⇒ cập nhật dạng "Phần 2/5…" rồi "Đang rút gọn ghi chú…" rồi "Đang viết…"; notebook nhỏ ⇒ trạng thái viết đơn giản.

**Hành vi mong muốn (theo issue #146 và kế thừa):**

- **Báo tiến độ ở main:** `studio-service`/`runMapReduce` phát sự kiện tiến độ qua **kênh push main→renderer mới** (whitelist ở `preload`, theo khuôn `source:progress`/`embed:reindexProgress`/
  `rag:streamToken`). Sự kiện chỉ chứa **mã pha, số đếm và định danh lượt** (đủ để renderer gắn đúng notebook/loại và bỏ sự kiện của lượt cũ) — **không** chứa nội dung ghi chú, đoạn nguồn,
  tiêu đề nguồn, và **không** ghi nội dung vào log (Constitution III). Số phần N là số lượt map thực chạy (nhất quán với `parts`); số vòng rút gọn không biết trước nên pha này không có tổng cố định.
- **Hiển thị trên thẻ Studio:** tiến độ xuất hiện đúng loại (`StudioKind`) đang tạo, cả khi chưa có kết quả (chỗ skeleton) lẫn khi "Tạo lại" trên thẻ đã có kết quả; mọi chuỗi qua khoá i18n vi + en;
  chuyển động tôn trọng `prefers-reduced-motion`; đủ rộng/không tràn ở cột Studio hẹp với chuỗi English dài hơn.
- **Trình đọc màn hình (091):** giữ thông báo bắt đầu/xong hiện có; thêm thông báo ở **mốc** (đổi pha và một số mốc phần) bằng `announce`, dịch theo ngôn ngữ giao diện hiện tại; không `role="status"` cho
  dòng chữ đổi liên tục. Tần suất chốt ở clarify.
- **Tương thích:** hoạt động với AI online (098) và với "Tạo bằng AI cục bộ" (`target: "local"`); lỗi giữa chừng ⇒ UI lỗi hiện có, tiến độ biến mất; chuyển notebook giữa lúc tạo ⇒ sự kiện lượt cũ bị bỏ
  (giữ `stale()`); lượt mới (kể cả thử lại) có định danh mới nên không lẫn sự kiện. Việc có thêm **nút huỷ** Studio hay không, hiển thị **thời gian còn lại**, **khôi phục tiến độ khi quay lại notebook**, và
  nhiều loại chạy cùng lúc — chốt ở clarify (xem Ambiguities).

**Tiêu chí chấp nhận (theo issue):**

- Notebook lớn (map-reduce) ⇒ thẻ Studio hiện cập nhật kiểu "Phần 2/5…" qua các phần, rồi pha rút gọn (nếu có) và pha viết; hoàn tất ⇒ kết quả như cũ (kèm ghi chú `parts` như hiện tại).
- Notebook nhỏ (1 lượt) ⇒ chỉ trạng thái "đang viết…" đơn giản, không hiển thị i/N giả.
- Sự kiện tiến độ không chứa nội dung; log không chứa nội dung; kênh push mới được whitelist (test whitelist/duy nhất tên cập nhật).
- Có thông báo trình đọc màn hình ở mốc (vi/en); không đọc dồn dập.
- Chuyển notebook/lỗi/tạo lại/dự phòng cục bộ không để lại tiến độ cũ hoặc sai thẻ.

**Ràng buộc bất biến phải giữ (Constitution):**

- **I — Local-first:** không thêm egress; chỉ báo riêng tư (103) vẫn đúng khi dùng AI online (mỗi lượt `chat` đi qua `pickProvider` như cũ); sự kiện tiến độ là kênh nội bộ main↔renderer.
- **II — Kiểm chứng được:** không đổi `[n]`/hậu kiểm/`citations`/`truncated`; tiến độ không làm thay đổi kết quả.
- **III — Biên bảo mật:** kênh mới whitelist ở `preload`; payload chỉ mã + số + id; main-only; không log nội dung; id lượt do renderer gửi phải được main kiểm (chuỗi, độ dài hợp lý).
- **IV — Test-first:** logic phát tiến độ của `runMapReduce`/`studio-service` (thứ tự pha, số đếm, 1-lượt vs nhiều phần, thử lại không làm lùi/nhân đôi phần, rút gọn 0..3 vòng), reducer/hook
  `useStudio` (bỏ sự kiện cũ, đặt lại khi đổi notebook, lỗi, tạo lại), hàm chọn chuỗi/mốc thông báo là hàm thuần có test trước, coverage ≥ 80%; cập nhật các test hiện có
  (`studio-map-reduce`, `studio-service`, `studio-notebook-switch`, `studio-channels-whitelist`, `studio-parts-ui`) và test khoá i18n vi↔en.

**Kế thừa, không phá vỡ:** `StudioResult`/`studio_result`/`studio:list`/`studio:export`; hợp đồng `studio:generate` (chỉ có thể thêm trường tuỳ chọn); `describeIpcError` và nút "Tạo bằng AI cục bộ"/"Thử lại" (098);
ngôn ngữ đầu ra theo ngôn ngữ giao diện lúc bấm (123); `announce`/`LiveRegion` (091); chọn 1-lượt/map-reduce theo tổng độ dài thật (105).

**Ngoài phạm vi:** đổi thuật toán/giới hạn map-reduce; giảm số lượt gọi LLM hay chia sẻ ghi chú giữa các loại Studio; stream token Studio; tiến độ % bên trong một lượt LLM; thay đổi Chat/tìm toàn văn;
dịch lại kết quả đã sinh; lưu bền trạng thái đang tạo (trừ khi clarify chốt khác).

## Ambiguities to raise in /speckit-clarify

Đã loại (đã có quyết định, xem "Đã chốt / kế thừa"): thuật toán/`parts`/`truncated` giữ nguyên; pha = đọc → rút gọn → viết, 1-lượt bất định; kênh push whitelist, không nội dung; i18n main-trả-mã;
`announce` chỉ mốc; bỏ sự kiện lượt cũ khi đổi notebook; tương thích online/local fallback; không đổi DB. Còn lại — mỗi mục kèm phương án và **đề xuất**:

1. **Độ mịn của tiến độ và nghĩa của "i".** Dữ kiện: M biết chắc đầu pha map; số vòng condense (0–3) và k mỗi vòng chỉ biết lúc bắt đầu vòng; final = 1 lượt; trong một lượt có thể im lặng tới 5 phút.
   (a) Chỉ pha map có "i/N", condense và final chỉ hiện tên pha; (b) map "i/N" + condense hiện "vòng r/3" hoặc "lô j/k"; (c) một thanh tổng ước lượng gộp mọi lượt (M + ước k + 1).
   Phụ: `i` = _phần đang đọc_ ("Phần 2/5" khi lượt thứ 2 bắt đầu) hay _số phần đã xong_ ("1/5 xong")? Thử lại lần 2 trong cùng phần có phát sự kiện không? Khi `allBatches > 12` (có `truncated`) N là 12 hay tổng lô?
   Có phát sự kiện "chuẩn bị" (gom chunk, `contextInfo()` gọi `/api/show`) trước lượt đầu không?
   **Đề xuất:** (a) — map "Phần i/N" với `i` = phần **đang** đọc (phát _trước_ mỗi lượt map), N = số lượt map thực chạy (≤ 12, khớp `parts`); condense chỉ hiện tên pha (không r/k, tránh số "nhảy"/
   không monotone); final "đang viết…"; thử lại không phát sự kiện mới (vẫn "Phần i/N"); không có pha "chuẩn bị" riêng — phát sự kiện đầu tiên ngay sau khi biết chế độ (1-lượt hay map-reduce) để thẻ
   chuyển từ "đang tạo" sang pha thật sớm nhất có thể (hoặc cân nhắc thêm pha `preparing` nếu đo thấy `contextInfo` chậm). Vì M biết sớm, thanh phần trăm chỉ tính cho pha map.
2. **Có hiển thị thời gian còn lại ước tính không?** (a) không; (b) bộ đếm thời gian đã trôi (renderer tự đếm, không qua IPC); (c) ETA từ thời gian trung bình các phần đã xong.
   Rủi ro (c): lượt đầu gồm cả nạp model, tốc độ CPU/GPU và độ dài từng lô khác nhau, online vs cục bộ chênh xa, condense/final không dự đoán được ⇒ ETA sai gây mất lòng tin; thêm chuỗi i18n dạng số/đơn vị.
   **Đề xuất:** (a) cho v1 — chỉ "Phần i/N" + tên pha (đúng với dữ kiện biết chắc); (b) để dành làm tuỳ chọn nhỏ nếu người phụ trách thấy cần; không ETA.
3. **Nút huỷ Studio có thuộc phạm vi #146 không?** Issue ghi "works with cancel/notebook switch", nhưng hiện **không có huỷ Studio** (sự kiện #7): cần `AbortController` theo id lượt ở main, kênh `studio:cancel`
   whitelist, truyền `signal` qua `deps.chat` → `provider.chat` (Ollama nhánh không-stream hiện bỏ qua `signal`; nhánh không-stream của provider online chưa xác minh), quyết định kết quả cũ của lượt
   "Tạo lại" (giữ nguyên), không `upsert` khi huỷ, thông báo a11y, test. Phương án: (a) **ngoài phạm vi** — chỉ bảo đảm thiết kế sự kiện (có id lượt) để sau này thêm huỷ, và "huỷ" trong issue hiểu là
   chuyển notebook/lỗi; (b) làm huỷ đầy đủ trong #146; (c) "huỷ mềm" ở renderer (bỏ qua kết quả, main vẫn chạy) — vẫn tốn LLM.
   **Đề xuất:** (a) + tách issue riêng cho nút huỷ (chạm nhiều tầng, cần xác minh `signal` mọi provider). Cần chủ dự án xác nhận cách hiểu câu "works with cancel" của issue.
4. **Trình bày trên thẻ.** (a) chỉ dòng chữ ("Phần 2/5…") thay/ cạnh skeleton; (b) thanh tiến độ xác định cho pha map + bất định cho pha khác, kèm dòng chữ; (c) thanh phân đoạn theo pha.
   Còn: vị trí khi _tạo lại_ (card cũ vẫn hiện — đặt dải tiến độ trên đầu card hay trong header cạnh nút "Đang tạo…"?); có đổi nhãn nút loại ("Đang tạo…" → "Phần 2/5…") không (nút hẹp, English dài hơn);
   skeleton giữ hay thay; `aria-hidden` skeleton + thanh dùng `role="progressbar"` với `aria-valuetext` (tái dùng `progressValueText`) hay chỉ văn bản; tái dùng class của banner reindex/thanh nguồn hay tạo mới;
   `prefers-reduced-motion` cho thanh bất định; test ảnh chụp ở cột Studio hẹp (262 px prototype → kéo rộng ≥ ?).
   **Đề xuất:** (b) — một dòng chữ tên pha + thanh (xác định ở map, bất định ở condense/final) đặt **trong vùng kết quả của loại đó**: thay skeleton khi chưa có kết quả; ở trên đầu card cũ khi tạo lại;
   nhãn nút giữ "Đang tạo…" (tránh tràn); thanh `role="progressbar"` có `aria-valuetext` dịch, dòng chữ **không** `role="status"` (quy ước 091); chuyển động bất định tắt theo `prefers-reduced-motion`.
5. **Tần suất thông báo trình đọc màn hình.** Hàng đợi `LiveRegion` tối đa 10 câu, mỗi câu giữ ≥ 500 ms; N ≤ 12 + vài pha. (a) chỉ đổi pha (vài câu: đang đọc N phần → rút gọn → viết); (b) đổi pha + **mỗi phần**
   (tối đa ~15 câu/lượt — có thể bị bỏ câu cũ, dồn dập khi nhiều loại cùng chạy); (c) đổi pha + mốc phần ~ 25/50/75% (dedupe, tối đa ~5–6 câu/lượt). Có thêm tiền tố tên loại ("Ý chính: …") khi nhiều loại chạy song song không?
   Mức lịch sự: `polite` cho mốc, lỗi vẫn `assertive` theo cơ chế hiện có.
   **Đề xuất:** (c) — giữ "bắt đầu/xong" hiện có; thêm câu khi vào pha mới và ở mốc ~50% pha map (hoặc theo chu kỳ ≈ N/3, dedupe); mọi câu có tên loại; tất cả `polite`; hàm thuần chọn mốc có test.
6. **Trạng thái 1-lượt (bất định) và thời điểm biết chế độ.** Với notebook nhỏ chỉ "đang viết…"; có khác nhãn nút/skeleton hiện tại không (hiện đã có "Đang tạo…")? Giữa lúc gọi `contextInfo()` và lượt đầu thì hiển thị gì
   (sự kiện chưa phát)? Hiển thị "đang viết…" cho 1-lượt có thừa so với skeleton hiện tại không (tránh thêm nhiễu cho trường hợp phổ biến, nhanh)?
   **Đề xuất:** vẫn phát sự kiện pha `writing` (không có đếm) để UI nhất quán và renderer không đoán; chuỗi vi "Đang viết…" / en "Writing…"; trước sự kiện đầu dùng trạng thái "Đang tạo…" hiện có;
   không thêm thanh phần trăm cho 1-lượt (chỉ chỉ báo bất định, tôn trọng reduced-motion).
7. **Nhiều loại chạy cùng lúc.** Hiện 4 nút độc lập và main không khoá; Ollama xếp hàng nên một loại có thể "đang ở Phần 1/5" nhưng thực ra chờ loại khác. (a) mỗi loại có tiến độ riêng (id lượt riêng), không phân biệt hàng đợi;
   (b) thêm trạng thái "đang chờ" (cần main biết hàng đợi); (c) khoá để chỉ 1 loại chạy mỗi lúc (đổi hành vi — ngoài phạm vi). Cũng: ghi nhận mỗi loại tự chạy lại bước map (tốn gấp bội) — không sửa ở #146.
   **Đề xuất:** (a) — tiến độ theo từng loại, ghi vào "Giới hạn đã biết" rằng khi chạy song song một loại có thể chờ; không đổi hành vi nút; không thêm trạng thái "chờ" ở v1. Nếu muốn giảm tốn kém: tách issue (chia sẻ ghi chú map giữa các loại).
8. **Tiến độ có sống sót khi người dùng rời notebook rồi quay lại không?** Hiện đổi notebook ⇒ state renderer xoá, main vẫn chạy và lưu; quay lại không thấy "đang tạo" và có thể bấm tạo lượt thứ hai song song (sự kiện #8).
   (a) giữ hành vi hiện tại (bỏ sự kiện cũ, không phục hồi) và ghi giới hạn đã biết; (b) main giữ sổ lượt đang chạy theo (notebook, loại) + tiến độ gần nhất, thêm kênh `studio:status(notebookId)` để renderer khôi phục khi mở lại, và
   chặn tạo trùng; (c) như (b) nhưng cũng đẩy sự kiện "xong" để tự `studio:list`.
   **Đề xuất:** (a) cho #146 — đúng ý issue ("stale events ignored"); ghi giới hạn đã biết + đề xuất issue tiếp theo (b)/(c) vì đụng thêm kênh đọc, vòng đời lượt và chặn tạo trùng.
9. **Thiết kế kênh sự kiện và định danh lượt.** (a) kênh mới `studio:progress` với payload `{generationId, notebookId, kind, phase, index?, total?}`, `generationId` do **renderer sinh** trong `StudioGenerateInput` (khuôn `streamId` 039; main kiểm chuỗi không rỗng, độ dài giới hạn;
   thiếu id ⇒ không phát hoặc main tự sinh?); (b) định danh bằng `(notebookId, kind)` — đơn giản nhưng lẫn sự kiện của lượt cũ còn chạy (đổi notebook, quay lại, bấm lại) và của lượt trước khi thử lại; (c) tái dùng kênh có sẵn (`source:progress`) — không phù hợp (kiểu `SourceProgressEvent`
   gắn nguồn/nạp). Có cần sự kiện kết thúc (`done`/`failed`) hay đủ nhờ giá trị trả về/ném của `studio:generate`? `phase` là enum mã (`reading|condensing|writing`) — cần thêm giá trị `preparing`? Tên API preload (`onStudioProgress`).
   **Đề xuất:** (a) — `generationId` do renderer sinh (bỏ sự kiện không khớp id đang chạy của loại đó), thiếu id ⇒ main không phát (tương thích ngược); enum `reading|condensing|writing` (+ `preparing` chỉ nếu đo cần); không cần sự kiện `done` (kết quả/lỗi đã về qua `invoke`); preload `onStudioProgress(cb)` trả hàm huỷ;
   thêm vào `CHANNELS`, test whitelist/duy nhất tên; không đưa kênh này vào `ChannelResponse` (như các kênh push khác).
10. **Làm mượt/giới hạn tần suất sự kiện.** Số sự kiện mỗi lượt bị chặn (≤ 12 map + ≤ 3 vòng + vài sự kiện pha) và mỗi sự kiện cách nhau ≥ vài giây (mỗi lượt LLM), nên IPC không cần throttle. Còn: renderer gộp cập nhật state (tránh render thừa khi nhiều loại cùng phát); thứ tự đến (IPC giữ thứ tự nhưng lượt cũ có thể xen kẽ) —
    dựa `generationId`; có cần chống sự kiện _lùi_ (index nhỏ hơn đã nhận) không?
    **Đề xuất:** không throttle ở main; renderer áp dụng "chỉ nhận sự kiện của `generationId` đang chạy, bỏ sự kiện lùi (index nhỏ hơn đã thấy trong cùng pha)"; ghi chú trong plan rằng tần suất thấp nên không cần debounce.
11. **Chuỗi i18n và thuật ngữ.** Tên khoá (`studio.progress.reading|condensing|writing`, `a11y.studioProgress*`), dùng `{i}`/`{n}` hay plural; từ vựng nhất quán với `studio.parts` ("phần" / "part") và glossary (map-reduce, ghi chú/notes); câu English ("Part 2 of 5…" vs "Reading part 2/5…");
    có hiển thị tên loại trong thông báo a11y không (xem #5). Duyệt bản English theo quy ước 123.
    **Đề xuất:** vi "Đang đọc phần {i}/{n}…", "Đang rút gọn ghi chú…", "Đang viết…"; en "Reading part {i} of {n}…", "Condensing notes…", "Writing…"; khoá phẳng dưới `studio.progress.*` và `a11y.studioProgress*`; không plural (i/n là số riêng lẻ).

## Thuật ngữ mới (append vào glossary)

Chưa có trong `docs/00-glossary.md` (đã tra: có `map-reduce (runMapReduce, parts)` 105, `announce` 091, `local retry` 098, `StudioResult`…; chưa có thuật ngữ tiến độ Studio). Đề xuất append (không sửa term cũ; cột 日本語 để `—`):

| 日本語 | Tiếng Việt (đề xuất)                           | English (đề xuất, dùng trong code)                                       | Ghi chú                                                                            |
| ------ | ---------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| —      | Sự kiện tiến độ tạo Studio (main → renderer)   | Studio progress event (`StudioProgressEvent`)                            | Kênh push mới; chỉ mã pha + số đếm + id lượt; KHÔNG nội dung — 146                 |
| —      | Pha tạo Studio (đọc các phần / rút gọn / viết) | progress phase (`StudioProgressPhase`: `reading`/`condensing`/`writing`) | Ánh xạ map / condense / final của `runMapReduce`; 1-lượt chỉ có `writing` — 146    |
| —      | Định danh lượt tạo Studio (do renderer sinh)   | generation id (`generationId`)                                           | Tương quan sự kiện với đúng lượt/loại, bỏ sự kiện cũ; khuôn `streamId` (039) — 146 |
| —      | Tiến độ bất định (không biết tổng)             | indeterminate progress                                                   | Dùng cho 1-lượt, rút gọn, viết cuối; có tôn trọng `prefers-reduced-motion` — 146   |

Ghi chú: người phụ trách có thể gộp bớt dòng khi append trong branch feature (rule 5 `CLAUDE.md`: THÊM term được làm ngay trong branch). Không sửa/đổi tên term đã có (đặc biệt dòng `map-reduce` 105 và `announce` 091); nếu muốn bổ sung ngữ nghĩa cho chúng
(vd "UI Tổng hợp từ N phần" nay có thêm tiến độ) — đó là SỬA term cũ ⇒ PR riêng được steward duyệt.

## Đối chiếu constitution

- **I (Local-first):** đạt — không egress mới; sự kiện tiến độ chỉ đi main→renderer nội bộ; mỗi lượt LLM vẫn qua `pickProvider(target)` nên privacy badge (103) giữ đúng khi dùng AI online. Điểm cần canh: không để chuỗi tiến độ ngụ ý "chạy cục bộ" khi đang dùng online.
- **II (Kiểm chứng được):** không đổi `[n]`, hậu kiểm theo đầu vào từng bước, `citations`, `truncated`, `parts`. Tiến độ chỉ quan sát. N phải khớp `parts` để không hiển thị sai số phần đã tổng hợp.
- **III (Biên bảo mật):** kênh push mới whitelist ở `preload` + `CHANNELS`; payload chỉ mã/số/id (không nội dung, không tiêu đề nguồn); `generationId` từ renderer phải được main kiểm; log không chứa nội dung; không thêm đường FS/mạng cho renderer.
- **IV (Test-first):** hàm thuần/logic phát sự kiện, reducer `useStudio`, chọn mốc thông báo có test trước, coverage ≥ 80%; adapter `webContents.send` (wiring `index.ts`) loại khỏi coverage như quy ước; cập nhật test Studio hiện có và test khoá i18n.
- **V (Phased Delivery):** không vi phạm (hoàn thiện Studio, Pha 1).
- **Additional constraints:** i18n 123 (khoá vi + en, không chuỗi cứng); source-of-truth (prototype không có UI tiến độ — ghi nhận là UI mới, không sửa prototype); không thêm dependency; không migration; ADR: ghi quyết định clarify vào `docs/04-decisions/` (+ append `INDEX.md`),
  nêu rằng nó **bổ sung** dòng "Chưa có tiến độ i/N" của 105 (không sửa file cũ).

## Suggested constitution amendments

Không đề xuất sửa trực tiếp (mọi sửa đổi constitution phải qua PR riêng được steward duyệt, rule 5). Có thể cân nhắc về sau, không bắt buộc ở 146: một dòng ở "Additional Constraints" rằng "mọi tác vụ AI có thể kéo dài quá vài giây MUST có chỉ báo trạng thái/tiến độ ở mức mốc
(không chứa nội dung tài liệu) và thông báo tương ứng cho công nghệ hỗ trợ" — để các tác vụ dài về sau (xử lý lại nguồn, reindex, Studio, tóm tắt hàng loạt) theo cùng một khuôn thay vì mỗi feature tự bổ sung muộn (như 105 → 146).
