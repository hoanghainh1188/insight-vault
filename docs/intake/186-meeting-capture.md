# Intake — 186-meeting-capture

- Issue: #186 — "Meeting Capture: ghi âm, transcript và nguồn tri thức cuộc họp"
- Slug: `meeting-capture` (branch `186-meeting-capture`)
- Ngày intake: 2026-10-12
- Loại: tính năng MỚI (Pha 2 mở rộng: từ "nạp file audio" sang "ghi âm trực tiếp"). **1 spec, giao bằng nhiều PR theo thứ tự Pha A → Pha B → Pha C** (đã chốt
  với chủ dự án). **Pha D (nhận diện người nói, phát hiện quyết định/việc cần làm, tóm tắt trong lúc họp, đa kênh) NGOÀI phạm vi v1.** Chạm mọi tầng: DB (migration mới,
  v11 là mới nhất), main (ghi file, phiên ghi, ASR nháp/chốt, pipeline nguồn), shared (kiểu, IPC, i18n, mã lỗi), preload, renderer (UI ghi + trình xem cuộc họp),
  cấu hình đóng gói (quyền microphone macOS), session permission handler.
- Không có Figma, không có detail design. Toàn bộ UI ghi âm là **UI mới không có nguồn thiết kế gốc** (prototype chỉ có chip/nhãn "Ghi âm" ở thẻ notebook và một dòng
  nguồn audio mẫu — xem Input sources).

## Input sources

- `docs/01-basic-design/meeting-capture/basic-design.md` — **nguồn chính** (13 mục: mục tiêu, trải nghiệm cốt lõi, điểm vào, màn hình đang ghi, yêu cầu ghi âm & độ bền,
  ngôn ngữ & transcript, kết thúc & hoàn tất, nguồn & trình xem, hỏi đáp & Studio, riêng tư/a11y, ngoài phạm vi, chia pha A–D, tiêu chí nghiệm thu). Tiếng Việt.
- `docs/OVERVIEW.md` — mục 5 "Pha 2": "Audio/Video: nạp file, tự bóc băng kèm timestamp; player nhảy tới timestamp được trích dẫn" (CHỈ nạp file; **không** nhắc ghi âm trực tiếp,
  cũng không nằm trong "Ngoài phạm vi v1" mục 7) · mục 6 ràng buộc bất biến 1, 3, 5 (local-first, trích dẫn map vị trí/timestamp, cách ly renderer).
- `docs/03-ui/prototype.html` — định hướng bố cục: nút `+` thêm nguồn ở cột Nguồn (dòng ~380), modal "Thêm nguồn" 4 loại (dòng ~437–459, loại "Audio/Video — Tự bóc băng"), dòng nguồn audio mẫu
  "Ghi âm phiên đàm phán 08/07 · Audio · 54:12" (dòng ~385), trạng thái `.stat proc/ready`. **Không có** nút "Ghi cuộc họp", hộp bắt đầu ghi, màn đang ghi, màn hoàn tất, thẻ phục hồi,
  trình xem cuộc họp (đánh dấu, tìm trong transcript). Không sửa prototype.
- `.specify/memory/constitution.md` — I (local-first, privacy indicator luôn đúng), II (locator timestamp tạo ngay lúc chunk, cấm ước lượng lại), III (biên bảo mật main/renderer, không log nội dung),
  IV (TDD, coverage ≥ 80%), V (Pha 2 đã hợp lệ vì Pha 1 xong).
- `docs/00-glossary.md` — đã tra (xem "Thuật ngữ mới").
- `docs/04-decisions/INDEX.md` + ADR đã đọc và **kế thừa (xem "Đã chốt / kế thừa")**: `2026-07-12-audio-transcribe-clarify.md` (045), `2026-07-12-audio-player-clarify.md` (049),
  `2026-10-07-privacy-badge-clarify.md` (103); INDEX cho thấy còn liên quan: 2026-07-13-video-clarify (051, ffmpeg-static sẵn có), 2026-10-06-vault-backup-clarify (085), i18n (123), vector-maintenance (116).
- Code đã đọc (chỉ để mô tả điểm tích hợp, KHÔNG phải thiết kế mới):
  `src/main/index.ts` (dòng 99–112 `registerSchemesAsPrivileged` + `installSecurity`; 214–218 `endSession`/`will-quit`; ~531 kiểm queued/processing; 544 `freeBytes` qua `statfs`; 763 `window-all-closed`),
  `src/main/services/ingestion/audio/{transcribe,decode,resample,audio-transcript}.ts`, `src/main/services/ingestion/pipeline.ts` (nhánh `else` đọc cả file bằng `readFile` rồi `parseFile`;
  `resumeInterrupted` dòng ~614; `resumeAwaiting`), `src/main/services/ingestion/{status,size-limits,source-repo}.ts`, `src/shared/ipc/types.ts` (`SourceKind`, `SourceStatus`, `Locator`),
  `src/main/db/migrations.ts` (v11 mới nhất; v5 là ví dụ rebuild bảng `source` có CHECK status), `electron-builder.yml`, `electron.vite.config.ts` (CSP),
  `src/main/services/app-shell/storage-info.ts`.
- Figma: không dùng. Design token: không đổi (tái dùng token/class sẵn có của prototype).
- **Không đọc/xác minh trong phiên này:** thân issue #186 (môi trường intake không có Bash/`gh`) — **người phụ trách đối chiếu `gh issue view 186` với bản intake này trước `/speckit-specify`**;
  `src/preload/index.ts`, `src/renderer/features/source-viewer/*`, `AddSourceModal.tsx`, `src/shared/i18n/*` chi tiết; hành vi `audio-decode` với WebM/Opus; khả năng trả về ngôn ngữ phát hiện
  của pipeline ASR trong transformers.js; tốc độ thực của Whisper trên CPU mục tiêu (chưa có số đo).

## Sự kiện cần ghi nhận (từ code hiện tại, để spec không phải đoán)

Nhóm A — nạp audio hiện có (045/049)

1. **Bóc băng hiện chỉ cho file có sẵn:** `createTranscriber` (`transcribe.ts`) lazily tạo `pipeline("automatic-speech-recognition", "Xenova/whisper-base")` chạy **in-process trong main**, nhận **một**
   `Float32Array` 16 kHz mono toàn bộ, `return_timestamps: true`, `chunk_length_s: 30`, trả `Segment[]{text,tStart,tEnd}`. Không có API streaming/tăng dần, không trả ngôn ngữ phát hiện, không VAD.
2. **Đường nạp audio đọc CẢ FILE vào RAM:** `pipeline.ts` nhánh mặc định `deps.readFile(origin)` → `assertWithinLimit` → `parseFile(kind, bytes, onProgress)`; `decodeAudio` dùng `audio-decode`
   (wav/mp3/flac/ogg) → `resampleTo16k` (hàm thuần). Video/ảnh đã có đường đọc theo path (`statSize`, ffmpeg) để KHÔNG nạp cả file vào RAM; audio thì chưa.
3. **`SIZE_LIMITS.audio = 200 MB`.** 120 phút WAV PCM16 16 kHz mono ≈ 120×60×16000×2 ≈ **230 MB** > 200 MB (xem Ambiguity C2).
4. **`timeMap` (char↔time) chỉ dùng tạm khi nạp:** `timeForCharRange` gắn `tStart/tEnd` cho từng chunk (cột `chunk.t_start/t_end`, migration v5); **không có bảng/cột lưu bản đồ char↔time mịn** (mức câu).
   `SourceContent` (`source:getContent`) hiện tái dựng văn bản từ chunk, **không mang timeMap**. Thiết kế (mục 8) đòi "map ký tự ↔ timestamp" và "đoạn đang phát được tô sáng" ⇒ cần lưu bền ở mức mịn hơn chunk.
5. **Player 049:** `iv-media://source/<sourceId>`, handler chỉ nhận `kind === "audio"`, lấy **một** đường dẫn từ cột `origin`, hỗ trợ Range/206; **tham chiếu file gốc của người dùng, KHÔNG copy**;
   khi citation có `tStart` thì `currentTime = tStart` **rồi `play()`** (autoplay bị chặn thì bỏ qua). Player nằm sticky trong Source Viewer.
6. **Trạng thái nguồn:** `queued → processing → (awaiting_embedding →) ready | error`; `ready` không có đường ra; `error → queued` (retry). Bảng `source` có **CHECK status** gồm đúng 5 giá trị
   (thêm trạng thái mới = rebuild bảng như migration v5, rủi ro cascade chunk). Hàng đợi `SerialQueue` **tuần tự 1 nguồn/lần, nằm trong RAM**; `resumeInterrupted()` lúc khởi động đánh dấu mọi
   nguồn kẹt `queued/processing` thành `error` + mã `interrupted` (người dùng bấm "Thử lại").
7. **Privacy badge (103):** `setOnline(true,"model")` quanh lần tải model đầu (transcribe.ts đã làm); badge `sending/model` kể cả khi model đã có trong cache (chấp nhận báo thừa).
8. **Session hiện TỪ CHỐI MỌI quyền:** `installSecurity()` → `setPermissionRequestHandler(cb(false))`, `setPermissionCheckHandler(() => false)`, `setDevicePermissionHandler(() => false)`; comment ghi rõ
   "app-shell không cần camera/mic". ⇒ `getUserMedia({audio})` sẽ thất bại cho tới khi sửa. CSP hiện không có directive nào chặn `getUserMedia`; nhưng `script-src 'self'` (PROD) ⇒ AudioWorklet phải nạp
   từ tệp bundle cùng origin, KHÔNG dùng `blob:`/inline.
9. **Đóng gói:** `electron-builder.yml` mac `identity: null` (không ký), **không có** `extendInfo` (`NSMicrophoneUsageDescription`) hay entitlements; Windows NSIS. Chưa code-sign/notarize (pha sau).
10. **Dung lượng đĩa:** đã có `freeBytes` qua `statfs` ở main (`storage-info.ts`, dùng cho Settings và bảo trì vector `freeBytes ≥ 2×`); chưa có ngưỡng cảnh báo dùng cho ghi âm.
11. **Phím tắt:** không tìm thấy `globalShortcut`/cơ chế phím tắt cấu hình được nào trong `src/main`; menu ứng dụng (145) chỉ dùng `role` chuẩn.
12. **Vault lock / khôi phục (085):** `vaultLock`/`isVaultBusy` chặn thêm/thử lại/xoá nguồn trong snapshot & sau xác nhận khôi phục; khôi phục **khởi động lại app để hoán đổi** — một phiên ghi đang chạy bị cắt ngang nếu không chặn.
13. **Nguồn xoá:** `pipeline.remove` → `vectorStore.deleteBySource` + `sourceRepo.delete` (cascade chunk). Với audio của người dùng, file gốc KHÔNG bị xoá (chỉ tham chiếu). Meeting thì file audio nằm trong data dir (app sở hữu) ⇒ cần xoá.

## Đã chốt / kế thừa — KHÔNG hỏi lại ở clarify

1. **Engine bóc băng = `@huggingface/transformers` Whisper chạy LOCAL ở main, model `Xenova/whisper-base`, tải 1 lần về data dir rồi offline, progress qua `progress_callback`** (045 #1, #3).
   Không whisper.cpp/native. *(Ghi chú: OVERVIEW §8 gợi ý whisper.cpp nhưng đã được ADR 045 thay bằng transformers.js — không phải mâu thuẫn mới.)* Câu hỏi MỚI duy nhất là model NHÁP/CHỐT và NƠI chạy ASR nháp (A2, A3) — 045 chỉ chốt cho nạp file.
2. **Locator audio = `Locator.tStart/tEnd` (giây) tính từ char-range qua `timeMap` bằng hàm thuần, gắn ngay lúc chunk** (045 #4; Constitution II). Transcript → chunk → embed → index đi qua **pipeline nguồn hiện có** (design mục 7 đúng ý này).
3. **Phát lại & tua = giao thức `iv-media://` ở main, tra sourceId → DB, không nhận path từ renderer, Range/206, least-privilege, `media-src 'self' iv-media:` không đụng `connect-src`** (049 #1, #4). Mở rộng (kind mới/MIME mới) tuân cùng khuôn (như 051/053 đã làm).
4. **Chỉ báo riêng tư 3 trạng thái `local`/`online`/`sending`, main đẩy `privacy:changed`; tải model = egress `model`; Ollama/localhost không phải egress** (103). Ghi âm + ASR cục bộ không bật `sending`.
5. **Ranh giới bảo mật:** renderer `sandbox:true`; mọi truy cập FS/DB/model ở main; IPC whitelist ở `preload` + `CHANNELS`; không log nội dung (audio/transcript/prompt) — Constitution III, design mục 10.
6. **i18n (123):** mọi chuỗi qua `src/shared/i18n` (vi nguồn, en cùng khoá + placeholder); main trả MÃ lỗi/tham số, renderer dịch; nhãn English phải có cho toàn bộ UI mới (design viết tiếng Việt).
7. **a11y (091):** `announce`/`LiveRegion` chỉ báo MỐC trạng thái, không đọc từng câu (khớp design mục 10 "không đọc từng câu transcript").
8. **Migration:** append-only, `PRAGMA user_version`, 1 giao dịch/bước (sqlite-migrations); v11 đã dùng ⇒ migration của feature này ≥ v12.
9. **Studio/RAG:** chỉ nguồn `ready` tham gia hỏi đáp/Studio (`resolveSourceScope` yêu cầu `ready`) ⇒ "chỉ bật hỏi đáp sau khi transcript cuối + index xong" (design mục 9) KHÔNG cần cơ chế mới nếu nguồn chưa `ready` trong lúc ghi/hoàn tất.
10. **Ngoài phạm vi (design mục 11 + chủ dự án):** người nói tự động, đa micro/audio hệ thống, đồng bộ cloud, tóm tắt tự động khi chưa kết thúc, cộng tác sửa transcript, tự phát audio khi mở citation (xem C1), **toàn bộ Pha D**.

## Prompt for /speckit-specify

Thêm vào InsightVault tính năng **Meeting Capture (Ghi cuộc họp)**: cho phép người dùng ghi âm trực tiếp một cuộc họp dài từ **120 phút trở lên** bằng microphone, xem transcript xuất hiện gần thời gian
thực trong lúc họp, rồi lưu kết quả thành một **nguồn** trong notebook để tìm kiếm toàn văn, hỏi đáp RAG, Studio (tóm tắt, ý chính, FAQ, dàn ý…) và trích dẫn chính xác theo mốc thời gian. Tính năng vận hành
**local-first**: audio và transcript được lưu, xử lý (nhận dạng tiếng nói, lập chỉ mục) trên máy theo mặc định; dữ liệu chỉ rời thiết bị khi người dùng chủ động bật AI online ở chat/Studio. Mục tiêu trải
nghiệm là một "máy ghi âm đáng tin cậy": ít thao tác, trạng thái dễ hiểu, audio luôn được lưu an toàn và khôi phục được sau sự cố; AI phát huy giá trị **sau** cuộc họp thay vì làm người dùng phân tâm lúc họp.
Luồng chính: `Bắt đầu ghi → transcript hiện dần → tạm dừng/tiếp tục hoặc đánh dấu → kết thúc → chốt transcript → lập chỉ mục → hỏi đáp có trích dẫn`.

**Điểm vào và bắt đầu ghi.** Trong notebook, cạnh nút thêm nguồn có hai lựa chọn: `+ Thêm nguồn` và `Ghi cuộc họp`. Chọn `Ghi cuộc họp` mở một hộp bắt đầu nhỏ gồm: tên mặc định (ví dụ
`Cuộc họp 12/10, 14:30`), notebook đích, chọn microphone nếu có nhiều thiết bị, ngôn ngữ (`Tự động` mặc định; có thể `Tiếng Việt`, `English`, hoặc `Đa ngôn ngữ`), thông điệp riêng tư
"Âm thanh và transcript được xử lý trên máy này." và nút chính `Bắt đầu ghi`. App xin quyền microphone khi cần; nếu bị từ chối thì giải thích ngắn gọn cách cấp quyền và **không tạo nguồn rỗng**.

**Màn hình đang ghi** là chế độ tập trung trong workspace với ba vùng: thanh đầu (tên cuộc họp, trạng thái ghi, thời lượng, trạng thái lưu cục bộ — ví dụ `● Đang ghi · 01:42:18 · Lưu trên máy`; chấm đỏ
không phải tín hiệu duy nhất; đồng hồ là thông tin nổi bật nhất; khi transcript chậm hiện "Đang xử lý bản ghi — audio vẫn được lưu an toàn"; không lộ chi tiết kỹ thuật như chunk, hàng đợi, model),
nội dung chính (transcript thời gian thực có timestamp ở lề trái như `01:18:42`, đoạn còn đang nhận dạng có nhãn nhẹ `Đang nhận dạng`, bản chốt thì không có nhãn; tự cuộn chỉ khi người dùng đang ở phần mới
nhất, cuộn lên đọc thì dừng tự cuộn và hiện nút `Quay về hiện tại`; bấm timestamp để phát lại audio tại vị trí đó; bôi chọn transcript hoặc bấm `Đánh dấu` để thêm nhãn thủ công `Quyết định`,
`Việc cần làm`, `Câu hỏi`; cập nhật bản nhận dạng tốt hơn **tại chỗ, không nhấp nháy**) và thanh điều khiển dưới (meter âm lượng đơn giản: có tín hiệu / tín hiệu yếu / quá lớn; ngôn ngữ; đánh dấu;
`Tạm dừng`↔`Tiếp tục`; `Kết thúc ghi`). Khi tạm dừng ghi rõ "Đã tạm dừng — không thu âm". Nút `Đánh dấu` phải dễ tiếp cận lúc họp. `Kết thúc ghi` là hành động nguy hiểm, đặt tách biệt và có xác nhận
cho phiên dài.

**Độ bền ghi âm.** Ghi liên tục tối thiểu 120 phút; audio được lưu thành các **phân đoạn độc lập** (mặc định 5–10 phút mỗi đoạn); sau khi một phân đoạn đóng, dữ liệu đó phải còn nguyên nếu app hoặc máy
gặp sự cố; audio vẫn tiếp tục được ghi khi transcript xử lý chậm; tạm dừng/tiếp tục không làm hỏng phiên và transcript biểu thị rõ khoảng ngừng; cảnh báo sớm khi gần hết dung lượng đĩa; khi mất quyền
microphone, mất thiết bị hoặc lỗi ghi thì giữ toàn bộ dữ liệu đã có và hướng dẫn chọn thiết bị khác hoặc hoàn tất phiên; khi mở lại app sau sự cố hiện thẻ `Phục hồi cuộc họp chưa hoàn tất` cho phép
tiếp tục hoàn tất transcript hoặc giữ bản ghi như một nguồn chưa hoàn thiện.

**Ngôn ngữ và transcript.** Tự nhận dạng ngôn ngữ từ khoảng 20–30 giây đầu (hiện "Đang nhận dạng ngôn ngữ…" rồi kết quả như `Tiếng Việt · Tự động`); người dùng luôn khóa được ngôn ngữ thủ công; **không** tự
đổi ngôn ngữ theo từng đoạn ngắn — chỉ đánh giá lại trên cửa sổ dài khoảng 1–2 phút; nếu có khả năng đổi ngôn ngữ đáng kể thì gợi ý "Có vẻ cuộc họp đang dùng English. Chuyển transcript sang English?";
với họp pha trộn Việt–Anh dùng chế độ `Đa ngôn ngữ`, chấp nhận tên riêng/thuật ngữ có thể cần bản chốt để chính xác hơn.

**Kết thúc và hoàn tất nguồn.** `Kết thúc ghi` chuyển sang trạng thái hoàn tất, không đóng vội về notebook: hiện tiêu đề cuộc họp (sửa được), tổng thời lượng, trạng thái "Đang chốt transcript và lập chỉ
mục", nút `Về notebook` (tác vụ tiếp tục chạy nền) và `Mở khi hoàn tất`. App chạy bước transcript cuối để ghép các phân đoạn, xử lý ranh giới giữa chúng và cải thiện transcript nháp; sau đó transcript được
chunk, embed và lập chỉ mục **qua pipeline nguồn hiện có**. Nguồn chuyển `Sẵn sàng` khi toàn bộ bước này thành công; trong lúc xử lý nguồn có trạng thái `Đang hoàn tất` (không phải lỗi).

**Nguồn cuộc họp và trình xem.** Nguồn cuộc họp là một dạng audio có metadata bổ sung: tiêu đề, notebook, thời gian bắt đầu/kết thúc và thời lượng, thiết bị ghi, ngôn ngữ, trạng thái xử lý, danh sách
phân đoạn audio (hỗ trợ khôi phục), transcript, map ký tự ↔ timestamp và các đánh dấu thủ công. Trình xem cuộc họp có: audio player cố định ở đầu; transcript đồng bộ với đoạn đang phát được tô sáng; bấm
transcript để tua đúng timestamp; tìm toàn văn trong transcript; danh sách đánh dấu; sao chép transcript và xuất Markdown. Khi bấm trích dẫn `[n]` trong chat, app mở nguồn tại timestamp liên quan;
**mặc định chỉ tua đến vị trí, tự phát audio là tuỳ chọn của người dùng**. Sau khi `Sẵn sàng`, nguồn tham gia đầy đủ vào tìm toàn văn, hỏi đáp RAG (trích dẫn về đúng đoạn transcript và audio) và Studio;
trong lúc đang ghi, transcript nháp không được coi là nguồn đáng tin để trả lời (v1 chỉ bật hỏi đáp sau khi transcript cuối và index xong).

**Riêng tư, bảo mật, khả năng tiếp cận.** Không gửi audio hay transcript ra ngoài ở chế độ local; nếu cần tải model nhận dạng tiếng nói lần đầu phải có chỉ báo riêng tư rõ ràng; không ghi nội dung audio,
transcript hay API key vào log; luôn hiển thị rõ microphone có đang hoạt động hay không; mọi điều khiển có nhãn cho trình đọc màn hình (trạng thái ghi, thời lượng, mức âm lượng, trạng thái transcript);
thông báo trạng thái quan trọng qua live region nhưng không đọc từng câu transcript; có phím tắt **cấu hình được** cho tạm dừng/tiếp tục, đánh dấu và kết thúc ghi; không dùng chỉ màu sắc để biểu thị
trạng thái. Mọi chuỗi giao diện qua khung i18n (tiếng Việt nguồn + English).

**Chia pha và thứ tự PR (1 spec, nhiều PR).** Pha A — *Ghi âm thành nguồn*: ghi microphone, lưu audio theo phân đoạn, tạo nguồn cuộc họp và xử lý transcript sau khi dừng. Pha B — *Transcript gần thời gian
thực*: transcript nháp, nhận dạng ngôn ngữ ban đầu, hiển thị tiến độ và các trạng thái UI đang ghi. Pha C — *Cuộc họp dài và khôi phục*: checkpoint, khôi phục phiên dang dở, cảnh báo dung lượng, xử lý lỗi
thiết bị, kiểm thử 120+ phút. Mỗi pha phải giao được độc lập (ship được) theo thứ tự A → B → C. **Pha D (nhận diện người nói, phát hiện quyết định/việc cần làm, tóm tắt trong lúc họp, thu âm đa kênh)
ngoài phạm vi v1.**

**Tái dùng, KHÔNG làm lại:** bóc băng Whisper cục bộ ở main (045), phát/tua qua `iv-media://` (049), pipeline nguồn parse→clean→chunk→embed→store và Locator `tStart/tEnd`, chỉ báo riêng tư 3 trạng thái (103),
khung i18n (123), `announce` (091), migration append-only. Mọi truy cập microphone-data → file → DB/model diễn ra ở main; renderer sandbox giữ nguyên.

**Tiêu chí nghiệm thu (từ design mục 13):** ghi tối thiểu 120 phút không mất phân đoạn đã hoàn tất; transcript hiện dần và ghi không dừng khi transcript chậm; tạm dừng, tiếp tục, đánh dấu, kết thúc hoạt động;
sau hoàn tất, cuộc họp là nguồn tìm kiếm/hỏi đáp/tóm tắt được; citation nhảy đúng timestamp trong audio; khởi động lại app giữa phiên vẫn phục hồi audio/transcript đã checkpoint; người dùng xem, xác nhận
hoặc đổi được ngôn ngữ transcript; lỗi quyền micro, mất thiết bị, đầy đĩa và lỗi transcript đều có trạng thái dễ hiểu, phục hồi được; chế độ local không gửi audio hoặc transcript ra ngoài.

**Ngoài phạm vi:** nhận diện/gán tên người nói, nhiều micro/kênh hoặc audio hệ thống, đồng bộ cloud, tóm tắt tự động khi cuộc họp chưa kết thúc, cộng tác sửa transcript, tự động phát audio khi mở citation
(xem C1 cần chốt), toàn bộ Pha D.

## Ambiguities to raise in /speckit-clarify

Đã loại (đã có quyết định ở "Đã chốt / kế thừa"): engine Whisper-transformers.js ở main cho nạp file; `iv-media://` + Range; badge 3 trạng thái và egress `model`; i18n; a11y theo mốc; migration append-only;
IPC whitelist; chỉ nguồn `ready` vào RAG/Studio. Còn lại — **10 mục BẮT BUỘC (A1–A10) theo yêu cầu chủ dự án**, **6 mâu thuẫn với quyết định/code/prototype hiện có (C1–C6)**, rồi **mơ hồ phát hiện thêm
(D1–D17)**. "Đề xuất" chỉ là gợi ý để thảo luận, KHÔNG phải quyết định.

### A. 10 câu clarify bắt buộc

**A1. Định dạng phân đoạn audio: WAV PCM 16 kHz vs Opus/WebM, và đường giải mã.** Dữ kiện: `audio-decode` + `resampleTo16k` có sẵn cho wav/mp3/flac/ogg; ffmpeg-static sẵn có (051) và giải mã được WebM; `MediaRecorder`
cho WebM/Opus nhỏ (~vài MB/giờ) nhưng chunk theo `timeslice` KHÔNG tự giải mã độc lập (chỉ chunk đầu có header), dừng-bật recorder mỗi phân đoạn sinh khoảng hở mẫu, và WebM do MediaRecorder thường thiếu
duration/cues ⇒ seek kém khi phát qua `<audio>` (cần xác minh). WAV PCM16 16 kHz mono ≈ 115 MB/giờ (≈ 230 MB/2 giờ), phân đoạn độc lập tầm thường, seek chuẩn, nhưng đòi renderer tạo PCM (AudioWorklet) và
mất lợi thế nén. Phụ: có lưu mẫu gốc 44.1/48 kHz hay giảm 16 kHz ngay tại nguồn; stereo/mono; **phát lại sau hoàn tất = ghép thành 1 file hay playlist nhiều file** (`iv-media` hiện lấy MỘT path từ `origin`; ghép
WAV chỉ là nối dữ liệu + sửa header); thêm MIME `audio/wav`/`audio/webm` vào `media-range.ts`. **Đề xuất:** WAV PCM16 16k mono, ghi tăng dần (xem D9), ghép 1 file khi hoàn tất — cần spike xác nhận AudioContext 16 kHz trên Chromium của Electron hiện dùng.

**A2. Model NHÁP vs CHỐT; khả thi real-time trên CPU.** Dữ kiện: chỉ `Xenova/whisper-base` (045), chạy cả file; ADR 045 nói "đổi small/tiny ở Settings sau" — chưa có bằng chứng đã làm (plan xác minh). **Chưa có
số đo RTF (real-time factor)** trên máy mục tiêu (Mac Apple Silicon, Windows CPU-only không GPU). Cần chốt: nháp dùng `tiny`/`base`/`base` quantized? bản chốt dùng `small`/`base` bằng cách tái nhận dạng toàn bộ
hay chỉ làm lại vùng kém? Nếu bản chốt = `small` trên 2 giờ audio, thời gian hoàn tất có thể dài (chưa đo) ⇒ cần tiến độ và trần chờ chấp nhận được; **tải 2 model = 2 lần egress `model`** (103) và dung lượng
data dir. Tiêu chí quyết định phải là số đo từ spike (RTF nháp < 1 trên máy yếu nhất được hỗ trợ?) chứ không đoán. Nếu nháp không kịp: giảm tần suất, hạ model, hay chấp nhận độ trễ lớn hơn "vài giây" của design
mục 4 (độ trễ mục tiêu là "mục tiêu" hay cam kết?). Phụ: chất lượng tiếng Việt của model nhỏ; ảo giác (hallucination) trên đoạn im lặng — có cần VAD/ngưỡng năng lượng (D17).

**A3. ASR nháp chạy ở đâu: main in-process vs `utilityProcess`/worker.** Dữ kiện: `transcribe.ts` chạy trong main; tiền/hậu xử lý JS và nhận/ghi file audio ở main cùng event loop ⇒ ASR nháp kéo dài làm trễ IPC, tiến độ,
ghi phân đoạn (rủi ro vi phạm "audio vẫn tiếp tục được ghi khi transcript chậm"). Phương án: (i) giữ trong main nhưng hàng đợi riêng + nhường (yield) giữa các cửa sổ — rẻ, rủi ro; (ii) `utilityProcess`
(Electron) hoặc `worker_threads` chứa pipeline ASR, main chỉ điều phối — cô lập, nhưng cần nạp lại model trong tiến trình con (RAM gấp đôi nếu bản chốt vẫn ở main), đóng gói `asarUnpack`/đường dẫn model, và
đặt `setOnline(model)` đúng; (iii) tiến trình ASR chung cho nháp + chốt. Phụ: **ghi file phân đoạn PHẢI tách khỏi đường ASR** (một lỗi/treo ASR không được chặn ghi); tranh CPU với Ollama chat, embedding
(in-process e5), reranker khi người dùng hỏi đáp lúc đang họp; đặt ưu tiên.

**A4. Renderer đẩy audio mic về main bằng cách nào.** Dữ kiện: `getUserMedia` chỉ có ở renderer (sandbox, không FS). Phương án: (i) `MediaRecorder` (WebM/Opus, gửi Blob theo timeslice) — đơn giản, kéo theo vấn đề định dạng A1;
(ii) `AudioWorklet` lấy PCM Float32/Int16, gom lô ~0.5–1 s, gửi `ArrayBuffer` qua IPC (preload `contextBridge` — kênh whitelist, payload nhị phân; ~32 KB/s ở 16 kHz mono PCM16, nhỏ) — kiểm soát chính xác mẫu/phân
đoạn, đòi worklet nạp từ tệp bundle (CSP `script-src 'self'`, không `blob:`), (iii) `MessagePort` chuyển thẳng renderer→main. Phụ: backpressure khi main bận (đệm phía renderer có trần, không rớt âm thầm); thứ
tự/gói mất (số thứ tự lô); **nội dung audio đi renderer→main** có phù hợp Constitution III ("tài liệu & vector thô không đi qua renderer dưới dạng nội dung đầy đủ" — hướng đó là main→renderer; audio mic vốn
sinh ở renderer, không thể tránh) ⇒ nên ghi rõ vào ADR là ngoại lệ có chủ đích; main kiểm kích thước/định dạng/tần suất lô từ renderer; meter âm lượng tính ở renderer (không cần IPC).

**A5. Quyền microphone: session handler, macOS Info.plist/entitlements, Windows.** Dữ kiện: `installSecurity` từ chối mọi quyền (sự kiện #8); `electron-builder.yml` chưa có `mac.extendInfo.NSMicrophoneUsageDescription`
hay entitlements; build mac hiện unsigned (`identity: null`). Cần chốt: (1) handler chỉ cấp `media` khi `mediaTypes` chỉ có `audio` (không `video`), đúng origin của app, và đúng lúc người dùng bấm Bắt đầu —
vẫn từ chối mọi quyền khác (camera, geo…); `setPermissionCheckHandler` tương tự; (2) macOS gọi `systemPreferences.getMediaAccessStatus/askForMediaAccess('microphone')` ở main trước khi mở stream; xử lý trạng thái
`denied/restricted` → hướng dẫn mở System Settings (không tạo nguồn rỗng); (3) thêm `NSMicrophoneUsageDescription` (chuỗi đa ngôn ngữ vi/en?) vào `extendInfo`; `com.apple.security.device.audio-input` chỉ cần khi
bật hardened runtime/ký — pha code-sign để sau nhưng **không được hỏng khi ký sau này**; chế độ DEV (Electron.app) dùng Info.plist riêng; (4) Windows: không có hộp thoại xin quyền của Electron, nhưng có công tắc
riêng tư micro của OS — phát hiện bằng `getMediaAccessStatus` (Win10+) hoặc lỗi `NotAllowedError`/`NotFoundError`; (5) cần cập nhật comment/ADR của `installSecurity` (hiện ghi "không cần mic") và test
`installSecurity`. Đây là thay đổi phạm vi bảo mật ⇒ **bắt buộc security-reviewer**.

**A6. Phím tắt cấu hình được: phạm vi (toàn cục vs trong app) và có làm ở v1 không.** Dữ kiện: chưa có hạ tầng phím tắt (sự kiện #11). Design mục 10 liệt kê phím tắt cho tạm dừng/tiếp tục, đánh dấu, kết thúc ghi
như yêu cầu a11y. Phương án: (i) chỉ phím tắt khi cửa sổ app có focus (renderer `keydown`, `aria-keyshortcuts`) — an toàn, nhưng khi họp người dùng thường đang ở app khác; (ii) `globalShortcut` ở main —
hữu ích lúc họp nhưng xung đột phím với app khác/OS, macOS cần đăng ký đúng, phải huỷ khi kết thúc phiên, và cần quyết định có yêu cầu quyền Accessibility không; (iii) hoãn "cấu hình được" sang pha sau, v1 chỉ
mặc định cố định. Phụ: UI cấu hình ở Settings; phát hiện trùng; lưu ở electron-store (đi theo sao lưu 085 "config"?); `Kết thúc ghi` bằng phím tắt có cần xác nhận không; thuộc Pha nào.

**A7. Ngưỡng cảnh báo dung lượng đĩa.** Dữ kiện: có `freeBytes` (statfs) ở main; chưa có ngưỡng. Phương án: ngưỡng tuyệt đối (ví dụ còn < X GB), hoặc theo **thời gian ghi còn lại ước tính** = freeBytes / tốc độ ghi
(WAV 16k mono ≈ 1,9 MB/phút ⇒ tính được), hoặc kết hợp (cảnh báo sớm + cảnh báo khẩn + dừng an toàn). Cần dự phòng chỗ cho **bước chốt** (file ghép 1 + vector + DB, có thể ≥ 1× dữ liệu ghi) — theo tiền lệ bảo
trì vector `freeBytes ≥ 2×`. Tần suất kiểm (mỗi phân đoạn đóng hay mỗi N giây); khi đầy đĩa thật: đóng phân đoạn hiện tại an toàn, dừng ghi, giữ dữ liệu, đưa vào luồng "hoàn tất phiên" (design mục 5).
Ổ đĩa của data dir có thể khác ổ cài app. Ngưỡng nên là hằng số một chỗ để chỉnh.

**A8. Mô hình dữ liệu nguồn cuộc họp: `SourceKind` mới `meeting` vs giữ `audio` + metadata.** Dữ kiện: `SourceKind` hiện 8 giá trị; `SIZE_LIMITS: Record<SourceKind,…>`, `detectKindFromPath`, handler `iv-media`
(`kind !== "audio"` → 404), `SourceViewer` (`content.kind === "audio"`), Studio/search đều rẽ theo `kind`. CHECK `kind` ở DB đã bỏ (v5) nên `meeting` không cần rebuild. Phương án: (i) `kind = "meeting"` — tách
bạch vòng đời (xoá file app sở hữu, không relink 101, không "tham chiếu file gốc"), nhưng phải sửa mọi nơi rẽ theo `audio` (iv-media, viewer, MIME, thống kê); (ii) giữ `kind = "audio"` + bảng
`meeting_session` (khoá `source_id`, UNIQUE) chứa metadata (thiết bị, ngôn ngữ, thời gian, danh sách phân đoạn, trạng thái phiên) + cờ "app sở hữu audio" — ít thay đổi code audio, nhưng cần phân biệt ở mọi nơi xoá/
relink/backup. Phụ: lưu `duration` ở đâu (`Source` chưa có trường); đánh dấu (markers), transcript timeMap mịn (D3) và checkpoint nháp (D9) lưu ở đâu (bảng riêng vs JSONL cạnh phân đoạn); khi nào tạo hàng `source`
(lúc Bắt đầu ghi — để khôi phục có chỗ bám — hay lúc Kết thúc; design: "không tạo nguồn rỗng" khi từ chối quyền ⇒ chỉ tạo SAU khi mic mở được); `origin` NOT NULL và `content_hash` NOT NULL (dedup theo notebook) cần
giá trị hợp lý cho meeting. Migration ≥ v12 (v11 đã dùng).

**A9. Trạng thái "Đang hoàn tất" so với `queued/processing/awaiting_embedding/ready/error`.** Dữ kiện: bảng `source` có CHECK 5 trạng thái; thêm giá trị = rebuild bảng (rủi ro như v5: backup chunk, cascade).
`ready` không có đường ra. Phương án: (i) ánh xạ "Đang hoàn tất" = `processing` + pha riêng (tiến độ `IngestStep` + trường phụ ở `meeting_session`), renderer hiển thị nhãn riêng — không đổi CHECK; (ii) thêm
`finalizing` (và có thể `recording`) vào `SourceStatus` + migration rebuild `source`; ảnh hưởng `canTransition`, `.stat` ánh xạ (`proc`), mọi switch trạng thái, `source:progress`. Phụ: **nguồn đang GHI có hiện trong danh
sách Nguồn không, trạng thái gì** (`recording`?); **"giữ lại bản ghi như một nguồn chưa hoàn thiện"** (design mục 5) là trạng thái nào — `error` + mã mới (`meetingIncomplete`, retry được) hay `ready` với 0 chunk
(tiền lệ 051: video không tiếng ⇒ ready 0 chunk, vẫn xem/nghe được)? Ảnh hưởng Studio (chỉ `ready`) và `studioSourceNotReady`.

**A10. Thoát app giữa chừng finalize (và giữa chừng ghi).** Dữ kiện: hàng đợi tuần tự nằm RAM; `resumeInterrupted()` đánh `queued/processing` ⇒ `error: interrupted` lúc khởi động; "Thử lại" hiện tại chạy lại
từ `origin` (một file). Với meeting, finalize có thể kéo dài hàng chục phút ⇒ cần: (a) finalize **idempotent & có checkpoint theo phân đoạn** (ASR chốt từng phân đoạn, lưu kết quả trung gian bền) để mở lại
không làm lại từ đầu; (b) `resumeInterrupted` phải **không** coi nguồn meeting đang finalize là lỗi thường mà đưa vào luồng "Phục hồi" (D9) hoặc tự tiếp tục; (c) khi người dùng thoát app (Cmd+Q, đóng cửa sổ Win,
tắt máy): đang GHI ⇒ chặn/xác nhận ("đang ghi, thoát sẽ kết thúc phiên?"), đóng phân đoạn hiện tại an toàn trong `before-quit`; đang FINALIZE ⇒ hỏi tiếp tục chạy hay thoát (sẽ tiếp tục lần mở sau); macOS đóng cửa
sổ không thoát (`window-all-closed`) — ghi có tiếp tục không; (d) hiện chỉ có `will-quit` → `endSession`; chưa có `before-quit` xác nhận; (e) `app.exit` ở restore-swap đã tránh `will-quit` — phiên ghi phải bị chặn
trước đó (D8).

### B. Mâu thuẫn với quyết định/code/prototype hiện có (cần ghi ADR bổ sung, không sửa file cũ)

**C1. Citation: "mặc định chỉ tua" ≠ 049 "tua rồi TỰ PHÁT".** Design mục 8: "Mặc định chỉ tua đến vị trí; tự phát audio là tùy chọn người dùng"; mục 11: "Tự động phát audio khi mở citation" ngoài phạm vi v1.
Nhưng ADR 049 #3 + code (`SourceViewer.tsx`): `audio.currentTime = tStart` rồi `play()`. Cần chốt: chỉ áp cho nguồn meeting hay đổi hành vi cho MỌI audio/video (051)? "Tuỳ chọn người dùng" nằm ở
đâu (Settings, nút trong player)? Mặc định mới có thay thế một phần ADR 049 #3 không (cần ADR bổ sung)?

**C2. "≥ 120 phút" ≠ `SIZE_LIMITS.audio = 200 MB` + đường nạp đọc cả file vào RAM.** 120 phút WAV16k ≈ 230 MB (> 200 MB); `readFile` + `audio-decode` ra `Float32Array` 16 kHz 2 giờ ≈ 460 MB + bản sao
(giải mã/resample) — nguy cơ OOM; transcribe một lần cho 2 giờ không có tiến độ mịn/ngắt/khôi phục. Cần chốt: nguồn meeting **không đi qua `readFile`+`assertWithinLimit` kiểu cũ** (chỉ đường mới theo
phân đoạn: giải mã/ASR từng phân đoạn + nối `timeMap` với offset) hay nâng giới hạn; trần thời lượng tối đa có không (design chỉ nêu "tối thiểu 120 phút"); chi phí finalize theo thời lượng.

**C3. 049 "tham chiếu file gốc, KHÔNG copy" ≠ audio meeting do app sở hữu trong data dir.** Hệ quả cần chốt: nơi lưu (`<userData>/meetings/<sessionId>/…`); **xoá nguồn ⇒ xoá file** (nguồn audio thường thì không);
sao lưu 085 hiện **không** gồm "file gốc/models" — audio meeting là dữ liệu khó tái tạo duy nhất, có đưa vào `.ivbackup` (kích thước lớn) hay loại và cảnh báo; khôi phục vault có làm mất audio không;
`source:relink` (101) không áp dụng; thông báo lỗi 049 "file có thể đã bị xoá/di chuyển" cần câu khác cho meeting; dedup `content_hash`; quyền thư mục (không lộ path ra renderer).

**C4. "Tác vụ chạy nền" + "Phục hồi" ≠ hàng đợi tuần tự RAM + `resumeInterrupted`.** (Gộp với A10.) Thêm: hàng đợi nạp là **tuần tự 1 nguồn/lần** — một finalize dài khoá mọi nguồn khác trong notebook/app
(người dùng thêm PDF trong lúc finalize sẽ chờ); cần chốt có làn riêng/ưu tiên không. Và ghi âm đang chạy có làm `isVaultBusy` ⇒ chặn bảo trì vector không (D8).

**C5. UI mới không có trong OVERVIEW/prototype.** Ghi âm trực tiếp không nằm trong OVERVIEW §5 (chỉ "nạp file") và prototype (modal Thêm nguồn chỉ có Tệp/URL/Audio-Video/Hình ảnh). Xác nhận đây là mở rộng
phạm vi sản phẩm có chủ đích (không vi phạm "Ngoài phạm vi v1" §7) và rằng prototype không cần sửa (rule: không sửa `docs/03-ui`). Vị trí nút `Ghi cuộc họp` ("cạnh nút thêm nguồn"): cột Nguồn
(262 px, nút `+` dạng icon) hay thanh notebook? Cột hẹp + chuỗi English dài hơn — cần phương án bố cục (menu tách `+`? hai nút?).

**C6. Thông điệp riêng tư "Âm thanh và transcript được xử lý trên máy này." vs badge toàn cục.** Câu đúng cho STT (luôn local, v1 không có STT online) nhưng nếu người dùng đã bật AI online thì badge ở header
là `online` và về sau transcript có thể vào chat/Studio online. Chốt: câu trong hộp bắt đầu chỉ nói về GHI + NHẬN DẠNG; có thêm dòng/phụ chú khi provider online đang bật; khi cần tải model lần đầu hiển thị
badge `sending/model` + nhãn "cần Internet lần đầu" (103) ngay trong hộp bắt đầu hay trong màn ghi.

### C. Mơ hồ phát hiện thêm

**D1. Gán chức năng vào pha.** Design chỉ mô tả A/B/C ở mức một dòng; nhiều tính năng chưa được gán: tạm dừng/tiếp tục, đánh dấu, phím tắt, meter âm lượng, màn hoàn tất (sửa tiêu đề, "Mở khi hoàn tất"), trình xem
cuộc họp (đồng bộ highlight, tìm, danh sách đánh dấu, copy/xuất Markdown), cảnh báo quyền micro. Cần bảng gán rõ để mỗi PR ship được: ví dụ Pha A có cần pause/marker hay đẩy sang B? Pha A "xử lý transcript sau khi
dừng" — trình xem cuộc họp tối thiểu nằm ở A?

**D2. Trục thời gian.** Mốc `01:18:42` và đồng hồ `01:42:18` là **thời gian audio đã thu (loại trừ khoảng tạm dừng)** hay thời gian trôi thực (wall clock)? `Locator.tStart/tEnd` phải là vị trí trong file audio
phát lại (giây) — nên là thời gian audio. Khoảng ngừng biểu thị thế nào: một dòng đánh dấu trong UI (metadata) hay ký tự trong văn bản transcript? **Nếu là ký tự thì nó đi vào chunk/embedding/RAG** (nhiễu);
đề xuất để là metadata, không vào văn bản lập chỉ mục — cần chốt vì ảnh hưởng timeMap (D3).

**D3. Bản đồ char↔time bền và độ mịn (Constitution II).** Hiện chỉ lưu `t_start/t_end` theo chunk (~1000 ký tự) — quá thô cho "đoạn đang phát được tô sáng" và "bấm transcript để tua đúng timestamp". Cần lưu
bản đồ mức câu/segment Whisper (bảng mới hoặc JSON) và mở rộng `SourceContent`/IPC (`source:getContent`) để mang nó; xác định offset ký tự **trước khi** chunk (cấm ước lượng lại locator sau chunk); `cleanText`
(cleaning) có làm lệch offset không (045 đã xử lý — kiểm lại với văn bản ghép nhiều phân đoạn).

**D4. Đánh dấu (`Quyết định`/`Việc cần làm`/`Câu hỏi`).** (1) Neo theo **thời gian** (tStart/tEnd) chứ không theo offset ký tự của transcript NHÁP (bản chốt sẽ khác ⇒ offset nháp vô hiệu); bôi chọn trên nháp → quy về
khoảng thời gian; sau chốt ánh xạ sang char-range qua timeMap. (2) Có thêm nhãn tự do/ghi chú không (design: ba nhãn cố định). (3) Có vào chỉ mục/RAG/Studio không (design: chỉ "danh sách đánh dấu"; đề xuất không
vào chỉ mục ở v1). (4) Có xuất trong Markdown. (5) Sửa/xoá đánh dấu sau khi hoàn tất. (6) Đánh dấu khi đang tạm dừng.

**D5. Bản chốt: tái nhận dạng hay hợp nhất.** "Ghép các phân đoạn, xử lý ranh giới giữa chúng, cải thiện transcript nháp": (i) chạy lại ASR toàn bộ audio (xử lý ranh giới bằng cửa sổ chồng lấn/stride), (ii) chỉ
vá vùng ranh giới và giữ nháp, (iii) hợp nhất theo ngữ cảnh. Bộ nhớ: không nạp 2 giờ Float32 một lần (xem C2). **Nếu bản chốt thất bại (hoặc model chốt chưa tải được khi offline)** có "thăng cấp" nháp thành
transcript cuối (mất chất lượng, vẫn có timeMap) hay giữ trạng thái lỗi + audio an toàn + "Thử lại"? (design mục 13: lỗi transcript phải "phục hồi được"). Nếu nháp được dùng làm chốt: nhãn chất lượng?

**D6. Ngôn ngữ: ngữ nghĩa `Tự động` vs `Đa ngôn ngữ`; phát hiện; gợi ý đổi.** (1) `Tự động` = phát hiện ở 20–30 s đầu rồi **khoá** và chỉ đánh giá lại ở cửa sổ 1–2 phút; `Đa ngôn ngữ` = không khoá,
phát hiện theo từng cửa sổ 30 s của Whisper? (Whisper không có chế độ code-switch thật; cần nêu giới hạn chất lượng). (2) Pipeline transformers.js hiện không trả ngôn ngữ phát hiện (chưa xác minh) — cách
lấy: `generate` trực tiếp/`language: null` + parse token, hay chạy bước phát hiện riêng. (3) Gợi ý "Chuyển transcript sang English?" dựa trên tiêu chí nào (tỉ lệ cửa sổ, ngưỡng tin cậy); chấp nhận ⇒ chỉ áp từ thời điểm
đó hay làm lại phần đã nhận dạng (ảnh hưởng nháp đã hiển thị và bản chốt)? (4) Người dùng đổi ngôn ngữ giữa chừng: áp cho nháp mới; bản chốt dùng ngôn ngữ cuối hay theo từng khoảng. (5) Danh sách ngôn ngữ chỉ vi/en?

**D7. Vòng đời nơi chụp mic (renderer) và hệ điều hành.** Capture sống ở renderer: điều hướng khỏi màn ghi (đổi notebook/route), reload/crash renderer (ErrorBoundary 088), đóng cửa sổ đều có thể dừng mic.
Cần: thành phần ghi nằm trên router (provider cấp app) hay cửa sổ ẩn; ghi tiếp khi người dùng xem notebook khác (thanh trạng thái ghi toàn cục + quay về màn ghi); hành vi khi renderer chết (main đóng phân đoạn,
đánh dấu phiên "bị gián đoạn"); **ngủ máy/khoá màn hình** (dùng `powerSaveBlocker('prevent-app-suspension')` trong lúc ghi? hiển thị khoảng trống); chỉ một phiên ghi cùng lúc (đa cửa sổ?).

**D8. Cô lập với các hệ thống khác.** (1) `vaultLock`/sao lưu/khôi phục: phiên ghi phải chặn khôi phục (khởi động lại hoán đổi) và có thể làm sao lưu chờ; "phiên ghi đang mở" có tính `isVaultBusy` cho bảo trì vector
không (116). (2) Thêm/xoá nguồn/notebook trong lúc ghi: xoá notebook đích đang ghi ⇒ chặn. (3) Chia sẻ một `Transcriber` (một `pipePromise`) giữa nháp, chốt và nạp audio khác: song song hay tuần tự; trần RAM của
nhiều session ONNX. (4) Tranh CPU với Ollama/embedding khi người dùng chat lúc họp.

**D9. Khôi phục sau sự cố (Pha C).** (1) Thiết kế chỉ cam kết "phân đoạn đã đóng còn nguyên"; phân đoạn đang mở (tối đa 5–10 phút) có mất không? Phương án: ghi PCM **tăng dần + fsync định kỳ** vào tệp,
sửa header WAV khi khôi phục (độ dài suy từ kích thước tệp) ⇒ mất ≤ vài giây; hay chấp nhận mất. (2) Checkpoint gồm gì: danh sách phân đoạn, vị trí ASR đã xử lý, transcript nháp (JSONL), đánh dấu, cài đặt phiên;
ghi nguyên tử (tmp→rename). (3) Thẻ `Phục hồi cuộc họp chưa hoàn tất` hiện ở đâu (notebook chứa nó, trang Notebooks, hay cả hai); nhiều phiên dang dở; "Tiếp tục hoàn tất transcript" vs "Giữ như nguồn chưa hoàn thiện"
vs thêm "Bỏ phiên (xoá audio)" có xác nhận; (4) phiên bị bỏ lâu ngày chiếm đĩa; (5) phiên dang dở có tính vào số nguồn notebook không; (6) tiếp tục GHI (không chỉ hoàn tất) sau sự cố có nằm trong v1 không
(design nói "tiếp tục hoàn tất transcript", không nói ghi tiếp).

**D10. Lỗi thiết bị giữa phiên.** Mất mic/rút tai nghe/đổi thiết bị mặc định (sample rate đổi, đặc biệt Bluetooth): cho phép **chọn thiết bị khác và tiếp tục CÙNG phiên** (khoảng trống được ghi nhận như khoảng ngừng) hay
bắt buộc kết thúc phiên? Phát hiện qua `track.onended`/`devicechange`. Mất quyền giữa chừng (macOS đổi trong Settings).

**D11. Tạm dừng có thực sự tắt mic không.** Để "Đã tạm dừng — không thu âm" đúng sự thật và chỉ báo mic của OS (chấm cam macOS) tắt: dừng track hay chỉ bỏ mẫu? Dừng track ⇒ lúc tiếp tục có thể mất thời gian
mở lại/xin lại quyền; chỉ bỏ mẫu ⇒ mic vẫn "mở" (đối chọi với "luôn hiển thị rõ mic có đang hoạt động không", Constitution I tinh thần). Khoảng ngừng tính vào thời lượng không.

**D12. Phạm vi tính năng của trình xem.** Tìm toàn văn *trong transcript*, bấm đoạn để tua, tô sáng đoạn đang phát, sao chép, xuất Markdown: chỉ cho `meeting` hay mọi audio/video (051)? Xuất `.md` cần IPC mới
(save dialog ở main, theo mẫu `studio:export` 025, `sanitizeName`); nội dung xuất gồm tiêu đề, metadata, đánh dấu, timestamp? Tìm trong nguồn đã có `source:search` (073) ở mức notebook — "tìm trong viewer" là chức
năng mới ở mức nguồn.

**D13. Nền tảng & đóng gói.** Windows (NSIS, không ký): quyền mic OS, driver; mac DEV vs bản đóng gói; `asarUnpack` nếu ASR chuyển sang `utilityProcess`/worker; kích thước bundle khi thêm model thứ hai (model tải
runtime, không đóng gói); đa nền tảng cho `globalShortcut`.

**D14. Chiến lược kiểm thử (Constitution IV).** Hàm thuần: ghép phân đoạn + offset timeMap, tính thời lượng/khoảng ngừng, ngưỡng đĩa, máy trạng thái phiên (idle→recording⇄paused→stopping→finalizing→ready/error;
recovery), ánh xạ đánh dấu thời gian→char-range, sửa header WAV. E2E: không có mic thật ⇒ cần seam giả (theo tiền lệ `IV_EMBED_FAKE`/`IV_RERANK_FAKE`, chỉ khi app chưa đóng gói) hoặc cờ Chromium
`--use-fake-device-for-media-stream --use-file-for-fake-audio-capture`; **120+ phút** không chạy được trong CI thường ⇒ "soak" tăng tốc (nguồn giả nhanh + phân đoạn ngắn) và kịch bản bấm tay trước phát hành;
ASR giả (trả segments xác định) để test UI nháp→chốt không nhấp nháy.

**D15. Chi tiết UX còn trống.** Ngưỡng "phiên dài" cần xác nhận khi `Kết thúc ghi` (design: "cho phiên dài" — bao nhiêu phút?); ý nghĩa `Mở khi hoàn tất` (thông báo trong app khi xong rồi mở? tự mở?); tên mặc định
theo locale (`Cuộc họp 12/10, 14:30` vi vs en) lưu như chuỗi thường hay sinh lúc hiển thị; ghi nhớ lựa chọn mic/ngôn ngữ lần trước (lưu ở electron-store — có theo sao lưu không); sửa tiêu đề sau hoàn tất (đổi tên
nguồn đã có?); nhãn trạng thái tín hiệu có thang dB ngưỡng nào; thông báo hệ điều hành khi xong.

**D16. Tải model lần đầu và offline.** Nếu chưa có model và không có Internet: vẫn cho GHI (audio an toàn) nhưng không có nháp; chốt chờ đến khi có model? Tải trước (ở hộp bắt đầu/Settings) hay lazy lần đầu? Hai
model (nháp/chốt) tải khi nào. Badge `sending/model` suốt thời gian tải trong lúc đang họp có gây phân tâm không (103: báo thừa chấp nhận).

**D17. Chất lượng nhận dạng.** Whisper ảo giác trên đoạn im lặng/nhạc nền (lặp cụm từ); cần VAD hoặc ngưỡng năng lượng để bỏ đoạn im lặng khỏi ASR (cũng giảm tải CPU); tiếng ồn họp; micro xa. Cơ chế
"nháp được cập nhật tại chỗ" khi bản tốt hơn đến (định danh đoạn ổn định để diff không nhấp nháy).

(Tổng: 10 bắt buộc (A) + 6 mâu thuẫn (C) + 17 mơ hồ thêm (D) = **33 mục**.)

## Thuật ngữ mới (append vào glossary)

Đã tra `docs/00-glossary.md`: có `transcription` (Bóc băng), `timestamp (tStart/tEnd)`, `player`, `seek`, `source kind=video`, `chunking`, `Segment/Line` (PDF), `source status`, `sending`, `vault`, `announce`.
**Chưa có** các term dưới đây. **Cảnh báo va chạm tên:** "Phân đoạn" đã là `chunking` (dòng 47), `Segment` đã dùng cho cụm chữ PDF (112) và cho đoạn Whisper `Segment{text,tStart,tEnd}` trong
`audio-transcript.ts` ⇒ "phân đoạn audio" của design cần định danh code KHÁC (đề xuất `CaptureSegment`/`captureSegment`); thêm term mới là THÊM nên được làm ngay trong branch (rule 5), không sửa term cũ.

| 日本語 | Tiếng Việt (đề xuất)                                   | English (đề xuất, dùng trong code)                                              | Ghi chú                                                                                                                                                  |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —      | Ghi cuộc họp (tính năng)                               | meeting capture (`meeting-capture`)                                             | Slug feature 186; điểm vào "Ghi cuộc họp" cạnh "Thêm nguồn"                                                                                             |
| —      | Phiên ghi (một lần ghi từ Bắt đầu tới Hoàn tất)        | recording session (`MeetingSession`, `sessionId`)                               | Có vòng đời idle→recording⇄paused→stopping→finalizing→done/failed; khác "lượt" Studio và "phiên" (session) Electron                                      |
| —      | Phân đoạn ghi âm (tệp audio độc lập 5–10 phút)         | capture segment (`CaptureSegment`)                                              | KHÔNG nhầm `chunking` (dòng 47), `Segment` PDF (112) hay `Segment` Whisper (045); đơn vị khôi phục                                                      |
| —      | Transcript nháp                                        | draft transcript (`draftSegments`)                                              | Nhận dạng gần thời gian thực, có thể được thay; KHÔNG được dùng để trả lời/trích dẫn; chưa có locator chính thức                                         |
| —      | Transcript chốt                                        | final transcript (`finalTranscript`)                                            | Kết quả bước chốt sau Kết thúc; là văn bản chunk/embed/index và là cơ sở locator                                                                         |
| —      | Đánh dấu (ghim tại thời điểm cuộc họp)                 | marker (`MeetingMarker`, `kind`: `decision`/`actionItem`/`question`)            | Neo theo thời gian; nhãn `Quyết định`/`Việc cần làm`/`Câu hỏi`; KHÁC `highlight` (dòng 61, tô đoạn trích dẫn)                                           |
| —      | Khoảng ngừng (tạm dừng giữa phiên)                     | pause gap (`pauseGap`)                                                          | Khoảng không thu âm; biểu thị trong transcript/UI (cách lưu: xem D2)                                                                                     |
| —      | Đang hoàn tất (trạng thái nguồn cuộc họp)              | finalizing (`finalizing`)                                                       | Đang chốt transcript + lập chỉ mục; không phải lỗi; ánh xạ vào `source status` (xem A9)                                                                 |
| —      | Phục hồi cuộc họp chưa hoàn tất (thẻ)                  | meeting recovery (`MeetingRecoveryCard`, `unfinishedSession`)                   | Thẻ khi mở lại app sau sự cố                                                                                                                             |
| —      | Điểm kiểm (lưu trạng thái để khôi phục)                | checkpoint (`checkpoint`)                                                       | Nội dung chốt ở D9                                                                                                                                       |
| —      | Nguồn cuộc họp                                         | meeting source (`kind="meeting"` hoặc `audio` + metadata — chờ A8)              | Dạng audio + metadata (thiết bị, ngôn ngữ, phân đoạn, đánh dấu)                                                                                          |
| —      | Chế độ ngôn ngữ ghi (Tự động / Tiếng Việt / English / Đa ngôn ngữ) | recording language mode (`languageMode`: `auto`/`vi`/`en`/`multi`)  | `auto` phát hiện 20–30 s đầu rồi khoá; khác `uiLanguage` (123) và `outputLanguage`                                                                       |
| —      | Meter âm lượng (tín hiệu yếu / có tín hiệu / quá lớn)  | input level meter (`levelState`: `weak`/`ok`/`clipping`)                        | Tính ở renderer, a11y có nhãn chữ                                                                                                                        |
| —      | Cảnh báo dung lượng đĩa khi ghi                        | low disk warning (`diskWarning`)                                                | Ngưỡng chốt ở A7                                                                                                                                         |
| —      | Bản đồ ký tự ↔ thời gian (mức câu, lưu bền)            | transcript time map (`transcriptTimeMap`) — mở rộng ý `timeMap` (045, nay chỉ tạm) | Dùng cho đồng bộ highlight/tua; chốt ở D3                                                                                                                |

Ghi chú: gộp bớt khi append; không đổi tên term đã có. Nhãn UI English cần thống nhất theo quy ước 123 (đề xuất "Record meeting", "Draft", "Final transcript", "Finalizing…", "Marker").

## Đối chiếu constitution

- **I (Local-first, privacy indicator):** STT 100% cục bộ ở v1; không egress mới ngoài tải model (`model`, đã có). Luôn hiện rõ mic đang hoạt động (D11). Thông điệp riêng tư trong hộp bắt đầu phải khớp badge (C6).
- **II (Kiểm chứng được):** timestamp locator tạo ngay lúc chunk từ transcript CHỐT; **transcript nháp không được trích dẫn/trả lời** (design §9); đánh dấu neo theo thời gian, không tái ước lượng locator sau chunk
  (D3, D4); trích dẫn `[n]` → mở nguồn tại `tStart` (C1).
- **III (Biên bảo mật):** quyền mic chỉ `media`/audio, kênh IPC audio/phiên ghi whitelist ở `preload`+`CHANNELS`, main kiểm kích thước/tần suất lô và mọi id từ renderer, worklet từ tệp bundle (CSP), không log nội dung
  audio/transcript/đánh dấu, không lộ đường dẫn ra renderer. **BẮT BUỘC security-reviewer** (đổi `installSecurity`, kênh nhị phân renderer→main, file ghi trong data dir, quyền OS).
- **IV (Test-first):** TDD cho hàm thuần (D14); coverage ≥ 80% logic; I/O mic/ASR loại khỏi coverage như 045; e2e dùng seam giả; test canh `installSecurity`.
- **V (Phased Delivery):** hợp lệ (Pha 1 xong, 045/049/051/053 đã giao); nội bộ feature giao A→B→C, mỗi PR ship được.
- **Additional constraints:** i18n 123; source-of-truth (prototype không có UI này — C5); không đổi tech stack (ADR tech-stack) — nếu thêm dependency (vd tách worker, thư viện ghi WAV) ghi ADR; ADR clarify đề xuất tên
  `docs/04-decisions/2026-10-12-meeting-capture-clarify.md` + append `INDEX.md`, nêu rõ **bổ sung/thay thế một phần** ADR 049 #3 (tự phát khi mở citation, nếu C1 đổi), 049 #2 (tham chiếu không copy — chỉ cho audio
  người dùng nạp), 045 (giới hạn nạp một lần), cùng ghi chú `installSecurity`.

## Suggested constitution amendments

Không đề xuất sửa trực tiếp (mọi thay đổi constitution qua PR riêng được steward duyệt, rule 5). Cân nhắc về sau, KHÔNG bắt buộc ở #186:

1. Mục III hiện chỉ nói "tài liệu & vector thô không đi qua renderer" — nên làm rõ rằng **dữ liệu thiết bị phát sinh ở renderer (mic) được phép đi renderer→main qua IPC whitelist**, với điều kiện (a) quyền thiết
   bị chỉ cấp cho loại cần dùng (audio-only), đúng lúc người dùng khởi tạo, (b) main kiểm và ghi xuống đĩa, renderer không giữ bản sao dài hạn, (c) có chỉ báo luôn hiển thị khi thiết bị đang hoạt động.
2. Mục I: "**mọi tiến trình thu thập dữ liệu từ cảm biến/thiết bị (micro) MUST có chỉ báo luôn hiển thị và dừng thật sự (không chỉ ẩn) khi người dùng tạm dừng/kết thúc**".
3. Một dòng về dữ liệu do app sở hữu khó tái tạo (bản ghi âm): "**dữ liệu người dùng không thể tái tạo (ghi âm trực tiếp) MUST được ghi bền theo từng phần và không bị chặn bởi bước xử lý AI chậm**" — để các tính
   năng thu trực tiếp về sau (video, màn hình) theo cùng khuôn.
