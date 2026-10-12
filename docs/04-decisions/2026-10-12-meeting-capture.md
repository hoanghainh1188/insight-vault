# Meeting Capture — ADR thực thi (186)

> **BẢN NHÁP** — mục "Kết quả spike S1" điền ở T002; các mục quyết định thực thi hoàn thiện ở T065 (cuối PR A).

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

## Quyết định thực thi (hoàn thiện ở T065)

- Thay 049 #3: bấm `[n]` của mọi nguồn audio/video/meeting chỉ tua, không `play()`.
- Ngoại lệ 049 #2: audio cuộc họp do app sở hữu trong `<userData>/meetings/<sessionId>/`, xoá cùng nguồn, có trong sao lưu, không relink.
- Diễn giải Constitution III (không phải ngoại lệ): luồng PCM micro renderer→main qua `meeting:audio`.
- Chính sách quyền: `installSecurity` chỉ cấp `media` audio-only, cửa sổ chính, trong cổng 15 s sau hành động người dùng.
- utilityProcess ASR cho meeting (nạp file 045 không đổi).
