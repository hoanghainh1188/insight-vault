# Intake — 178-studio-enhance-2

- Issue: #178 (repo `hoanghainh1188/insight-vault`) — "Studio đợt 2: lịch sử phiên bản · 4 loại mới · yêu cầu tuỳ chỉnh · nhiều nguồn + stream"
- Slug: `studio-enhance-2`
- Ngày intake: 2026-10-10
- Loại: mở rộng tính năng Studio (đợt 2), **1 spec, giao bằng 4 PR theo thứ tự**: (1) lịch sử phiên bản → (2) 4 loại mới → (3) yêu cầu tuỳ chỉnh
  (`custom`) → (4) nhiều nguồn + stream. Kế hoạch đã được chủ dự án duyệt (2026-10-10). KHÔNG có Figma, KHÔNG có basic/detail design của khách hàng
  (`docs/01-basic-design/`, `docs/02-detail-design/` chỉ có README). Chạm mọi tầng: DB (migration v11), main (`studio-service`, `map-reduce`,
  `studio-repo`, `prompt`, `register.ts`), shared (kiểu, kênh IPC, i18n, mã lỗi), preload, renderer (`useStudio`, `StudioColumn`, `StudioResultCard`).
  **Không đổi** thuật toán map-reduce (105), cách đánh số/hậu kiểm `[n]`, tiến độ (146), huỷ (149).

## Input sources

- **Brief của chủ dự án (qua agent điều phối)** — phạm vi 4 PR như trên; ghi chú "bẫy" của PR 4 (stream giữ phần đã nhận khi abort, KHÔNG ném ⇒ phải
  `assertNotAborted` sau stream). Phiên intake không đọc được thân issue #178 thật (không có Bash) — **người phụ trách đối chiếu issue trước `/speckit-specify`**.
- `docs/OVERVIEW.md` — 3 điểm bất biến (Local-first, Kiểm chứng được, Offline & tự chủ). Đã tra từ khoá lịch sử/phiên bản/nhiều nguồn/tuỳ chỉnh/stream: không có yêu cầu riêng.
- `docs/03-ui/prototype.html` (cột Studio, dòng 421–435; cột rộng 262 px, dòng 117) — chỉ có nhãn "Tạo nhanh" + **4 nút `tool` xếp 1 cột** ("Tóm tắt tự động", "Ý chính",
  "Câu hỏi thường gặp", "Dàn ý") + 1 thẻ mẫu. **Không có** lịch sử phiên bản, nút loại mới, ô yêu cầu tuỳ chỉnh, chọn nhiều nguồn, hiển thị stream ⇒ toàn bộ UI của
  feature này là **UI mới không có nguồn thiết kế gốc**. Không sửa prototype.
- `docs/00-glossary.md` — đã tra: `Studio`, `StudioKind` (union 4 giá trị, 021), `StudioResult` (UNIQUE(notebook_id,kind), 021), `source scope (sourceId)` (025),
  `map-reduce` (105), `StudioProgressEvent`/`StudioProgressPhase`/`generationId` (146), `Studio cancel`/`generation registry`/`studioCancelled`/`StudioGenerateOutcome` (149),
  `local retry` (098), `output language` (123). **Chưa có** thuật ngữ cho các mục ở phần "Thuật ngữ mới".
- `docs/04-decisions/INDEX.md` + ADR đã đọc (kế thừa, KHÔNG hỏi lại — xem "Đã chốt / kế thừa"): `2026-07-11-studio-clarify.md` (021), `2026-07-11-studio-context-strategy.md`,
  `2026-07-15-studio-balanced-context.md` (065), `2026-10-07-studio-large-clarify.md` (105), `2026-10-08-studio-progress{,-clarify}.md` (146), `2026-10-09-studio-cancel{,-clarify}.md` (149),
  `2026-07-11-studio-mapreduce-citation.md` (bản mức NGUỒN, đã bác bởi 105), `2026-10-07-online-fallback-clarify.md` (098), `2026-10-08-i18n*.md` (123).
- Code đã đọc (chỉ để mô tả điểm tích hợp, KHÔNG phải thiết kế mới): `src/main/services/studio/{studio-service,map-reduce,studio-repo,prompt,constants}.ts`,
  `src/main/services/ai-runtime/{abort,provider,ollama-client}.ts`, `src/main/services/rag/rag-service.ts` (`askStream`), `src/main/ipc/register.ts` (≈ 322–360 stream Chat; 378–454 Studio),
  `src/main/db/migrations.ts` (v3 tạo `studio_result`; **v10 là migration mới nhất**), `src/shared/ipc/{types,channels}.ts`, `src/shared/codes/user-error.ts`,
  `src/shared/i18n/domains/studio.ts`, `src/renderer/features/studio/{StudioColumn.tsx,useStudio.ts,StudioResultCard.tsx,studio.css}`, `src/renderer/features/rag-qa/useChat.ts`.
- Figma: không dùng. Design token: không đổi (tái dùng class `studio-btn`, `btn-outline-sm`, `studio-cardbtn`…).
- **Không đọc/xác minh trong phiên này:** thân issue #178; `online/*-provider.ts` (chỉ biết cả 3 có tham chiếu `onToken` — chưa xác minh hành vi abort của stream online, nhất là việc "giữ phần
  đã nhận, không ném"); `studio.css` đầy đủ; `preload/index.ts`; `balanced-context.ts`; `tests/**`; `logging.ts` (ràng buộc trường `logEvent`); cách `useChat` render text stream thô
  (chỉ thấy cờ `streaming` ở dòng 36, 232–261).

## Sự kiện cần ghi nhận (từ code hiện tại, để spec không phải đoán)

Nhóm A — dữ liệu (PR 1)

1. **`studio_result` hiện UNIQUE(notebook_id, kind)** (migration v3, dòng 93–111) với `CHECK (kind IN ('summary','keyPoints','faq','outline'))`; chỉ có cột `id, notebook_id, kind, content,
citations_json, created_at, updated_at`; index `idx_studio_notebook`. FK `notebook_id ... ON DELETE CASCADE`. `StudioResult.parts`/`truncated` **không lưu DB** (chỉ có ở kết quả vừa tạo).
2. **`studioRepo.upsert`** dùng `ON CONFLICT (notebook_id, kind) DO UPDATE` (giữ `id`/`created_at` cũ); `listByNotebook` trả ≤ 4 dòng (mỗi loại ≤ 1) `ORDER BY created_at ASC`;
   `getByNotebookKind` `LIMIT 1`. ⇒ Bỏ UNIQUE đòi sửa cả ba hàm; SQLite không `ALTER` được CHECK/UNIQUE ⇒ **rebuild bảng** (tạo bảng mới → chép → drop → đổi tên → tạo lại index) trong migration v11.
3. **Migration chạy trong `BEGIN … COMMIT` từng bản** (`runMigrations`); lỗi ⇒ `ROLLBACK`; DB mới hơn app ⇒ `SchemaVersionError`. Bảng có FK ⇒ cần cân nhắc `PRAGMA foreign_keys` khi drop/rename (chưa xác minh cách các migration trước xử lý — kiểm ở plan).
4. **`useStudio`** giữ `results: Partial<Record<StudioKind, StudioResult>>` — **1 kết quả/loại**; `studio:list` nạp vào map đó. Card `StudioResultCard` đã có Copy / Export / Tạo lại; `regenerating` đổi nhãn "Đang tạo…".

Nhóm B — loại (PR 2, 3)

5. **`StudioKind` hiện = `"summary" | "keyPoints" | "faq" | "outline"`**, lặp ở: `types.ts`, `STUDIO_KINDS` (`constants.ts`), `KINDS` (`StudioColumn.tsx`), `task()` trong `prompt.ts` (`Record<StudioKind,string>`),
   khoá `studio.kind.*` (vi + en), `isStudioKind` ở service, CHECK ở DB. `systemPromptFor` ném nếu `task()` không có loại.
6. **Khung system prompt (`common()`)** ép: chỉ dùng đoạn đánh số, **mỗi câu phải kết thúc bằng `[n]`**, không bịa, phủ cân bằng mọi nguồn, ngôn ngữ đầu ra theo giao diện. `task()` chỉ thêm 1 dòng "Task: …".
   Ở map-reduce, bước cuối ghép `systemPromptFor(kind)` + `FROM_NOTES`. Hậu kiểm: `postprocessCitations` gỡ `[n]` ngoài đầu vào; không `[n]` hợp lệ ⇒ `citationsFromMap`; rỗng ⇒ `studioEmptyOutput`.
7. **Ranh giới tin cậy:** hiện `kind` là enum cố định ⇒ prompt do code kiểm soát hoàn toàn. Loại `custom` đưa **văn bản tự do của người dùng** vào đường LLM — bề mặt prompt-injection/DoS mới (xem PR 3 ở dưới).
8. **Cột Studio 262 px** (prototype) / kéo rộng được (025). `.studio-actions` hiện `display:grid; grid-template-columns:1fr 1fr` (4 nút = lưới 2×2). Thêm 4 loại + `custom` ⇒ 8–9 nút. Nhãn English dài hơn (123).

Nhóm C — nguồn & stream (PR 4)

9. **`StudioGenerateInput.sourceId?: string`** (025): service lọc `src.id !== sourceId` trong danh sách nguồn của notebook, **chỉ nguồn `ready`**; không khớp ⇒ `totalChunks===0` ⇒ `UserFacingError("studioSourceNotReady")`
   (có `sourceId`) hoặc `"studioNoReadySources"`. UI chọn nguồn là `<select>` đơn (`studio-scope`), chỉ hiện khi `readySources.length > 1`. `sourceId` từ renderer **chưa được kiểm "thuộc notebook"
   một cách tường minh** — việc lọc trong danh sách nguồn của notebook đã vô hiệu hoá id lạ gián tiếp (cần giữ tính chất này với mảng).
10. **Studio hiện KHÔNG stream:** `deps.chat(messages, {numCtx, signal})` → content trọn vẹn. Chat có tiền lệ: `rag:askStream` + `streamControllers` + kênh push `rag:streamToken` `{streamId, delta}` **gửi MỌI cửa sổ**
    (`emitToken` dùng `BrowserWindow.getAllWindows()`); renderer hiện text thô (cờ `streaming`) rồi **thay bằng kết quả cuối** đã hậu kiểm `[n]`. **Khác biệt bảo mật cần giữ cho Studio:** 146/149 gửi sự kiện về
    **cửa sổ đã gọi** (`sender.send`), không broadcast — brief PR 4 yêu cầu `studio:streamToken` chỉ về cửa sổ gọi.
11. **Khi abort, nhánh stream của Ollama (và theo `provider.ts`: "stream giữ phần đã nhận") trả phần đã nhận, KHÔNG ném**; nhánh không-stream (149) ném `ChatAbortedError`. `rag-service.askStream` chủ động giữ phần dở (Chat).
    ⇒ Với Studio, `studio-service.run` phải `assertNotAborted(signal)` **sau** lượt stream (trước hậu kiểm/upsert) — hiện đã có ở trước `upsert` (dòng 160) nhưng đường stream sẽ làm `raw` là phần dở nên phải kiểm sớm hơn để không hậu kiểm/ghi nhầm.
12. **Vị trí lượt "viết cuối":** đường 1-lượt (`studio-service.ts` ≈ 130–138) và lượt `chat` cuối trong `runMapReduce` (≈ 292–301). Các lượt map/condense là ghi chú trung gian ⇒ KHÔNG stream (brief). Hậu kiểm `[n]` chỉ chạy sau khi có trọn `raw`.
13. **Sổ lượt (149):** `createGenerationRegistry` khoá `(notebookId, kind)` — lượt mới cùng cặp **thay** lượt cũ (supersede). Khi có lịch sử + `custom` (nhiều yêu cầu tuỳ chỉnh khác nhau cùng `kind="custom"`) + nhiều nguồn, khoá `(notebookId, kind)` có thể quá thô (xem ambiguity G1).

## Đã chốt / kế thừa — KHÔNG hỏi lại ở clarify

1. **Thuật toán tổng hợp giữ nguyên (105):** 1-lượt khi vừa ngân sách, ngược lại map-reduce; `[n]` toàn cục; mỗi bước chỉ nhận `[n]` trong đầu vào của nó; `MAX_MAP_CALLS = 12`, `MAX_CONDENSE_ROUNDS = 3`, thử lại 1 lần, `parts`/`truncated`.
   Loại mới/`custom`/nhiều nguồn **tái dùng** đường này (brief PR 3: "reuse map-reduce/progress/cancel").
2. **Context cân bằng theo nguồn (065):** chia đều ngân sách cho mọi nguồn được chọn (`buildBalancedContext`) — với nhiều nguồn chọn tay vẫn áp dụng.
3. **Citation (021 #3, 105):** mọi kết quả Studio (kể cả loại mới, `custom`) có chip `[n]` hậu kiểm; không `[n]` hợp lệ ⇒ gắn nguồn đã dùng; rỗng ⇒ lỗi, không lưu bản rỗng. **Constitution II không nhượng bộ cho `custom`.**
4. **Tiến độ (146):** `generationId` do renderer sinh; sự kiện chỉ chứa mã pha + số đếm + id, gửi về cửa sổ gọi; pha `reading i/N → condensing → writing`. Stream (PR 4) **bổ sung** chứ không thay tiến độ.
5. **Huỷ (149):** `studio:cancel(generationId)` idempotent; không lưu dở dang; huỷ ≠ lỗi; tự huỷ khi rời notebook; lượt mới cùng khoá thay lượt cũ; log `studio.cancelled` chỉ `{kind, phase, reason}`. Stream **phải** tuân: huỷ ⇒ không lưu (xem Nhóm C #11).
6. **Online + dự phòng cục bộ (098):** mọi lượt qua `pickProvider(target)`; `localKinds` đánh dấu kết quả tạo bằng AI cục bộ; không thêm egress; privacy badge (103) đúng.
7. **i18n (123):** main trả mã/tham số, renderer dịch bằng khoá có kiểu (vi nguồn `as const`, en `Widen`); Studio tạo theo ngôn ngữ giao diện lúc bấm; chuỗi a11y dịch bằng translator HIỆN TẠI lúc `announce`. Không chuỗi cứng.
8. **a11y (091):** `announce` cho MỐC; không `role="status"` cho dòng đổi liên tục (⇒ text stream **không** được đặt vào vùng live theo từng token).
9. **Bảo mật (Constitution III):** kênh mới whitelist ở `preload` + `CHANNELS` (test `studio-channels-whitelist` cập nhật, tên duy nhất); mọi truy cập DB/FS/mạng ở main; main kiểm mọi id do renderer gửi; log không chứa nội dung/prompt/id nhạy cảm.
10. **Xuất `.md` (025) và Copy/Export trên card** giữ nguyên, áp cho mọi loại và mọi phiên bản.
11. **Ngoài phạm vi (theo brief + ADR trước):** chia sẻ ghi chú map giữa các loại; đổi giới hạn map-reduce; "Huỷ tất cả"; ETA; đồng bộ/cloud; so sánh (diff) hai phiên bản (không có trong brief — xem G3 nếu muốn).

## Prompt for /speckit-specify

Mở rộng **Studio** của InsightVault (cột thứ 3 của Workspace, tạo bản tổng hợp từ nguồn của notebook bằng AI cục bộ hoặc online, mỗi kết quả có chip trích dẫn `[n]` kiểm chứng được) thành **bốn nâng cấp liên kết, giao bằng 4 PR theo đúng thứ tự dưới đây**, trong cùng một spec. Hiện nay Studio chỉ có 4 loại cố định (`summary` Tóm tắt tài liệu, `keyPoints` Ý chính, `faq` FAQ, `outline` Dàn ý), mỗi loại chỉ giữ **một** bản mới nhất mỗi notebook (bảng SQLite `studio_result` có UNIQUE(notebook_id, kind), "Tạo lại" ghi đè), chỉ cho lọc theo **một** nguồn hoặc tất cả (`sourceId`), và chờ trọn kết quả rồi mới hiện (không stream). KHÔNG đổi thuật toán tổng hợp 1-lượt/map-reduce (`src/main/services/studio/map-reduce.ts`: `MAX_MAP_CALLS`, rút gọn ghi chú, thử lại 1 lần, `parts`, `truncated`), KHÔNG đổi cách đánh số và hậu kiểm trích dẫn `[n]` (mọi kết quả — kể cả loại mới và yêu cầu tuỳ chỉnh — vẫn phải có `[n]` trỏ đúng đoạn nguồn, không bịa, không lưu bản rỗng), KHÔNG đổi tiến độ (#146: pha đọc phần i/N → rút gọn → viết, sự kiện chỉ mang mã/số/`generationId` và chỉ gửi về cửa sổ đã gọi) và KHÔNG đổi huỷ (#149: `studio:cancel` theo `generationId`, huỷ không lưu kết quả dở dang và không hiện như lỗi, rời notebook thì tự huỷ, lượt mới cùng (notebook, loại) thay lượt cũ). Mọi chuỗi giao diện qua khung i18n (#123) bằng khoá có kiểu cả tiếng Việt và English, main chỉ trả mã/tham số; Studio vẫn tạo nội dung theo ngôn ngữ giao diện lúc bấm; chuyển động tôn trọng `prefers-reduced-motion`; thông báo trình trình đọc màn hình chỉ ở các mốc (#091), không đọc từng token. Prototype (`docs/03-ui/prototype.html`) chỉ có 4 nút trong cột 262 px nên toàn bộ UI mới dưới đây là thiết kế mới không có nguồn gốc, phải vừa cột hẹp và không tràn với chuỗi English dài hơn.

**PR 1 — Lịch sử phiên bản.** Mỗi lần tạo (kể cả "Tạo lại") sinh thêm **một phiên bản mới** thay vì ghi đè; người dùng xem lại và chọn các phiên bản cũ của cùng một loại ngay trên thẻ kết quả (bộ chọn phiên bản), xoá được từng phiên bản, và hệ thống áp trần số phiên bản lưu mỗi loại (số cụ thể và việc tự xoá bản cũ nhất chốt ở clarify). Về dữ liệu: migration **v11** (v10 là mới nhất) dựng lại bảng `studio_result` — bỏ ràng buộc UNIQUE(notebook_id, kind), mở rộng CHECK cho toàn bộ loại mới và `custom`, thêm cột `custom_prompt` và `source_ids_json` (nguồn đã dùng) — phải giữ nguyên dữ liệu và `id`/`created_at` của các dòng hiện có, an toàn khi lỗi (chạy trong giao dịch của `runMigrations`), giữ khoá ngoại ON DELETE CASCADE và index. Repo chuyển từ upsert sang insert, thêm liệt kê phiên bản theo (notebook, loại), xoá một phiên bản và dọn theo trần. Phiên bản mới nhất là bản hiển thị mặc định; Copy/Export/trích dẫn `[n]` hoạt động trên phiên bản đang xem; huỷ lượt "Tạo lại" giữ nguyên toàn bộ phiên bản cũ; xoá notebook xoá mọi phiên bản.

**PR 2 — Bốn loại mới.** Thêm **Hướng dẫn học** (study guide), **Bản tóm lược** (briefing), **Dòng thời gian** (timeline) và **Bảng thuật ngữ** (glossary) — định nghĩa và tên hiển thị chính xác chốt ở clarify — vào `StudioKind`, `STUDIO_KINDS`, danh sách nút trong `StudioColumn.tsx`, hàm `task()` của `prompt.ts` (mỗi loại một chỉ dẫn "Task: …" nhưng vẫn dùng chung khung ép `[n]` và không bịa), khoá `studio.kind.*` vi + en, và CHECK của DB (đã mở ở PR 1). Bố cục các nút phải vừa cột Studio 262 px với từ 8 nút trở lên (phương án "menu Thêm" hay lưới 2 cột chốt ở clarify), có thứ tự Tab hợp lý và nhãn đọc được bằng trình đọc màn hình. Mỗi loại mới chạy được qua đường 1-lượt/map-reduce, tiến độ, huỷ và lịch sử như 4 loại cũ.

**PR 3 — Yêu cầu tuỳ chỉnh (`custom`).** Thêm loại `custom`: người dùng nhập một yêu cầu bằng văn bản tự do (ví dụ "liệt kê các rủi ro pháp lý") và Studio tạo kết quả có `[n]` theo yêu cầu đó, lưu cùng `custom_prompt` trong lịch sử. **Main phải kiểm tra đầu vào**: cắt khoảng trắng đầu/cuối, từ chối chuỗi rỗng, giới hạn độ dài tối đa (số cụ thể và việc lưu mẫu yêu cầu chốt ở clarify), trả mã lỗi i18n có kiểu khi vi phạm. Văn bản người dùng chỉ được đặt trong **tin nhắn user**; system prompt giữ nguyên quy tắc trích dẫn `[n]`, không bịa, ngôn ngữ đầu ra, và không bao giờ nối văn bản người dùng vào system prompt — để yêu cầu như "bỏ qua quy tắc trên" không phá được ràng buộc kiểm chứng. Hậu kiểm `[n]` vẫn chạy như mọi loại; log không chứa văn bản yêu cầu; tái dùng map-reduce, tiến độ và huỷ. **Đây là PR bắt buộc qua security-reviewer** (input tự do đi vào đường LLM, lưu DB, hiển thị lại).

**PR 4 — Nhiều nguồn + stream.** (a) Thay lọc một nguồn bằng chọn **nhiều nguồn**: input mang `sourceIds[]` (vẫn nhận `sourceId` cũ để tương thích ngược); main kiểm từng id **thuộc notebook** và **đang ở trạng thái `ready`**, id sai/lạ/không ready ⇒ lỗi rõ ràng (không bỏ qua âm thầm), mảng rỗng = tất cả nguồn ready, giới hạn số phần tử hợp lý; danh sách nguồn đã dùng được lưu vào `source_ids_json` của phiên bản. (b) **Stream chỉ lượt viết cuối**: đường 1-lượt trong `studio-service.ts` và lượt "viết" cuối của `runMapReduce`; các lượt map/condense không stream. Token đẩy qua kênh push mới `studio:streamToken` (whitelist ở `preload` + `CHANNELS`, mang `generationId` + `delta`, **không** chứa nội dung nào khác) và **chỉ gửi về cửa sổ đã gọi** (không broadcast như `rag:streamToken` của Chat). Lưu ý bẫy kỹ thuật đã biết: khi abort, nhánh stream giữ phần đã nhận và **không ném lỗi**, nên sau lượt stream phải `assertNotAborted(signal)` — nếu không, lượt đã huỷ sẽ bị hậu kiểm và lưu như thành công, vi phạm quy tắc của #149 (huỷ ⇒ không lưu). Cách hiển thị khi đang stream (văn bản thô rồi thay bằng bản đã hậu kiểm `[n]` như Chat hay cách khác) chốt ở clarify; văn bản stream không được đặt vào vùng `aria-live` theo từng token; chip `[n]` chỉ xuất hiện sau hậu kiểm. **Đây là PR bắt buộc qua security-reviewer** (kênh IPC mới, kiểm id từ renderer, phạm vi nhận token).

**Tiêu chí chấp nhận tổng:** migration v11 không mất dữ liệu cũ và chạy lại an toàn; nhiều phiên bản/loại, chọn/xoá được và có trần; 8 nút loại + `custom` vừa cột 262 px ở cả vi và en; `custom` chống được yêu cầu độc hại ở mức prompt/ràng buộc (system prompt không đổi, `[n]` vẫn hậu kiểm); nhiều nguồn kiểm đủ quyền sở hữu + trạng thái; stream đúng cửa sổ, huỷ giữa chừng không để lại bản nào; mọi loại/đường đi vẫn qua tiến độ, huỷ, dự phòng cục bộ (098) và privacy badge đúng; test-first (Constitution IV), coverage ≥ 80% logic nghiệp vụ, cập nhật `studio-channels-whitelist`, `studio-service`, `studio-map-reduce`, `useStudio`, test khoá i18n vi↔en, test migration v11 (dữ liệu cũ → giữ nguyên).

**Ngoài phạm vi:** so sánh/diff giữa phiên bản, chia sẻ ghi chú map giữa các loại, đổi giới hạn map-reduce, "Huỷ tất cả", ETA, đồng bộ đám mây, stream cho các lượt map/condense, sửa nội dung kết quả thủ công.

## Ambiguities to raise in /speckit-clarify

Đã loại (đã có quyết định ở mục "Đã chốt / kế thừa"): thuật toán map-reduce/`[n]` giữ nguyên; tiến độ; huỷ; online/local fallback; i18n; a11y theo mốc; whitelist kênh. Còn lại — 5 câu BẮT BUỘC (a–e) rồi các mâu thuẫn/mơ hồ phát hiện thêm (đánh dấu **[PHÁT HIỆN THÊM]**).

### 5 câu clarify bắt buộc

**(a) Giữ bao nhiêu phiên bản mỗi loại; tự xoá bản cũ nhất?** Dữ kiện: hiện 1 bản/loại, ghi đè. Phương án: trần cố định (vd 5 / 10 / 20) tự xoá bản cũ nhất khi vượt; trần có thể chỉnh trong Cài đặt; không trần. Phụ: trần tính theo `(notebook, kind)` hay riêng từng `custom_prompt` (với `custom`, mỗi yêu cầu khác nhau có cùng một "kind"); bản đang xem có bị dọn không; có cảnh báo trước khi tự xoá không; có "ghim/giữ" một phiên bản không; dung lượng DB (mỗi bản ≤ vài chục KB văn bản + citations).
**Đề xuất:** trần cố định 10 phiên bản mỗi `(notebook, kind)` (với `custom`: mỗi `custom_prompt` chuẩn hoá tính riêng — xem G1), tự xoá bản **cũ nhất** khi chèn bản mới, không cảnh báo (dọn im lặng nhưng ghi vào ADR), không ghim ở v1; hằng số một chỗ (`constants.ts`).

**(b) Tên chính xác + định nghĩa của 4 loại mới.** Chưa có định nghĩa nào (không có trong tài liệu gốc). Cần chốt cho mỗi loại: tên hiển thị vi/en, định dạng đầu ra, độ dài, cách giữ `[n]`. Đề xuất ban đầu để thảo luận:

- `studyGuide` — **Hướng dẫn học** / "Study guide": khái niệm chính, câu hỏi ôn tập, từ khoá; mỗi mục có `[n]`.
- `briefing` — **Bản tóm lược** / "Briefing": 1 trang gồm bối cảnh, phát hiện chính, hệ quả/khuyến nghị (chỉ khi nguồn nêu), phong cách ra quyết định. **Cần phân biệt rõ với `summary` "Tóm tắt tài liệu"** — nhãn vi gần nghĩa (Tóm lược vs Tóm tắt) dễ gây nhầm cho người dùng.
- `timeline` — **Dòng thời gian** / "Timeline": sự kiện theo thứ tự thời gian, mỗi dòng "mốc thời gian — sự kiện [n]"; cách xử lý nguồn không có ngày (bỏ? gom "không rõ thời điểm"?), tuyệt đối không suy diễn ngày.
- `glossary` — **Bảng thuật ngữ** / "Glossary": thuật ngữ — định nghĩa [n]; chỉ thuật ngữ **có định nghĩa trong nguồn**, không bổ sung kiến thức ngoài. **Trùng tên với khái niệm "glossary" của dự án** (`docs/00-glossary.md`) — cần chọn khoá/định danh code tránh va chạm (`studyGuide|briefing|timeline|glossary` hay `termTable`…).
  Phụ: định danh code (camelCase giống `keyPoints`); thứ tự hiển thị; sắp xếp trong `STUDIO_KINDS`; ngôn ngữ nhãn tiếng Việt "Dòng thời gian" có đủ ngắn cho nút 262 px không.

**(c) Giới hạn độ dài yêu cầu tuỳ chỉnh; có lưu mẫu (preset) không?** Dữ kiện: hiện không có input văn bản tự do nào đi vào Studio. Cần chốt: độ dài tối đa (ký tự hay token?; đề xuất 500–1000 ký tự — đủ cho một yêu cầu, không đủ để nhồi prompt dài), có cho xuống dòng không, chuẩn hoá khoảng trắng, từ chối chuỗi chỉ ký tự điều khiển; ô nhập ở đâu trong cột 262 px (textarea trong card hay hộp thoại), có đếm ký tự không; **có lưu preset không** (lưu bền ở SQLite? chỉ trong phiên? lưu theo notebook hay toàn app?) — nếu lưu bền là bảng/migration thêm và bề mặt dữ liệu mới.
**Đề xuất:** tối đa 500 ký tự sau trim, cho phép xuống dòng, không lưu preset ở v1 (chỉ lịch sử phiên bản đã có `custom_prompt` — người dùng chọn lại từ lịch sử/"Tạo lại" dùng cùng prompt); preset để issue sau.

**(d) Bố cục nút: menu "Thêm" hay lưới 2 cột?** Dữ kiện: hiện `.studio-actions` đã là lưới 2×2 (không phải 1 cột như prototype); 8 loại + `custom` = 9 điểm vào. Phương án: (i) giữ lưới 2 cột, 9 nút ⇒ 5 hàng, cuộn trong cột — nhanh nhưng chiếm chiều cao, đẩy kết quả xuống; (ii) 4 nút chính + nút "Thêm ▾" (menu) chứa 4 loại mới + "Yêu cầu tuỳ chỉnh…" — gọn nhưng thêm 1 lần bấm, cần menu bàn phím/ARIA đúng (roving focus, Esc, đóng khi click ngoài); (iii) bộ chọn loại + 1 nút "Tạo". Phụ: trạng thái "Đang tạo…" của nút bên trong menu; thứ tự Tab; `prefers-reduced-motion`; kiểm ảnh chụp 262 px / 900 px / English; Constitution UI là thiết kế mới (không prototype).
**Đề xuất:** (i) lưới 2 cột cho 8 loại cố định + hàng riêng "Yêu cầu tuỳ chỉnh" (ô nhập + nút) — không thêm menu để tránh nợ a11y; nếu đo thấy quá cao thì (ii) ở lần sau.

**(e) Khi stream, hiện văn bản thô rồi thay bằng bản đã hậu kiểm `[n]` như Chat?** Dữ kiện: Chat hiện text thô trong bong bóng `streaming`, chip chỉ xuất hiện sau hậu kiểm (sự kiện #10). Phương án: (i) như Chat — text thô (có thể chứa `[n]` chưa kiểm/bịa, hiển thị dạng chữ thường) rồi thay bằng markdown + chip khi xong, có thể nhảy layout/chữ đổi; (ii) chỉ hiện chỉ báo "đang viết…" không hiện chữ (bỏ lợi ích stream); (iii) text thô nhưng **ẩn/che `[n]`** trong lúc stream để không hiển thị trích dẫn chưa kiểm chứng. Phụ: card cũ (Tạo lại) vẫn hiện trong lúc stream hay thay; stream có áp cho map-reduce (bản cuối sau nhiều lượt) — cùng cách hiển thị; cuộn tự động; huỷ giữa stream ⇒ biến mất hoàn toàn (không để phần dở — khác Chat vốn giữ phần đã nhận); `aria-live` không đọc token (đã chốt).
**Đề xuất:** (iii) — hiện chữ thô nhưng gỡ/che `[n]` trong lúc stream (Constitution II: không hiển thị trích dẫn chưa kiểm chứng như thể đã kiểm), thay bằng bản hậu kiểm khi xong; huỷ ⇒ bỏ toàn bộ text stream; card cũ (nếu có) giữ nguyên bên dưới vùng stream.

### Mâu thuẫn / mơ hồ phát hiện thêm — đánh dấu rõ

**G1 [PHÁT HIỆN THÊM] Mâu thuẫn với ADR 021 #6 ("Regenerate = UPSERT ghi đè, 1 bản mới nhất mỗi loại, không xác nhận") và glossary dòng 69 (`studio_result` UNIQUE(notebook_id,kind)).** PR 1 đảo ngược quyết định này. Cần chốt hình thức ghi ADR (bổ sung/thay thế một phần 021 #6, #4; không sửa file cũ) và: `studio:list` trả về gì (mọi phiên bản hay chỉ mới nhất + kênh riêng liệt kê phiên bản — `StudioResult[]` hiện được `useStudio` ánh xạ thành `Partial<Record<StudioKind,…>>`); `Tạo lại` có còn "ghi đè bản đang xem" hay luôn thêm bản mới; **khoá `(notebookId, kind)` của sổ lượt 149** (lượt mới thay lượt cũ) với `custom`: hai yêu cầu `custom` khác nhau chạy song song bị "supersede" lẫn nhau — đúng ý hay cần khoá thêm `custom_prompt`/phiên bản?

**G2 [PHÁT HIỆN THÊM] Mâu thuẫn với ADR 146/149 "Ngoài phạm vi: stream token Studio" và ADR 021 #10 ("Không progress bar… 1 lượt").** Brief PR 4 đưa stream vào. Cần ghi ADR bổ sung (không sửa file cũ). Cũng: ADR 146 chốt "kênh push gửi về cửa sổ đã gọi" — PR 4 phải theo (khác Chat broadcast).

**G3 [PHÁT HIỆN THÊM] Tên hiển thị prototype ≠ code hiện tại** (đã tồn tại từ trước, không do #178): prototype "Tóm tắt tự động" / "Câu hỏi thường gặp" vs code "Tóm tắt tài liệu" / "FAQ"; prototype xếp 1 cột còn code là lưới 2 cột. Hướng dẫn: giữ tên code (đã qua 123), ghi nhận không sửa prototype. Cần xác nhận không phải coi là lỗi.

**G4 [PHÁT HIỆN THÊM] Dung lượng/ngữ nghĩa dữ liệu của phiên bản:** `parts`/`truncated` hiện **không lưu DB** (chỉ có ở kết quả vừa tạo) ⇒ khi xem lại phiên bản cũ, ghi chú "Tổng hợp từ N phần" / "chưa tổng hợp phần cuối" sẽ mất. Có thêm cột lưu `parts`/`truncated` (và `local`, ngôn ngữ đầu ra) vào v11 không? `localKinds` (nhãn AI cục bộ, 098) cũng chỉ trong phiên — cùng vấn đề. Brief liệt kê đúng 2 cột mới (`custom_prompt`, `source_ids_json`); thêm cột là mở rộng brief.

**G5 [PHÁT HIỆN THÊM] `custom_prompt` hiển thị lại & rủi ro nội dung:** văn bản yêu cầu được lưu và hiển thị trên thẻ/lịch sử ⇒ render phải là text node (không HTML/markdown thực thi — Constitution III/XSS); có đưa vào tên tệp export (`exportName` dùng nhãn loại) không; hiển thị tiêu đề thẻ `custom` là gì (nhãn "Yêu cầu tuỳ chỉnh" + trích đầu prompt?).

**G6 [PHÁT HIỆN THÊM] Chống prompt-injection ở `custom`:** việc đặt văn bản người dùng chỉ ở tin nhắn user _giảm_ nhưng không loại bỏ rủi ro (người dùng chính là chủ máy; nguồn tải lên mới là vector nguy hiểm thật, đã có sẵn). Cần chốt: có thêm câu "đặt trong dấu phân cách, coi là chỉ dẫn nội dung không phải quy tắc" không; `custom` có được yêu cầu "bỏ `[n]`" (hậu kiểm vẫn gắn `citationsFromMap` ⇒ vẫn có nguồn) — hành vi mong đợi; phân biệt `studioEmptyOutput` khi yêu cầu không liên quan nguồn ("không tìm thấy" kiểu Chat?). Ghi vào checklist security-reviewer.

**G7 [PHÁT HIỆN THÊM] `sourceIds[]` — giới hạn & tương thích:** (1) trần số phần tử (vd ≤ 50) để tránh payload lớn/quét tuyến tính; (2) `sourceId` và `sourceIds` cùng có mặt ⇒ ưu tiên gì/ lỗi; (3) id lặp ⇒ khử trùng; (4) một số id không ready: lỗi toàn lượt (đề xuất) hay bỏ qua rồi báo; (5) giữ mã lỗi `studioSourceNotReady` hay thêm mã mới (thêm vào `user-error.ts` + i18n); (6) UI chọn nhiều nguồn trong cột 262 px (checkbox list trong popover?) thay `<select>` đơn hiện tại — cũng là UI mới; (7) nguồn bị xoá sau khi tạo ⇒ `source_ids_json` trỏ id không còn: hiển thị phiên bản cũ thế nào (nhãn "nguồn đã xoá").

**G8 [PHÁT HIỆN THÊM] Chi tiết stream chưa xác minh:** (1) stream online (OpenAI/Anthropic/Gemini) có `onToken` nhưng chưa xác minh abort "giữ phần đã nhận, không ném" có đúng cho cả 3 — test cho từng provider; (2) `generate` hiện nhận `opts.signal`; cần thêm `onToken` vào `deps.chat` + `run`; (3) kênh `studio:streamToken` payload `{generationId, delta}` — main kiểm `generationId` hợp lệ (đã có `isValidGenerationId`); thiếu id ⇒ không stream (như tiến độ); (4) tốc độ phát (chặn/gộp token để không nghẽn IPC?) — Chat không gộp; (5) lượt `supersede`/huỷ: token sau abort phải bị bỏ ở main (không `send` sau `signal.aborted`) và ở renderer (lọc theo `activeIds`); (6) kết hợp tiến độ 146: pha `writing` bắt đầu → bắt đầu nhận token; (7) hậu kiểm sau stream có thể làm nội dung cuối **khác** văn bản đã stream (gỡ `[n]` lạ) — UI thay thế chứ không nối thêm.

**G9 [PHÁT HIỆN THÊM] Phiên bản × tiến độ/huỷ/tạo lại (renderer):** `useStudio` hiện coi `results[kind]` là một đối tượng; cần mô hình `versions[kind][]` + `selectedVersionId`. Race A→B→A (149 #11) phải giữ đúng cho nhiều phiên bản; "Tạo lại" khi đang xem bản cũ: tạo lại từ prompt của bản cũ hay bản mới nhất?; focus/announce sau khi xoá một phiên bản; xoá phiên bản duy nhất của loại ⇒ trạng thái rỗng.

**G10 [PHÁT HIỆN THÊM] Migration v11 rủi ro:** bảng có FK `notebook_id … ON DELETE CASCADE` — drop/rename trong giao dịch cần xử lý `PRAGMA foreign_keys` (không đổi được trong giao dịch) hoặc dùng tạo-bảng-mới + `INSERT … SELECT` + `DROP` + `ALTER … RENAME` đúng thứ tự; `idx_studio_notebook` phải tạo lại; thêm index `(notebook_id, kind, created_at)`; phiên bản app cũ mở DB v11 ⇒ `SchemaVersionError` (hành vi hiện có, chấp nhận?); sao lưu vault (`vault-backup`) có chứa bảng — kiểm tương thích bản sao lưu cũ (v10) khôi phục vào app v11 (migrate lên được không).

**G11 [PHÁT HIỆN THÊM] Thứ tự 4 PR vs kiểu dùng chung:** PR 1 phải mở sẵn CHECK/cột cho loại mới + `custom` để PR 2–3 không cần migration thứ hai; nhưng `StudioKind` (TypeScript) chỉ mở rộng ở PR 2/3 — giữa chừng DB chấp nhận giá trị mà code chưa sinh (an toàn). Xác nhận chiến lược: PR 1 có thể merge độc lập, ship được (bản "phiên bản" cho 4 loại cũ).

**G12 [PHÁT HIỆN THÊM] Phạm vi ngôn ngữ/nhãn mới:** thêm khoá `studio.kind.{studyGuide,briefing,timeline,glossary,custom}`, `studio.versions.*` (bộ chọn, xoá, xác nhận xoá?), `studio.custom.*` (nhãn ô nhập, placeholder, lỗi rỗng/quá dài, đếm ký tự), `studio.scopeMulti.*`, mã lỗi mới (`studioCustomPromptInvalid`…, `studioSourcesInvalid`…) trong `user-error.ts`, chuỗi a11y (`a11y.studioVersionDeleted`…). Duyệt bản English theo quy ước 123. Xoá phiên bản có hỏi xác nhận không (khác 149 "không hỏi xác nhận" vì huỷ rẻ; xoá là mất dữ liệu).

## Thuật ngữ mới (append vào glossary)

Chưa có trong `docs/00-glossary.md` (đã tra `studio`, `StudioKind`, `StudioResult`). Đề xuất append (không sửa term cũ; cột 日本語 để `—`). **Lưu ý:** dòng `StudioKind` (union 4 giá trị, 021) và `StudioResult` (UNIQUE(notebook_id,kind)) sẽ lỗi thời — đó là SỬA term cũ ⇒ **PR riêng được steward duyệt**, không làm trong branch feature.

| 日本語 | Tiếng Việt (đề xuất)                      | English (đề xuất, dùng trong code)                                     | Ghi chú                                                                               |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| —      | Phiên bản kết quả Studio (lịch sử)        | Studio result version (`studio_result` nhiều dòng/ `(notebook, kind)`) | Mỗi lần tạo = 1 phiên bản; trần theo loại; chọn/xoá từng bản — 178                    |
| —      | Trần phiên bản mỗi loại                   | version retention cap (`STUDIO_MAX_VERSIONS`)                          | Vượt ⇒ xoá bản cũ nhất; chốt ở clarify (a) — 178                                      |
| —      | Hướng dẫn học                             | study guide (`studyGuide`, StudioKind)                                 | Khái niệm chính + câu hỏi ôn tập, có `[n]` — 178 (định danh/định nghĩa chờ clarify b) |
| —      | Bản tóm lược                              | briefing (`briefing`, StudioKind)                                      | Bản 1 trang kiểu briefing; khác `summary` — 178                                       |
| —      | Dòng thời gian                            | timeline (`timeline`, StudioKind)                                      | Sự kiện theo thứ tự thời gian, không suy diễn ngày — 178                              |
| —      | Bảng thuật ngữ (kết quả Studio)           | term glossary (`glossary`, StudioKind)                                 | Thuật ngữ có định nghĩa trong nguồn. Không nhầm với `docs/00-glossary.md` — 178       |
| —      | Yêu cầu tuỳ chỉnh (Studio)                | custom request (`custom`, `custom_prompt`)                             | Văn bản người dùng, chỉ trong tin nhắn user; main kiểm trim/không rỗng/độ dài — 178   |
| —      | Danh sách nguồn đã dùng cho một phiên bản | source ids (`sourceIds[]`, cột `source_ids_json`)                      | `sourceId` cũ vẫn nhận; main kiểm thuộc notebook + `ready` — 178                      |
| —      | Stream bản viết cuối (Studio)             | Studio stream token (kênh push `studio:streamToken`)                   | Chỉ lượt viết cuối; chỉ về cửa sổ gọi; `{generationId, delta}`; huỷ ⇒ không lưu — 178 |

Ghi chú: gộp bớt khi append (rule 5 `CLAUDE.md`: THÊM term được làm ngay trong branch). Không đổi tên `StudioKind`/`StudioResult`/`generationId`/`sourceId`.

## Đối chiếu constitution

- **I (Local-first):** không thêm egress mới; nhiều nguồn/custom/loại mới vẫn qua `pickProvider(target)`; stream online phải dừng egress khi huỷ (`withEgress` tắt); `studio:streamToken` là kênh nội bộ main→renderer.
- **II (Kiểm chứng được):** mọi loại (kể cả `custom`, `timeline`, `glossary`) giữ `[n]` hậu kiểm; không hiển thị `[n]` chưa kiểm như chip; `custom` không được phép làm yếu quy tắc trích dẫn; lịch sử không được làm mất `citations` của bản cũ.
- **III (Biên bảo mật):** `studio:streamToken` whitelist, chỉ cửa sổ gọi; `custom_prompt` và `sourceIds[]` là input renderer → main phải kiểm chặt (độ dài, kiểu, thuộc notebook, ready); render prompt lưu là text node; log không chứa prompt/nội dung/id; migration chỉ SQL tham số hoá/hằng. **PR 3 và PR 4 BẮT BUỘC security-reviewer.**
- **IV (Test-first):** unit TDD cho migration v11 (dữ liệu cũ giữ nguyên, idempotent), repo (insert/list/delete/retention), `prompt.task()` 8 loại, validator `custom`, validator `sourceIds`, stream + `assertNotAborted` (huỷ giữa stream không lưu), `useStudio` (versions, A→B→A), whitelist kênh, i18n vi↔en; e2e: nhiều phiên bản, 262 px/900 px, stream+huỷ; coverage ≥ 80%.
- **V (Phased Delivery):** không vi phạm (hoàn thiện Studio, Pha 1); giao 4 PR theo thứ tự.
- **Additional constraints:** i18n 123; source-of-truth (prototype không có UI này — UI mới); không thêm dependency; migration v11 (đã dự kiến); ADR: ghi quyết định clarify vào `docs/04-decisions/2026-10-10-studio-enhance-2-clarify.md` (+ append `INDEX.md`), nêu rằng nó **bổ sung/thay thế một phần** 021 #4 #6, 146/149 "ngoài phạm vi stream token Studio".

## Suggested constitution amendments

Không đề xuất sửa trực tiếp (mọi sửa đổi constitution qua PR riêng được steward duyệt, rule 5). Cân nhắc về sau, không bắt buộc ở #178: một dòng ở "Additional Constraints" rằng "**mọi input văn bản tự do của người dùng đi vào lệnh LLM MUST được main kiểm (trim, không rỗng, giới hạn độ dài), chỉ đặt trong tin nhắn user và không bao giờ nối vào system prompt; kết quả vẫn phải qua hậu kiểm trích dẫn**" — để Chat, Studio `custom` và các tính năng nhập prompt về sau theo cùng một khuôn. Và: "**mọi kênh push mang nội dung sinh bởi AI (token) MUST chỉ gửi về cửa sổ đã khởi tạo lượt**" (hiện Chat `rag:streamToken` broadcast mọi cửa sổ, Studio tiến độ thì không — nên thống nhất).
