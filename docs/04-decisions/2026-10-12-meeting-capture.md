# Meeting Capture — ADR thực thi (186)

> **Còn chờ** mục "Còn chờ (chạy tay)" của spike S1 (micro thật + Bluetooth trên mac, bản Windows). Các quyết định thực thi bên dưới đã chốt.

- Ngày: 2026-10-12
- Feature: `186-meeting-capture` (issue #186). Quyết định clarify: `2026-10-12-meeting-capture-clarify.md`. Plan/research:
  `specs/20261012-072338-meeting-capture/`.

## Kết quả spike S1 (T001, 2026-10-12)

Code spike: branch nháp `186-spike-s1` (commit `868a57e`, chỉ local, **không merge**) — màn `#/spike-s1`, kênh IPC tạm `spike:*`, worker
`spike-asr-worker`, bộ chạy `npx playwright test -c playwright.spike.config.ts` (đặt `IV_SPIKE_PACKAGED=<binary>` để chạy trên bản đóng gói).

Máy: macOS (Darwin 27), Apple Silicon, Electron 43.1.0 (Node **24.18.0**), bản dev (`out/`) và bản đóng gói `electron-builder --mac dir` (`app.asar`,
CSP PROD, `file://`).

| Điểm kiểm (research)                                                           | Dev                                                                                                                                                                 | Đóng gói mac                                                    | Kết luận                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) `new AudioContext({ sampleRate: 16000 })` (R1)                             | ✅ `sampleRate=16000`, worklet thấy `sampleRate=16000`                                                                                                              | ✅ như dev                                                      | Dùng trực tiếp, **không cần fallback** resample trong worklet                                                                                                                                                                                             |
| (b) `audioWorklet.addModule` dưới `file://` + CSP `script-src 'self'` (R1)     | ✅                                                                                                                                                                  | ✅ URL `…/app.asar/out/renderer/assets/spike-worklet-<hash>.js` | Nạp worklet bằng **`import url from "./pcm-worklet.ts?worker&url"`** (Vite biên dịch TS → tệp JS riêng cùng origin). KHÔNG dùng `new URL("./x.ts", import.meta.url)` (chỉ chép tệp thô, không biên dịch). Không cần `iv-app://` hay `ScriptProcessorNode` |
| Độ chính xác tốc độ mẫu (oscillator 440 Hz → WAV 16 kHz)                       | ✅ 879 lần qua 0/s (kỳ vọng 880)                                                                                                                                    | ✅ 879/s                                                        | Chuỗi AudioContext → worklet → IPC → WAV giữ đúng tốc độ                                                                                                                                                                                                  |
| (c) `utilityProcess` nạp `@huggingface/transformers` + `onnxruntime-node` (R5) | ✅ import 39 ms, pipeline chạy                                                                                                                                      | ✅ import 38 ms, chạy từ `app.asar`                             | **Không cần thêm `asarUnpack`** cho `onnxruntime-node`                                                                                                                                                                                                    |
| (d) Cờ `--use-fake-device-for-media-stream` qua dòng lệnh Electron (R15)       | ⚠️ thiết bị giả **liệt kê được**; `getUserMedia({video})` OK; **`getUserMedia({audio})` treo** ở `STATE_PENDING_APPROVAL`, handler quyền của session không được gọi | (cùng hiện tượng — không chạy tiếp)                             | Trên macOS, yêu cầu **audio** (kể cả thiết bị giả) vẫn đi qua quyền micro của hệ điều hành; tiến trình chạy tự động không có ai bấm cho phép ⇒ treo. E2E **không được** dựa vào cờ fake audio trên mac — xem quyết định 2                                 |
| Micro thật + đổi tai nghe Bluetooth giữa chừng                                 | —                                                                                                                                                                   | ⏳ **cần chạy tay**                                             | Xem "Còn chờ"                                                                                                                                                                                                                                             |
| Bản Windows (NSIS/`win-unpacked`)                                              | —                                                                                                                                                                   | ⏳ **cần chạy tay trên máy Windows**                            | Xem "Còn chờ"                                                                                                                                                                                                                                             |

Phát hiện phụ:

1. Worklet chỉ gửi lô **đủ 1 s**; ghi 4 s wall-clock cho ra 3 s audio ⇒ phần lẻ cuối bị mất khi dừng. Bản thật phải **xả lô lẻ** khi tạm dừng/kết thúc (gửi lệnh
   `flush` qua `port`, chờ phản hồi trước khi `meeting:pause`/`meeting:stop`).
2. Electron 43 dùng **Node 24.18**, không phải Node 22 như plan ghi — không ảnh hưởng thiết kế (sửa câu chữ plan).

### Quyết định rút ra từ S1

1. **Giữ thiết kế R1**: AudioContext 16 kHz + AudioWorklet bundle qua `?worker&url`; không fallback.
2. **Seam e2e mic giả (thay R15)**: thêm `IV_E2E_FAKE_MIC=<tệp wav>` (chỉ `!app.isPackaged`): `mic-capture.ts` thay `getUserMedia` bằng nguồn
   `AudioBufferSourceNode` phát lặp tệp fixture (giải mã trong renderer từ dữ liệu main cấp qua kênh test-only) — đi qua **cùng** AudioContext/worklet/IPC
   như thật. Cờ Chromium fake media chỉ giữ làm tuỳ chọn cho máy đã cấp quyền micro (Windows/Linux CI). Kiểm quyền (`meeting-permission.spec.ts`) dùng seam
   giả lập `micStatus: "denied"` ở `meeting:prepare`.
3. **Không cần `asarUnpack`** mới cho worker ASR.
4. **Xả lô lẻ** khi tạm dừng/kết thúc là yêu cầu của `capture/pcm-worklet.ts` + `mic-capture.ts` (T051).

### Còn chờ (chạy tay — chủ dự án)

- **macOS, micro thật**: chạy bản đóng gói từ Terminal để hộp thoại quyền micro gắn với ứng dụng; cho phép; bấm "Ghi micro" 30 s, nói thử; kiểm `spike.wav` nghe rõ, đúng
  tốc độ.
- **Đổi tai nghe Bluetooth giữa lúc ghi** (đổi tần số gốc của thiết bị): ghi tiếp được, `spike.wav` không bị nhanh/chậm/méo.
- **Windows x64**: build + chạy cùng màn spike: "Ghi micro", "Ghi oscillator", "Thử utilityProcess ASR".

Kết quả chạy tay sẽ được bổ sung vào mục này; nếu có điểm không đạt ⇒ cập nhật research R1/R5 trước khi sang T051.

## Quyết định thực thi (T065)

1. **Thay 049 #3 — citation chỉ tua.** Bấm `[n]` (hoặc kết quả tìm toàn văn) của mọi nguồn audio/video/cuộc họp: player tua tới
   `tStart`, đang phát thì dừng tại mốc mới, KHÔNG gọi `play()` (`SourceViewer.tsx`). Không có tuỳ chọn tự phát ở v1.
2. **Ngoại lệ 049 #2 — audio do app sở hữu.** Audio cuộc họp ở `<userData>/meetings/<sessionId>/` (phân đoạn `seg-NNNN.wav` khi
   đang ghi/hoàn tất, `meeting.wav` sau khi ghép). Xoá nguồn hoặc notebook ⇒ xoá thư mục; có trong sao lưu vault (`meetings/` trong
   snapshot, allowlist giải nén, `VAULT_ITEMS`); không relink/retry. `iv-media` phục vụ qua resolver ở main (không đọc `origin`).
3. **Diễn giải Constitution III (không phải ngoại lệ).** PCM micro sinh ở renderer đi renderer→main qua kênh SEND `meeting:audio`;
   main kiểm sender = cửa sổ đã bắt đầu, sessionId, seq, kích thước ≤ 64 KB, ≤ 4 lô/giây (`audio-ingress.ts`); không log, audio
   không gửi ngược ra renderer.
4. **Chính sách quyền.** `installSecurity` dùng `permissions.ts`: chỉ cấp `media` khi `mediaTypes` = audio, origin của app, main
   frame, cửa sổ chính, trong cổng 15 s (`micGate`, mở ở `meeting:prepare`/`meeting:resume`); mọi quyền khác vẫn từ chối;
   `setDevicePermissionHandler` vẫn `false`. macOS: `askForMediaAccess` khi chưa xác định; `NSMicrophoneUsageDescription` +
   `build/entitlements.mac.plist` (audio-input) sẵn cho lúc ký.
5. **ASR trong utilityProcess.** `asr-worker.js` (fork lười, ≤ 3 lần fork lại / 5 phút, trần 30 phút/phân đoạn); worker chỉ nhận
   đường dẫn trong `meetings/`; tải model ⇒ chỉ báo riêng tư `model`. Nạp file audio thường (045) không đổi.
6. **Phiên ở cấp app (analyze P1).** `RecordingProvider` bọc `RouterProvider`; thanh "● Đang ghi … — Quay lại" khi ở màn khác.
   Main giám sát `render-process-gone` và "không nhận lô > 5 s" ⇒ PR A tự kết thúc + hoàn tất (PR C1 đổi sang thẻ phục hồi).
7. **Seam e2e (chỉ bản chưa đóng gói).** `IV_ASR_FAKE` (ASR giả trong worker thật), `IV_E2E_FAKE_MIC` (renderer dùng tín hiệu thử
   qua cùng AudioContext/worklet — `MeetingPrepareResult.testFakeMic`), `IV_E2E_MIC_DENIED`, `IV_MEETING_SEGMENT_SEC`.

## Rủi ro thấp còn mở sau security-review PR A (T069)

M1–M3 và L1 đã sửa trong PR A. Các mục dưới đây chấp nhận tạm, theo dõi ở PR sau:

- **L2** — kênh `meeting:*` chỉ kiểm `sender.id === ownerId`, chưa kiểm `senderFrame === sender.mainFrame`. Hiện không có
  iframe/webview; thêm kiểm khi xuất hiện frame con (hoặc ở PR C1).
- **L3** — `meeting:status` / `meeting:rename` không gắn owner (một cửa sổ; `rename` đã có `assertVaultWritable`, tiêu đề ≤ 200).
- **L4** — `safeHandle` trả `Error.message` thô (có thể lộ đường dẫn fs). Mẫu chung toàn app, không riêng 186 — xử lý chung.
- **L5** — entitlements macOS rộng (`disable-library-validation`, áp cả `entitlementsInherit`). Thu hẹp khi bật ký/notarize.
- **L6** — model Whisper tải từ HuggingFace không kiểm hash (giống đường 045). Xem lại cùng spike S2 (PR B).

**Lệch tạm D8:** khi đang ghi, bảo trì vector (khoá vault) bị chặn tới PR C1 (T116 — `excludeRecording`).
