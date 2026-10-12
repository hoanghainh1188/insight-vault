# Research — Meeting Capture (186)

Nguồn quyết định: `docs/04-decisions/2026-10-12-meeting-capture-clarify.md` (A1–A10, C1–C6, D1–D17). File này chỉ ghi **cách hiện thực** các quyết định đó trên code
hiện có (khảo sát 2026-10-12) và các điểm còn phải đo bằng spike. Mỗi mục: Decision · Rationale · Alternatives.

## R1 — Spike S1 (đầu PR A): thu PCM 16 kHz trong renderer sandbox, `file://`, CSP `script-src 'self'`

- **Decision**: `new AudioContext({ sampleRate: 16000 })` + `MediaStreamAudioSourceNode` + `AudioWorkletNode` nạp từ tệp worklet **được bundle cùng origin**
  (`src/renderer/features/meeting-capture/capture/pcm-worklet.ts`, nạp bằng `audioWorklet.addModule(new URL("./pcm-worklet.ts", import.meta.url))` — Vite xuất
  thành tệp riêng trong `out/renderer/assets/`). Worklet chuyển Float32 → Int16, gom **1 giây = 16 000 mẫu = 32 000 byte**, `port.postMessage(buffer, [buffer])`.
  Spike phải xác nhận trên Electron 43, bản **đóng gói** (`file://`, CSP PROD): (a) AudioContext chấp nhận 16 kHz và tự resample từ 44.1/48 kHz; (b)
  `addModule` từ `file://` không bị CSP/secure-context chặn; (c) đổi thiết bị Bluetooth (đổi tần số gốc) không làm lệch tốc độ.
- **Fallback nếu (a) thất bại**: AudioContext ở tần số gốc, worklet resample bằng thuật toán của `resampleTo16k` (tách hàm thuần dùng chung cho renderer qua
  `src/shared/audio/resample.ts`). **Fallback nếu (b) thất bại**: nạp worklet qua `iv-media`-style giao thức `iv-app://` chỉ phục vụ tệp worklet (thêm vào
  `script-src`), hoặc `ScriptProcessorNode` (deprecated nhưng không cần module). Kết quả spike ghi vào ADR thực thi (R16).
- **Rationale**: PCM cho phép phân đoạn độc lập và đếm mẫu chính xác (A1, A4). `MediaRecorder` loại vì A1.
- **Alternatives**: `MediaRecorder` WebM/Opus (loại — A1); `MessagePort` renderer→main trực tiếp (giữ làm tối ưu sau nếu IPC thường quá tải; 32 KB/s không cần).

## R2 — Spike S2 (cổng trước PR B): RTF và phát hiện ngôn ngữ

- **Đo**: bộ đo dev-only `tests/spike/asr-rtf.spike.ts` chạy bằng `npm run spike:asr` (`vitest run -c vitest.spike.config.ts`, khuôn của `eval:retrieval`; không đóng gói, không vào CI). Node của Electron 43 = Node 22 nên số đo đại diện cho `utilityProcess`; S1 xác nhận thêm một lần đo trong worker thật ở bản đóng gói; mỗi model × lượng tử hoá:
  `Xenova/whisper-tiny` (q8, fp32), `Xenova/whisper-base` (q8, fp32); audio mẫu tiếng Việt + English 10 phút (`tests/fixtures/meeting/`); đo RTF = thời gian xử
  lý / thời lượng audio, cửa sổ 10 s (nháp) và phân đoạn 5 phút (chốt). Máy: Mac Apple Silicon (M1 trở lên) + một máy Windows x64 chỉ CPU.
- **Quy tắc chọn (A2)**: nháp = model nhỏ nhất có RTF ≤ 0,5 trên máy yếu nhất; chốt = `Xenova/whisper-base` (đã có, `DEFAULT_WHISPER_MODEL`). Nếu không model nào
  đạt ≤ 0,5 ⇒ nháp dùng `tiny` q8 với chính sách bỏ cửa sổ (R6) và ghi rõ trong ADR spike; không chặn PR B.
- **Phát hiện ngôn ngữ**: pipeline ASR của transformers.js không trả ngôn ngữ. Cách đề xuất cho spike xác minh: dùng `AutoProcessor` + `WhisperForConditionalGeneration`
  của cùng model, chạy encoder + **một bước decoder** sau `<|startoftranscript|>`, lấy logits của token ngôn ngữ, **giới hạn trong {vi, en}** (UI v1 — D6), chọn argmax
  + độ tin cậy (softmax trên 2 token). Chi phí ≈ 1 lượt encoder/30 s audio. Nếu không khả thi ⇒ phương án dự phòng: chạy ASR 2 lần (`language: "vi"` và `"en"`) trên
  30 s và so điểm log-prob trung bình (đắt gấp đôi, chỉ 30 s đầu + mỗi 2 phút).
- **Kết quả**: ADR `docs/04-decisions/2026-10-xx-meeting-asr-spike.md` (+ INDEX) ghi số đo, model nháp được chọn, phương pháp phát hiện ngôn ngữ.

## R3 — Định dạng & ghi phân đoạn (A1, D9)

- **Decision**: mỗi phân đoạn ghi âm `seg-<NNNN>.wav` (PCM16, 16 kHz, mono) trong `<userData>/meetings/<sessionId>/`. Writer (main, I/O) mở tệp, ghi **header 44 byte
  với độ dài 0**, append PCM theo lô, `fsync` mỗi 5 s, **xoay tệp khi đủ 300 s audio (4 800 000 mẫu)** hoặc khi tạm dừng/kết thúc/mất thiết bị (phân đoạn ngắn hơn hợp
  lệ). Đóng phân đoạn ⇒ ghi lại header với độ dài đúng + `fsync` + cập nhật danh sách phân đoạn trong DB. Khôi phục: hàm thuần `repairWavHeader(fileSize)` tính độ dài
  từ kích thước tệp (cắt phần lẻ byte) ⇒ mất ≤ 5 s.
- **Ghép khi hoàn tất**: `meeting.wav` = header mới + nối dữ liệu các phân đoạn (stream, không nạp RAM); xoá phân đoạn **sau khi** nguồn `ready` (A1) — trước đó
  phân đoạn là nguồn khôi phục. Đường phát lại sau hoàn tất: `meeting.wav`.
- **Hàm thuần**: `buildWavHeader(dataBytes, rate, channels, bits)`, `repairWavHeader`, `segmentShouldRotate(samplesInSegment, limit)`.
- **Hằng số** (một chỗ, `meeting-constants.ts`): `SAMPLE_RATE=16000`, `SEGMENT_SEC=300` (override `IV_MEETING_SEGMENT_SEC` chỉ khi `!app.isPackaged` — R15),
  `FSYNC_SEC=5`, `CHECKPOINT_SEC=30`, `BATCH_MAX_BYTES=65536`, `RENDERER_BUFFER_SEC=30`, `BYTES_PER_MIN=1_920_000`.

## R4 — Đường audio renderer → main (A4, diễn giải Constitution III)

- **Decision**: kênh **send** `meeting:audio` (renderer→main, không phản hồi) payload `{ sessionId: string, seq: number, pcm: ArrayBuffer }` qua preload
  `meetingSendAudio(...)`. Main (`audio-ingress.ts`, hàm thuần `validateAudioBatch(state, msg)`) kiểm: `sessionId` = phiên đang hoạt động; đúng `sender` đã start;
  phase = `recording`; `pcm.byteLength` > 0, chẵn, ≤ 64 KB; `seq` = kỳ vọng (bỏ trùng; nhảy seq ⇒ ghi nhận khoảng mất như khoảng ngừng + đánh dấu lỗi nhẹ); tần
  suất ≤ 4 lô/s (thừa ⇒ bỏ + đếm). Không bao giờ log nội dung.
- Renderer đệm tối đa 30 s khi IPC trả chậm (không có backpressure thật với `send` — đệm nằm ở `mic-capture.ts` giữa worklet và preload, chỉ cần khi renderer bận);
  tràn ⇒ dừng ghi + trạng thái lỗi ghi (không rớt âm thầm).
- Meter âm lượng tính trong worklet (RMS + peak mỗi 100 ms) gửi qua `port` về UI; không qua IPC.
- **ADR**: ghi **diễn giải** Constitution III (không phải ngoại lệ): câu MUST cấm tài liệu/vector **đã lưu** đi main→renderer; audio micro là đầu vào sinh ở renderer nên đi renderer→main là đúng hướng của ranh giới, kèm các biện pháp kiểm soát trên; audio không bao giờ gửi ngược ra renderer (phát lại qua `iv-media`).

## R5 — Tiến trình ASR riêng (A3, C4, D8)

- **Decision**: `utilityProcess.fork(join(__dirname, "asr-worker.js"), [], { serviceName: "InsightVault ASR", stdio: "pipe" })` (entry thêm vào
  `electron.vite.config.ts` main `rollupOptions.input.asr-worker`). Main ↔ worker qua `postMessage` với giao thức có kiểu + kiểm (`asr-protocol.ts`, hàm thuần
  `parseWorkerMessage`): `init{cacheDir, draftModel, finalModel, fake}`, `draft{reqId, pcm, language|null, windowStartSec}`, `final{reqId, segmentPath, overlapPrevPath?,
  language|null}`, `detectLanguage{reqId, pcm}`, `cancel{reqId}`; phản hồi `result{reqId, segments}`, `language{reqId, lang, confidence}`, `progress{reqId, frac}`,
  `modelDownload{active}`, `error{reqId, code}`.
- Worker giữ **một** pipeline mỗi model, lazy; hàng việc **ưu tiên**: `detectLanguage` > `draft` > `final`. Worker đọc tệp phân đoạn **tự nó** (đường dẫn trong data dir do
  main cấp) để không chép 19 MB qua IPC.
- **Privacy**: worker không gọi `setEgressActive`; gửi `modelDownload{active}` ⇒ main gọi `setEgressActive(active, "model")` (103) — giữ đúng chỉ báo.
- **Cô lập lỗi**: worker `exit` bất thường ⇒ main fork lại (tối đa 3 lần/5 phút, sau đó transcript nháp tắt cho phiên đó + trạng thái "Đang xử lý bản ghi");
  **writer không phụ thuộc worker**.
- **Nạp audio file thường (045)** vẫn chạy in-process ở main — không đổi ở feature này (giảm phạm vi); có thể dồn sau.
- **Tranh CPU với Ollama/embedding (D8)**: chấp nhận; nháp tự bỏ cửa sổ (R6).
- **Đóng gói**: `asr-worker.js` nằm trong `out/main/`; transformers/onnxruntime đã đóng gói cho main nên worker dùng chung `node_modules` trong asar; kiểm tra spike S1
  bản đóng gói xem `onnxruntime-node` nạp được từ utilityProcess (nếu không ⇒ thêm `asarUnpack` cho `onnxruntime-node/**`).

## R6 — Lịch nháp & cập nhật tại chỗ (FR-019–FR-022, D17)

- **Decision**: cửa sổ nháp **10 s** liên tiếp không chồng (id ổn định `w<index>`). Hai lượt: tại 5 s gửi phần đầu ⇒ hiển thị `pending: true` ("Đang nhận dạng"); tại
  10 s gửi đủ cửa sổ ⇒ thay tại chỗ `pending: false`. Nếu RTF spike không cho phép ⇒ bỏ lượt 5 s.
- **Chính sách tồn đọng** (hàm thuần `planDraftQueue(pending, nowSec)`): tồn > 3 cửa sổ ⇒ bỏ các cửa sổ cũ nhất chưa xử lý (không hiển thị nháp cho chúng — bản chốt sẽ
  phủ) và bật cờ `transcriptLagging` ⇒ "Đang xử lý bản ghi — audio vẫn được lưu an toàn"; tắt cờ khi tồn ≤ 1.
- **VAD** (hàm thuần `isSpeechWindow(pcm, thresholdDbfs=-45, minSpeechRatio=0.1)`): cửa sổ im lặng không gửi ASR (nháp + chốt). **Khử ảo giác** (`dedupeHallucination`):
  bỏ segment rỗng/chỉ dấu câu; gộp cụm từ lặp ≥ 3 lần liên tiếp.
- **Renderer**: `mergeDraft(prev, incoming)` thuần, khoá theo id ⇒ React key ổn định, không unmount ⇒ không nhấp nháy; vùng chọn giữ nguyên vì DOM node được giữ.

## R7 — Ngôn ngữ (D6, FR-028–030)

- Hàm thuần `languagePolicy(state, event)` với event `detected{lang,confidence,atSec}` / `userLock{lang}` / `userAcceptSuggestion` / `userDismissSuggestion`:
  - `auto`: phát hiện trên 30 s có lời nói đầu tiên (gom cửa sổ VAD-speech) ⇒ `locked{lang, source:"auto"}`; mỗi 120 s đánh giá 30 s gần nhất; khác ngôn ngữ khoá
    với confidence ≥ 0,7 **2 lần liên tiếp** ⇒ `suggestion{lang}`; chấp nhận ⇒ thêm `languageChange{atSec, lang}`; từ chối ⇒ không gợi ý lại cho tới khi phát hiện
    ra ngôn ngữ thứ ba hoặc quay về rồi đổi lại.
  - `vi`/`en`/khoá tay ⇒ không phát hiện nữa.
  - `multi` ⇒ `language: null` mỗi cửa sổ (Whisper tự chọn); UI ghi chú giới hạn.
- Bản chốt: mỗi phân đoạn dùng ngôn ngữ hiệu lực tại thời điểm đầu phân đoạn theo `languageChanges` (phân đoạn cắt ngang thời điểm đổi ⇒ dùng ngôn ngữ chiếm phần lớn).

## R8 — Hoàn tất (A10, C2, C4, D5, FR-012, FR-035, FR-036)

- **Decision**: `finalize(sessionId)` trong `meeting-service`:
  1. phase `finalizing`; với mỗi phân đoạn chưa có `final/seg-NNNN.json`: gửi worker `final` kèm **5 s cuối của phân đoạn trước** làm ngữ cảnh chồng lấn; kết quả
     segment có `tStart` âm (thuộc phần chồng lấn) bị cắt bởi hàm thuần `stitchSegments(prevTail, current, overlapSec=5)`; ghi JSON nguyên tử (tmp→rename) = checkpoint.
  2. Đủ mọi phân đoạn ⇒ hàm thuần `buildMeetingTranscript(segmentsBySeg, segmentOffsets)` ⇒ `{ text, spans[], timeMap }` với thời gian **audio** tuyệt đối (offset
     phân đoạn = tổng thời lượng phân đoạn trước; khoảng ngừng không có trong text — D2). Văn bản nối segment bằng `\n` và đã trim ⇒ `cleanText` không đổi offset (test
     canh).
  3. Ghi `transcript_span` (một giao dịch) + ghép `meeting.wav` ⇒ `pipeline.ingestParsed(sourceId, { pages:[{page:null,text}], timeMap })` (**API mới**, R9) ⇒ hàng đợi
     chung chỉ làm chunk/embed/store (nhanh) ⇒ `ready`, phase `done`, xoá phân đoạn.
  4. Lỗi ASR chốt / thiếu model chốt ⇒ dùng nháp (`draft.jsonl`) qua cùng `buildMeetingTranscript` ⇒ `transcript_quality = "draft"` (D5); không có cả nháp ⇒ phase
     `incomplete` + `ready` 0 chunk (A9).
- Tiến độ hoàn tất phát qua **`source:progress` sẵn có** (`step: "parse"`, `progress` = phân đoạn xong / tổng × 0,8) — không cần kênh mới cho danh sách nguồn.
- Thời gian hoàn tất ước tính = RTF_chốt × thời lượng (vd RTF 0,3 ⇒ 2 giờ ≈ 36 phút) — chấp nhận vì chạy nền + checkpoint; ghi số thực đo vào ADR spike.

## R9 — Tích hợp pipeline nguồn

- **API mới** `IngestionPipeline.createMeetingSource({notebookId, title, sessionId}) → SourceSummary` (tạo hàng `source` `kind="meeting"`, `status="processing"`,
  `origin="meeting:<sessionId>"`, `content_hash = sha256("meeting:"+sessionId)`) và `ingestParsed(sourceId, parse: ParseResult)` (enqueue một task dùng lại phần
  chunk→embed→store của `processFull`, tách hàm nội bộ `indexParsed`). Không đi `readFile`/`assertWithinLimit` (C2).
- `resumeInterrupted()` **bỏ qua `kind = "meeting"`** (A10); `meeting-service.recoverOnStartup()` xử lý chúng.
- `retry` không áp dụng cho `meeting` (nút "Hoàn tất transcript"/"Chốt lại" thay thế).
- `remove(id)` với `meeting`: huỷ phiên/finalize nếu đang chạy ⇒ xoá vector + hàng (cascade `meeting_session`, `meeting_marker`, `transcript_span`) ⇒ `rm -r` thư mục phiên
  (FR-015).
- `SourceKind` thêm `"meeting"` (`src/shared/ipc/types.ts:224`); `SIZE_LIMITS` thêm `meeting: Infinity` (không dùng); `detectKindFromPath` **không** trả `meeting`
  (renderer không thể nạp tệp thành meeting).
- Danh sách nguồn: `SourceSummary.meetingPhase?: MeetingPhase` (LEFT JOIN `meeting_session` trong `listByNotebook`) ⇒ renderer gắn nhãn "Đang ghi" / "Đã tạm dừng" /
  "Đang hoàn tất" / "Chưa hoàn thiện" / "Transcript nháp" (A9).
- Tìm kiếm FTS / RAG / Studio: không đổi — chỉ chunk của nguồn `ready` (meeting đang ghi có 0 chunk và chưa `ready`).

## R10 — iv-media cho cuộc họp (FR-018, FR-023)

- `media-serve.ts` nhận thêm `kind === "meeting"`: đường dẫn **không** lấy từ `origin` mà từ `meetingFiles.resolvePlayback(sourceId)` (main):
  `meeting.wav` nếu đã ghép; nếu chưa (đang ghi/hoàn tất/chưa hoàn thiện) ⇒ dạng URL `iv-media://source/<id>?seg=<n>` phục vụ **một phân đoạn**; với phân đoạn đang mở,
  handler dựng header WAV theo kích thước hiện tại (`buildWavHeader`) và phục vụ header + dữ liệu đã `fsync`. Renderer quy đổi thời gian audio ⇒ (seg, offset) bằng hàm
  thuần `locateInSegments(segments, tSec)`. Path không bao giờ ra renderer.
- MIME `wav` đã có trong `MEDIA_MIME`.

## R11 — Quyền microphone (A5, FR-004)

- Tách `src/main/services/app-shell/permissions.ts` (thuần, có test): `decideMediaPermission({ permission, mediaTypes, requestingOrigin, isMainFrame, isMainWindow,
  armedUntil, now })` ⇒ `true` chỉ khi `permission === "media"`, `mediaTypes` ⊆ `["audio"]` và không rỗng, origin là renderer của app (`file://` bản đóng gói hoặc
  `ELECTRON_RENDERER_URL` khi dev), cửa sổ chính, `now < armedUntil`. `decidePermissionCheck` tương tự cho `setPermissionCheckHandler` (`"media"` + `mediaType ===
  "audio"`). `setDevicePermissionHandler` vẫn `false` (HID/USB/serial).
- **Cổng "armed"**: `meeting:prepare` (invoke khi người dùng bấm Bắt đầu) đặt `armedUntil = now + 15 s`; `meeting:resume` và đổi thiết bị cũng mở cổng. Ngoài cửa sổ
  này mọi yêu cầu media bị từ chối.
- macOS: trước khi renderer gọi `getUserMedia`, `meeting:prepare` gọi `systemPreferences.getMediaAccessStatus("microphone")`; `not-determined` ⇒
  `askForMediaAccess("microphone")`; `denied|restricted` ⇒ trả `micStatus: "denied"` ⇒ UI hướng dẫn System Settings, không tạo nguồn. Windows:
  `getMediaAccessStatus` (Win10+) + ánh xạ `NotAllowedError`/`NotFoundError` từ renderer.
- `electron-builder.yml`: `mac.extendInfo.NSMicrophoneUsageDescription` (English: "InsightVault records meetings you start, and processes the audio on this
  computer."); thêm `build/entitlements.mac.plist` có `com.apple.security.device.audio-input` + tham chiếu `entitlements`/`entitlementsInherit` (vô hại khi
  `identity: null`, sẵn sàng khi ký). Cập nhật comment `installSecurity` ("không cần mic" ⇒ "chỉ mic audio khi người dùng bắt đầu ghi — 186").

## R12 — Vòng đời, khôi phục, thoát app (A10, D7, D9, FR-032–FR-042)

- **PR A (tối thiểu an toàn)**: lúc khởi động, `recoverOnStartup()` sửa header phân đoạn mở, rồi **tự hoàn tất** mọi phiên `recording|paused|stopping|finalizing`
  (không có thẻ). Trong lúc chạy, `render-process-gone` hoặc không nhận lô > 5 s khi `recording` ⇒ đóng phân đoạn, tự kết thúc + hoàn tất. Phần thu âm sống trong
  `RecordingProvider` cấp app (phía trên router) ngay từ PR A nên điều hướng không dừng mic. Như vậy PR A không bao giờ để nguồn kẹt.
- **PR C1 (đầy đủ)**:
  - `session.json` checkpoint (thuần `serializeCheckpoint`/`parseCheckpoint` có kiểm; I/O ghi tmp→rename mỗi 30 s + khi đóng phân đoạn): phân đoạn, khoảng ngừng,
    trạng thái ngôn ngữ, đánh dấu, `draft.jsonl` offset. DB vẫn là nguồn sự thật cho metadata đã đóng; checkpoint phủ phần trong phân đoạn đang mở.
  - Phân loại lúc khởi động (thuần `classifyOnStartup(phase, endedByUser)`): phiên kết thúc bởi người dùng (kể cả thoát có xác nhận, `stopping`/`finalizing`) ⇒ tự hoàn tất;
    phiên `recording|paused|interrupted` không do người dùng kết thúc ⇒ **thẻ phục hồi** (Hoàn tất / Giữ chưa hoàn thiện / Xoá).
  - `before-quit` (mới, `index.ts`): đang ghi ⇒ `event.preventDefault()` + `dialog.showMessageBox` xác nhận (i18n main); đồng ý ⇒ `meetingService.stopForQuit()` (đóng
    phân đoạn, phase `stopping`, `endedByUser`) ⇒ `app.quit()` lại. Đóng cửa sổ chính khi đang ghi ⇒ cùng hộp thoại (`close` event).
  - `render-process-gone` / không có lô audio > 5 s khi phase `recording` ⇒ đóng phân đoạn, phase `interrupted`, push trạng thái (renderer mới gắn lại qua
    `meeting:status` hoặc thẻ phục hồi).
  - `powerSaveBlocker.start("prevent-app-suspension")` khi bắt đầu, **giữ suốt phiên** (kể cả lúc tạm dừng), `stop` khi kết thúc.
  - Mất thiết bị/quyền: renderer phát hiện `track.onended` / `devicechange` / lỗi ⇒ invoke `meeting:pause({reason:"deviceLost"})` ⇒ banner chọn thiết bị khác ⇒
    `meeting:resume({deviceLabel})` (khoảng mất = khoảng ngừng `reason: "deviceLost"`).
- **Một phiên duy nhất** và cửa sổ duy nhất gửi audio: main lưu `ownerWebContentsId`.

## R13 — Đĩa (A7, FR-040)

- Hàm thuần `diskLevel({ freeBytes, recordedBytes, bytesPerMin })` ⇒ `minutesRemaining = floor((freeBytes − (2 × recordedBytes + 500 MB)) / bytesPerMin)` ⇒
  `ok | warn(<30) | urgent(<5) | stop(<1)`; `canStart` khi ≥ 10. `freeBytes` qua `computeStorageInfo(dataDir, createFsOps())` (`storage-info.ts:48`) mỗi 30 s và khi
  đóng phân đoạn. `stop` ⇒ `meetingService.stop({reason:"diskFull"})` ⇒ màn hoàn tất.

## R14 — Sao lưu & khoá vault (C3, D8, FR-016, FR-042)

- `snapshot.ts`: thêm sao chép `meetings/` **chỉ các phiên `done`/`incomplete` + mọi phân đoạn hiện có** (bản sao lưu bị chặn khi đang ghi nên không có tệp đang mở);
  `restore-swap.ts` `VAULT_ITEMS` thêm `meetings`; schema guard nhận v12. Hộp sao lưu hiện thêm dòng "Ghi âm cuộc họp: N MB" (tính `dirSize`).
- Khoá: đang ghi/hoàn tất ⇒ nguồn `processing` ⇒ `hasActiveSources` đã làm vault **bận** ⇒ sao lưu/khôi phục bị chặn sẵn (FR-042). Bảo trì vector (116) dùng cùng
  `isVaultBusy` — D8 cho phép bảo trì khi đang ghi: tách `hasActiveSources({ excludeRecording })` cho riêng bảo trì vector (phiên đang ở phase `recording|paused` không
  tính; `finalizing` vẫn tính vì sắp ghi vector).
- Chặn xoá notebook đích đang ghi + bắt đầu phiên thứ hai: kiểm ở main (`notebook:delete` trả mã lỗi `meetingRecording`).

## R15 — Kiểm thử (D14, Constitution IV)

- **Seam giả (chỉ `!app.isPackaged`)**: `IV_ASR_FAKE=1` ⇒ worker dùng `fakeTranscriber` (thuần, `fake-asr.ts`): mỗi cửa sổ có tiếng ⇒ segment "đoạn <n>" với timestamp đúng
  cửa sổ, ngôn ngữ `vi`; `IV_MEETING_SEGMENT_SEC` (≥ 5) cho soak; `IV_MIC_FAKE` **không cần** — e2e dùng cờ Chromium.
- **E2E**: `electron.launch({ args: [main, "--user-data-dir=…", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
  "--use-file-for-fake-audio-capture=<tests/fixtures/meeting/speech-16k.wav>"] })` (helper mới `launchMeeting` trong `tests/e2e/helper.ts`). Spike S1 xác nhận cờ có
  hiệu lực khi truyền qua dòng lệnh Electron; nếu không ⇒ `app.commandLine.appendSwitch` khi `IV_E2E_FAKE_MIC` (unpackaged only).
- **Soak tăng tốc**: e2e `meeting-soak.spec.ts` với `IV_MEETING_SEGMENT_SEC=5`, ghi 120 phân đoạn giả bằng cách bơm lô qua seam `IV_E2E_AUDIO_PUMP` (main tự sinh lô PCM
  từ fixture nhanh gấp N lần, unpackaged only) — kiểm không mất phân đoạn, thời lượng khớp, khôi phục sau `kill`.
- **Unit (TDD)**: mọi hàm thuần liệt kê ở plan; coverage include các tệp thuần mới; exclude I/O (`capture-writer.ts`, `asr-worker.ts`, `asr-client.ts`, `mic-capture.ts`,
  `pcm-worklet.ts`, wiring `meeting-service` I/O phần fs).
- **Thủ công trước phát hành**: checklist 120 phút trong `quickstart.md` (mac + Windows).

## R16 — ADR bổ sung (mục (5) của yêu cầu plan)

Viết trong **PR A** (+ dòng INDEX):

1. `docs/04-decisions/2026-10-12-meeting-capture.md` (ADR thực thi):
   - **Thay 049 #3**: bấm `[n]` của mọi nguồn audio/video/meeting chỉ tua, không `play()` (`SourceViewer.tsx:105-106`).
   - **Ngoại lệ 049 #2 ("tham chiếu file gốc, không copy")**: audio cuộc họp do app sở hữu trong `<userData>/meetings/<sessionId>/`, xoá cùng nguồn, có trong sao lưu, không
     relink.
   - **Diễn giải Constitution III** (không phải ngoại lệ): luồng PCM micro renderer→main qua `meeting:audio` nằm ngoài câu MUST về tài liệu/vector thô đã lưu; biện pháp: kiểm ở main, không log, không gửi audio về renderer.
   - **Chính sách quyền**: `installSecurity` chỉ cấp `media` audio-only, cửa sổ chính, trong cổng 15 s sau hành động người dùng.
   - **utilityProcess ASR** cho meeting (nạp file 045 không đổi).
2. `docs/04-decisions/2026-10-xx-meeting-asr-spike.md` (sau spike S2, trước PR B): số đo RTF, model nháp, phương pháp phát hiện ngôn ngữ.

## R17 — Phím tắt (A6, FR-043) — PR C1

- Renderer `useMeetingShortcuts` gắn `keydown` ở `window` khi có phiên (không `globalShortcut`): `Mod+Shift+P|M|E` (Mod = Cmd trên mac, Ctrl trên Win; hàm thuần
  `matchShortcut(event, platform)`); bỏ qua khi focus ở ô nhập văn bản trừ `Mod+Shift` tổ hợp; `aria-keyshortcuts` trên nút; `E` chỉ mở hộp xác nhận.

## R18 — Trình xem cuộc họp & xuất (PR C2, D12, FR-044, FR-045)

- `meeting:getTranscript(sourceId)` ⇒ `{ spans, markers, pauseGaps, languageInfo, quality }` (text lấy từ `source:getContent` hiện có — không gửi hai lần).
- Thuần: `spanAtTime(spans, t)` (tìm nhị phân), `searchTranscript(text, query)` (fold dấu giống FTS — dùng lại hàm fold của 073), `markerExcerpt(text, spans, marker)`,
  `buildMeetingMarkdown(meta, text, spans, markers, gaps, tr)`.
- Xuất: `meeting:exportMarkdown(sourceId)` ⇒ tái dùng `exportMarkdown(win, content, suggestedName, tr)` (`studio/export.ts:15`) + `sanitizeName`; main dựng nội dung (renderer
  không gửi nội dung).
- Đổi tiêu đề: `meeting:rename({sourceId, title})` (chỉ `kind="meeting"`; kiểm 1–200 ký tự, trim) dùng `sourceRepo.setTitle`.
