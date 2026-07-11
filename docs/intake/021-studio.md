# Intake — 021-studio

Feature: Studio (cột thứ 3 của Workspace) — tạo nhanh Tóm tắt / Ý chính / Câu hỏi thường gặp (FAQ) / Dàn
outline từ toàn bộ nguồn trong 1 notebook. GitHub issue #21. Branch `021-studio`. Pha 1 (D8, thứ tự cuối
cùng của MVP trước `008-online-provider`).

## Input sources

- `docs/OVERVIEW.md` — mục 5 "MVP (Pha 1)": _"Studio: tạo nhanh Tóm tắt / Ý chính / Câu hỏi thường gặp /
  Dàn ý."_ Mục 6 ràng buộc bất biến #1 (local-first), #3 (trích dẫn map đúng vị trí).
- `docs/03-ui/prototype.html` — cột **Studio** (S2 Workspace), dòng 421–435:
  - Dòng 422–423: `<div class="col studio">` tiêu đề "Studio".
  - Dòng 424–429: 4 nút "Tạo nhanh" — **Tóm tắt tự động**, **Ý chính**, **Câu hỏi thường gặp**, **Dàn ý**
    (mỗi nút là `<button class="tool">` icon + label, không phải tab/segmented control — bấm để _sinh mới_,
    không phải chuyển view giữa các kết quả đã có).
  - Dòng 430–433: `<div class="card">` hiển thị kết quả — ví dụ "Tóm tắt notebook" render dạng `<ul><li>`
    (bullet list), KHÔNG phải văn bản liền mạch. Ví dụ nội dung mẫu (không phải rule, chỉ minh hoạ):
    "Giao dịch M&A với 3 nhóm rủi ro chính đã nhận diện.", "Điểm cần đàm phán: mức phạt 8% vs thông lệ
    5%.", "Còn 1 phụ lục ký tay đang chờ OCR."
  - Prototype **KHÔNG** vẽ chip trích dẫn `[n]` bên trong card Studio (khác hẳn cột Chat, dòng 399 có
    `<button class="cite" data-cite>`). Card Studio mẫu không có citation nào → mơ hồ cần clarify.
  - Prototype không thể hiện: trạng thái loading khi đang sinh, nhiều card cùng lúc (đã có Tóm tắt + bấm
    Ý chính thì sao), placeholder khi notebook rỗng, hay nút "tạo lại".
  - CSS liên quan: `.studio-in`, `.tool`, `.card` (dòng 169–178). Không có class trạng thái
    loading/error/empty cho Studio.
- `docs/04-decisions/2026-07-10-tech-stack.md` — D3 (LLM/embedding qua Ollama + `ProviderRegistry`,
  interface `LLMProvider{chat,embed,test}`), D4 (locator gắn ngay lúc chunk, cấm tái tạo offset sau —
  áp dụng cho mọi trích dẫn kể cả Studio nếu có), D8 (thứ tự pha: `...006 source-viewer → 007 studio →
008 online-provider` — lưu ý ADR đánh số slug 007 nhưng issue/branch thực tế là **021-studio**; số
  thứ tự ADR là thứ tự _logic_, không phải số issue — không mâu thuẫn, chỉ khác hệ đánh số).
- `docs/00-glossary.md` — dòng 29: `Studio` → `studio` — _"Tóm tắt/Ý chính/FAQ/Dàn ý"_ (đã có, không đổi
  tên). Chưa có entry riêng cho "Tóm tắt" (summary), "Ý chính" (key points), "FAQ", "Dàn ý" (outline) như
  các _loại sản phẩm_ cụ thể (StudioKind) — xem mục Thuật ngữ mới.
- `.specify/memory/constitution.md` — Principle I (local-first, chat Ollama không egress mặc định),
  Principle II (nếu Studio có trích dẫn → map locator thật, cấm bịa/tái tạo offset), Principle III
  (mọi truy cập DB/model/mạng CHỈ ở main process, qua kênh IPC whitelisted mới `studio:*`, không log nội
  dung tài liệu), Principle IV (test-first, coverage 80%), Principle V (phased — Studio đứng sau
  source-viewer, trước online-provider theo D8).
- **Figma:** không có node/file Figma nào được cấp cho dự án này — UI nguồn duy nhất là
  `docs/03-ui/prototype.html` (wireframe tĩnh, không phải Figma). Không có Figma MCP nào khả dụng/liên
  quan ở đây; design token (màu, spacing) lấy trực tiếp từ CSS trong prototype.html, không qua Figma
  variables.
- **Code hiện có đã đọc (để xác định tái dùng, không phải "nguồn thiết kế" nhưng ảnh hưởng trực tiếp
  scope):**
  - `src/main/services/rag/{retrieval,context-builder,prompt,citation,rag-service,constants,rag-types}.ts`
  - `src/main/services/ingestion/source-repo.ts` (có `listChunks(sourceId)`, `getChunksByIds`, `getById`;
    KHÔNG có method gom chunk toàn notebook)
  - `src/main/services/ai-runtime/provider.ts` (`LLMProvider.chat`)
  - `src/main/ipc/register.ts`, `src/shared/ipc/{channels,types}.ts` (23 kênh hiện có)
  - `src/renderer/features/sources/Workspace.tsx` (cột Studio hiện là placeholder tĩnh, dòng 18–21)
  - `src/renderer/features/source-viewer/useSourceViewer.ts` (`openCitation(citation)` — có thể tái dùng
    nếu Studio kết quả có chip `[n]`)

## Prompt for /speckit-specify

**Xây tính năng Studio cho InsightVault — cột thứ 3 trong màn Workspace (bên phải Chat), cho phép người
dùng tạo nhanh 4 loại sản phẩm tổng hợp từ TOÀN BỘ nguồn (source) đã lập chỉ mục trong 1 notebook: (1)
Tóm tắt tự động, (2) Ý chính, (3) Câu hỏi thường gặp (FAQ), (4) Dàn ý (outline). Đây là 4 nút "Tạo nhanh"
riêng biệt (không phải tab chuyển đổi) — mỗi nút khi bấm sẽ sinh MỚI một sản phẩm loại đó bằng LLM chạy
cục bộ (Ollama, qua `LLMProvider.chat` / `ProviderRegistry`, giống cách hỏi đáp RAG (rag-qa, 013) đang
dùng — không network egress mặc định).

Khác với hỏi đáp (rag-qa): Studio KHÔNG có câu hỏi cụ thể để truy hồi (retrieval) theo độ liên quan — nó
cần tổng hợp nội dung của TẤT CẢ nguồn trong notebook (không phải top-k theo query). Cần quyết định chiến
lược gom nội dung (xem Ambiguities) sao cho vẫn nằm trong giới hạn ngữ cảnh (context window) của model
local (~7B, ngữ cảnh có hạn), có thể tái dùng cơ chế ghép ngữ cảnh có ngân sách ký tự và đánh số `[n]`
đã có ở `context-builder.ts` (013-rag-qa), và cơ chế hậu kiểm chip trích dẫn (`citation.ts` — chỉ giữ lại
`[n]` thực sự map được tới chunk thật, không tin số LLM tự sinh) nếu Studio quyết định có trích dẫn.

Kết quả mỗi lần tạo hiển thị dưới dạng card trong cột Studio (theo prototype: `<div class="card"><h4>Tiêu
đề</h4><ul>...</ul></div>`), thay thế card cũ khi tạo mới cùng loại (hoặc theo quyết định clarify về việc
lưu nhiều kết quả). Toàn bộ truy cập retrieval/chat/DB cho Studio phải nằm ở main process, expose qua kênh
IPC mới `studio:*` được whitelist tường minh trong `src/shared/ipc/channels.ts` (theo đúng pattern
`rag:ask`/`source:*` hiện có), không lộ ra renderer dưới dạng nội dung tài liệu thô.

Nếu Studio quyết định hỗ trợ trích dẫn `[n]` trong kết quả (để giữ tinh thần "kiểm chứng được" —
Constitution II), bấm vào chip phải mở được Source Viewer (019) đúng đoạn nguồn, tái dùng
`useSourceViewer().openCitation`. Nếu quyết định KHÔNG có trích dẫn ở Studio (vì bản chất là tổng hợp
toàn notebook, không phải trả lời 1 câu hỏi cụ thể), phải nêu rõ đây là điểm khác biệt có chủ đích so với
Chat, và ghi lại lý do.

Cần xử lý các trạng thái: đang sinh (loading trên từng nút/card), notebook chưa có nguồn nào hoặc chưa có
nguồn nào `ready` (rỗng), Ollama/model chưa sẵn sàng (giống cách rag-qa xử lý — có thể báo lỗi rõ ràng,
không bịa nội dung), và lỗi khi gọi model thất bại.**

## Ambiguities to raise in /speckit-clarify

Đã quét `docs/04-decisions/INDEX.md` — không có quyết định nào từ trước bao phủ trực tiếp các câu hỏi
dưới đây (rag-qa-clarify và rag-retrieval-strategy chỉ nói về hỏi-đáp theo câu hỏi cụ thể, không nói về
tổng hợp toàn notebook). Liệt kê đầy đủ:

1. **Phạm vi 4 loại sản phẩm ở v1:** làm cả 4 loại (Tóm tắt / Ý chính / FAQ / Dàn ý) cùng lúc, hay MVP chỉ
   1–2 loại rồi mở rộng? OVERVIEW liệt kê cả 4 như một cụm MVP, prototype vẽ cả 4 nút — khuyến nghị làm
   cả 4 vì khác biệt chủ yếu nằm ở system prompt/định dạng output, không phải kiến trúc, nhưng cần chốt
   để không mở rộng scope giữa chừng.
2. **Chiến lược gom ngữ cảnh (context) cho toàn notebook** — đây là câu hỏi kỹ thuật cốt lõi, ảnh hưởng
   trực tiếp chất lượng & tính đúng đắn của mọi loại sản phẩm Studio:
   - (a) Lấy TẤT CẢ chunk của TẤT CẢ nguồn `ready` trong notebook, ghép theo ngân sách ký tự
     (như `CONTEXT_CHAR_BUDGET` hiện tại nhưng có thể cần ngân sách riêng/lớn hơn cho Studio) — bỏ nguyên
     chunk khi vượt ngân sách (rủi ro: notebook nhiều nguồn dài → mất nhiều nội dung, tóm tắt thiên lệch
     về nguồn nạp trước).
   - (b) Sampling/đại diện: lấy N chunk đầu mỗi nguồn, hoặc chunk đều theo tỷ lệ mỗi nguồn.
   - (c) Map-reduce nhiều lượt chat: tóm tắt từng nguồn riêng trước (map), rồi tổng hợp các tóm tắt con
     thành kết quả cuối (reduce) — tốn nhiều lượt gọi LLM hơn nhưng bao phủ toàn bộ nội dung, không cắt bỏ.
   - Cần chốt trước khi thiết kế `data-model.md` vì ảnh hưởng trực tiếp cấu trúc service/IPC (1 lượt chat
     hay nhiều lượt tuần tự) và trải nghiệm loading (nhanh vs chờ lâu với notebook lớn).
3. **Có chip trích dẫn `[n]` trong kết quả Studio hay không?** Nếu có: map tới chunk nào khi dùng chiến
   lược map-reduce (câu 2c) — citation trỏ vào chunk gốc hay vào tóm tắt trung gian (không phải nguồn
   thật, vi phạm tinh thần Constitution II nếu trỏ sai)? Nếu không: cách nào vẫn đảm bảo "kiểm chứng
   được" ở mức tối thiểu (VD: card ghi rõ danh sách nguồn đã dùng, không có locator chi tiết)?
4. **Persist kết quả hay chỉ trong phiên (in-memory)?** rag-qa hiện tại KHÔNG persist lịch sử hội thoại
   (in-memory, `RagTurn[]` giữ ở renderer). Studio có cần lưu bền vào SQLite (cần migration schema mới,
   bảng `studio_result` hay tương tự) để người dùng quay lại notebook vẫn thấy tóm tắt cũ, hay mỗi lần mở
   lại Workspace là card trống, phải bấm tạo lại?
5. **Kênh IPC `studio:*` và payload chính xác** — đề xuất sơ bộ cần chốt: 1 kênh `studio:generate` nhận
   `{notebookId, kind: StudioKind}` trả về `StudioResult` (tương tự pattern `rag:ask` 1 kênh duy nhất theo
   quyết định rag-qa-clarify), hay 4 kênh riêng theo từng loại? Có cần kênh liệt kê kết quả đã lưu
   (`studio:list`) nếu câu 4 chọn persist?
6. **Regenerate (tạo lại):** prototype không có nút "tạo lại" rõ ràng — bấm lại cùng nút "Tạo nhanh" có
   ghi đè kết quả cũ ngay, hay hỏi xác nhận? Nếu persist (câu 4), giữ lịch sử nhiều lần tạo hay chỉ 1 bản
   mới nhất mỗi loại?
7. **Notebook rỗng / chưa có nguồn `ready`:** trạng thái hiển thị ở cột Studio khi bấm nút mà chưa có
   nguồn nào đã lập chỉ mục xong (VD tất cả đang `processing`)? Disable nút, hay bấm được nhưng báo lỗi
   dạng giống `NOT_FOUND_ANSWER` của rag-qa?
8. **Ollama/model chưa sẵn sàng:** Studio dùng lại `RuntimeStatus`/`ollamaReady` như rag-qa hay ai-runtime
   đã có, hiển thị thông báo lỗi thế nào trên UI cột Studio (khác gì với lỗi ở Chat)?
9. **Định dạng output từng loại sản phẩm:**
   - Tóm tắt: đoạn văn liền mạch hay bullet list (prototype ví dụ dùng `<ul><li>` — có phải chuẩn cho MỌI
     loại, hay chỉ ví dụ minh hoạ ngẫu nhiên)?
   - FAQ: cấu trúc cặp Câu hỏi/Trả lời (structured `{question, answer}[]`) hay văn bản Markdown tự do?
   - Dàn ý: cây phân cấp có thứ bậc (nested list nhiều cấp, cần kiểu dữ liệu `OutlineNode[]` đệ quy) hay
     văn bản Markdown heading tự do (LLM tự sinh `#`/`##`)? Ảnh hưởng trực tiếp thiết kế `StudioResult`
     type (string tự do vs structured JSON) và độ phức tạp parse/render ở renderer.
10. **Giới hạn kích thước / thời gian sinh:** notebook rất lớn (nhiều chục nguồn, hàng trăm chunk) — có
    cần giới hạn cứng (VD tối đa N chunk/N ký tự đưa vào, cảnh báo người dùng) để tránh treo UI hoặc vượt
    quá context window model 7B (~8k token)? Có cần chỉ báo tiến độ (progress) nếu dùng map-reduce nhiều
    lượt?

## Thuật ngữ mới (append vào glossary)

Glossary đã có "Studio" (dòng 29). Các thuật ngữ dưới đây là _tên loại sản phẩm cụ thể_ + khái niệm kỹ
thuật mới phát sinh riêng cho feature này, CHƯA có entry riêng — đề xuất người phụ trách append (giữ
nguyên format bảng, cột 日本語 để `—`):

| Tiếng Việt                                           | English (đề xuất)                                    | Ghi chú                                                                                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tóm tắt tự động                                      | `summary`                                            | 1 trong 4 `StudioKind`; nút "Tóm tắt tự động" trong prototype                                                                                          |
| Ý chính                                              | `key points` (`keyPoints`)                           | 1 trong 4 `StudioKind`                                                                                                                                 |
| Câu hỏi thường gặp                                   | `FAQ` (giữ nguyên viết tắt, field `faq`)             | 1 trong 4 `StudioKind`; cấu trúc dữ liệu tuỳ clarify #9                                                                                                |
| Dàn ý                                                | `outline`                                            | 1 trong 4 `StudioKind`; cấu trúc dữ liệu tuỳ clarify #9                                                                                                |
| Loại sản phẩm Studio                                 | `StudioKind`                                         | Union type `"summary" \| "keyPoints" \| "faq" \| "outline"`                                                                                            |
| Kết quả Studio                                       | `StudioResult`                                       | Type IPC trả về từ `studio:generate` (hoặc tương đương)                                                                                                |
| Tạo nhanh (nút hành động Studio)                     | `quick generate` / label UI giữ nguyên tiếng Việt    | Nhãn nút, không cần field riêng                                                                                                                        |
| Tổng hợp toàn notebook (khác retrieval theo câu hỏi) | `notebook-wide context` / `whole-notebook synthesis` | Khái niệm phân biệt với `context` (đã có, nghĩa hẹp hơn — theo câu hỏi) của rag-qa; cần thuật ngữ riêng nếu chốt chiến lược (a)/(b)/(c) ở Ambiguity #2 |
| Map-reduce tóm tắt (nếu chọn chiến lược 2c)          | `map-reduce summarization`                           | Chỉ thêm nếu clarify chọn hướng này                                                                                                                    |

## Traceability

| Nội dung                                                      | Nguồn                                                                |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| Studio là 1 trong các mục MVP Pha 1                           | `docs/OVERVIEW.md` dòng 35                                           |
| 4 loại: Tóm tắt/Ý chính/FAQ/Dàn ý                             | `docs/OVERVIEW.md` dòng 35; `docs/03-ui/prototype.html` dòng 426–429 |
| Cột Studio 262px, vị trí thứ 3 sau Nguồn/Chat                 | `docs/03-ui/prototype.html` dòng 117, 421–435                        |
| Card kết quả dạng tiêu đề + bullet list                       | `docs/03-ui/prototype.html` dòng 176–178, 430–433                    |
| LLM qua ProviderRegistry/Ollama, không egress mặc định        | ADR `2026-07-10-tech-stack.md` D3; Constitution I                    |
| Trích dẫn phải map locator thật, cấm bịa                      | ADR `2026-07-10-tech-stack.md` D4; Constitution II                   |
| DB/model/mạng chỉ ở main, IPC whitelisted, không log nội dung | Constitution III                                                     |
| Studio đứng sau source-viewer, trước online-provider          | ADR `2026-07-10-tech-stack.md` D8; Constitution V                    |
| Test-first, coverage ≥80%                                     | Constitution IV                                                      |
| Studio = "Tóm tắt/Ý chính/FAQ/Dàn ý" (glossary hiện có)       | `docs/00-glossary.md` dòng 29                                        |

## Gap code (đụng chạm code hiện có / feature trước)

- **`source-repo.ts` thiếu method gom chunk toàn notebook.** Hiện chỉ có `listChunks(sourceId)` (theo 1
  nguồn) và `getChunksByIds(ids)`. Studio cần nội dung của MỌI nguồn `ready` trong 1 notebook → cần thêm
  method mới (VD `listChunksByNotebook(notebookId)` join qua bảng `source`, hoặc lặp
  `listByNotebook(notebookId)` rồi gọi `listChunks` từng source ở service layer thay vì sửa repo). Quyết
  định nơi đặt logic này (repo vs service) nên nêu ở `/speckit-plan`.
- **Tái dùng `context-builder.ts`/`citation.ts`/`prompt.ts` (013-rag-qa)** — các hàm này hiện nằm trong
  `src/main/services/rag/` và được viết cho ngữ cảnh "1 câu hỏi, top-k retrieval". Nếu Studio dùng lại,
  cần cân nhắc: (a) import thẳng từ `rag/` (tăng coupling giữa 2 feature khác slug, hơi lệch nguyên tắc cô
  lập theo feature trong CLAUDE.md), hay (b) tách phần thuần tuý (context budget đánh số `[n]`, hậu kiểm
  citation) thành module dùng chung ở `src/main/services/shared/` hoặc tương tự, dùng lại từ cả `rag/` và
  `studio/`. Đề xuất nêu rõ trong `/speckit-plan` — đây là quyết định kiến trúc, không phải chi tiết vụn.
- **Kênh IPC `studio:*` mới** — theo pattern `CHANNELS`/`ChannelResponse`/`safeHandle` đã chuẩn hoá ở
  `src/shared/ipc/channels.ts` + `src/main/ipc/register.ts`; cần thêm `StudioKind`, `StudioResult` (và
  `StudioGenerateInput` nếu 1 kênh) vào `src/shared/ipc/types.ts`.
- **`provider.chat`** — tái dùng `LLMProvider.chat` y hệt rag-qa, không cần thay đổi interface.
- **Không đụng migration SQLite hiện có** trừ khi Ambiguity #4 (persist) chọn "có" — khi đó cần thêm
  migration mới theo `docs/04-decisions/2026-07-11-sqlite-migrations.md` (runner append-only,
  `PRAGMA user_version`).
- **`Workspace.tsx`** — cột Studio hiện là JSX tĩnh (dòng 18–21), cần thay bằng component thật
  (`features/studio/StudioColumn.tsx` hoặc tương đương) theo đúng cấu trúc cô lập feature
  (`src/renderer/features/studio/`).
- **`useSourceViewer().openCitation`** — tái dùng được ngay nếu Ambiguity #3 chọn "có trích dẫn"; không
  cần đổi API của `useSourceViewer`.

## Suggested ADR

Nếu `/speckit-clarify` chốt chiến lược gom ngữ cảnh toàn notebook (Ambiguity #2) + quyết định trích dẫn
(Ambiguity #3), đáng tách thành 1 ADR riêng theo đúng pattern đã làm cho rag-qa (có cả `*-clarify.md` lẫn
`*-strategy.md`), ví dụ `2026-07-11-studio-context-strategy.md`, ghi:

- Chiến lược gom context (all-chunks theo ngân sách / sampling / map-reduce) + lý do chọn.
- Có/không citation `[n]` trong kết quả Studio, và nếu có, cách map locator khi dùng map-reduce.
- Ngân sách ký tự/token riêng cho Studio nếu khác `CONTEXT_CHAR_BUDGET` hiện tại của rag-qa.

Việc này giữ đúng thông lệ "mọi quyết định kỹ thuật quan trọng có ADR" đã thấy ở `013-rag-qa` và
`019-source-viewer`, và giúp `INDEX.md` có nơi tra cứu khi feature sau (VD báo cáo tổng hợp nhiều
notebook, nếu có ở pha sau) cần quyết định tương tự.
