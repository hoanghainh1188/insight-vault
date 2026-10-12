# Quickstart — kiểm chứng Meeting Capture (186)

Hướng dẫn chạy và tiêu chí đạt cho từng PR. Chi tiết hợp đồng ở [contracts/meeting-ipc.md](./contracts/meeting-ipc.md), dữ liệu ở [data-model.md](./data-model.md).

## Chuẩn bị

```bash
npm ci
npm run build          # e2e cần out/
```

Fixture: `tests/fixtures/meeting/speech-16k.wav` (≈ 60 s lời nói tiếng Việt + 30 s English + 10 s im lặng, 16 kHz mono, tự thu — không dùng audio có bản quyền).

Biến chỉ có hiệu lực khi app **chưa đóng gói**: `IV_ASR_FAKE=1`, `IV_MEETING_SEGMENT_SEC=<n≥5>`, `IV_E2E_AUDIO_PUMP=<fixture>` (soak), cùng `IV_EMBED_FAKE=1`,
`IV_RERANK_FAKE=1` sẵn có.

## Spike (trước khi code PR A / PR B)

| Spike | Cách chạy | Đạt khi |
|---|---|---|
| S1 — PCM 16 kHz trong bản đóng gói | `npm run build && npm run dist:mac` (và Windows), mở app, màn spike dev-only ghi 30 s | AudioContext 16 kHz hoạt động, `addModule` không bị CSP chặn, tệp WAV phát lại đúng tốc độ; đổi sang tai nghe Bluetooth giữa chừng không lệch |
| S2 — RTF + ngôn ngữ | `npm run spike:asr` (dev-only, `vitest run -c vitest.spike.config.ts` theo khuôn `eval:retrieval`; biến `IV_SPIKE_MODELS`, `IV_SPIKE_AUDIO_DIR` cho máy ngoài) | Bảng RTF trên Mac Apple Silicon + Windows CPU; phát hiện vi/en đúng ≥ 9/10 mẫu 30 s. Ghi ADR spike |

## Kiểm thử tự động

```bash
npm test                                   # vitest + coverage ≥ 80% logic
npx playwright test tests/e2e/meeting-*.spec.ts
```

| PR | E2E (cờ fake mic + `IV_ASR_FAKE=1`) | Kỳ vọng |
|---|---|---|
| A | `meeting-record.spec.ts` | Mở hộp bắt đầu (tên mặc định, thông điệp riêng tư) → Bắt đầu → đồng hồ chạy → Tạm dừng ("Đã tạm dừng — không thu âm") → Tiếp tục → Kết thúc (phiên < 5 phút: không hỏi) → màn hoàn tất → nguồn `Sẵn sàng`; hỏi đáp có `[n]` vào nguồn; bấm `[n]` ⇒ `audio.paused === true`, `currentTime` trong khoảng đoạn trích |
| A | `meeting-permission.spec.ts` | Từ chối quyền (không truyền `--use-fake-ui-for-media-stream`, handler test) ⇒ hướng dẫn, **không** có nguồn mới |
| A | `citation-seek-only.spec.ts` | Nguồn mp3/mp4 sẵn có: bấm `[n]` không tự phát |
| A | `meeting-delete.spec.ts` | Xoá nguồn cuộc họp ⇒ thư mục `meetings/<id>` biến mất |
| B | `meeting-draft.spec.ts` | Nháp xuất hiện có timestamp; nhãn "Đang nhận dạng" chỉ ở cửa sổ mới nhất; cuộn lên ⇒ "Quay về hiện tại"; đánh dấu bằng nút/bôi chọn; ngôn ngữ "Tiếng Việt · Tự động"; meter có nhãn chữ |
| C1 | `meeting-recovery.spec.ts` | Ghi 20 s → `electronApp.process().kill("SIGKILL")` → mở lại ⇒ thẻ phục hồi; 3 hành động đúng; audio thiếu ≤ 5 s |
| C1 | `meeting-quit.spec.ts` | Đang ghi, `app.quit()` ⇒ hộp xác nhận (seam `IV_E2E_DIALOG_PATH`/dialog stub); đồng ý ⇒ lần mở sau tự hoàn tất |
| C1 | `meeting-soak.spec.ts` | `IV_E2E_AUDIO_PUMP` bơm **180 phút** (36 phân đoạn 300 s) ⇒ thời lượng ±1 s, hoàn tất thành công; `IV_MEETING_SEGMENT_SEC=5` × 120 phân đoạn ⇒ xoay tệp đúng; kill `asr-worker` giữa phiên ⇒ không mất mẫu |
| C2 | `meeting-viewer.spec.ts` | Phát ⇒ câu đang phát có `aria-current`; bấm câu ⇒ tua; tìm từ ⇒ đếm + trước/sau; danh sách đánh dấu; xuất Markdown (dialog stub) có tiêu đề, đánh dấu, `[hh:mm:ss]`, dòng tạm dừng |

Mỗi spec chạy ở `IV_UI_LANG=vi` và một lượt `en` cho chuỗi mới (hoặc unit test catalog i18n vi↔en).

## Checklist tay trước phát hành (mac + Windows, bản đóng gói)

1. Lần đầu: hộp bắt đầu báo cần tải model; tải ⇒ badge riêng tư "đang tải" rồi về "cục bộ".
2. macOS: lần đầu bấm Bắt đầu ⇒ hộp xin quyền micro của hệ điều hành có câu mô tả; từ chối ⇒ hướng dẫn System Settings, không có nguồn mới.
3. **Ghi thật 120 phút** (cuộc họp hoặc phát podcast qua loa): đồng hồ, nháp hiện dần, máy không ngủ khi khoá màn hình, tạm dừng 2 lần, 5 đánh dấu.
4. Giữa phiên rút tai nghe/đổi micro ⇒ tự tạm dừng + chọn thiết bị khác ⇒ ghi tiếp cùng phiên.
5. Kết thúc ⇒ xác nhận ⇒ Về notebook ⇒ thêm một PDF trong lúc hoàn tất (PDF không phải chờ) ⇒ thông báo "đã sẵn sàng".
6. Hỏi 3 câu về nội dung cuộc họp ⇒ `[n]` mở đúng mốc, không tự phát. Studio Tóm tắt có trích dẫn vào cuộc họp.
7. Trình xem: tô câu đang phát, tìm, đánh dấu, xuất Markdown mở được trong trình soạn thảo.
8. Buộc thoát (Activity Monitor/Task Manager) giữa phiên ⇒ mở lại ⇒ thẻ phục hồi ⇒ Hoàn tất ⇒ mất ≤ 5 s.
9. Sao lưu vault ⇒ hộp sao lưu hiện dung lượng ghi âm; khôi phục trên máy khác ⇒ cuộc họp nghe được.
10. Theo dõi mạng (Little Snitch / Resource Monitor) suốt bước 3–7 với AI online **tắt**: không có kết nối ra ngoài ngoài lần tải model.
11. VoiceOver / Narrator: đọc trạng thái ghi, thời lượng, meter, các mốc (bắt đầu, tạm dừng, mất thiết bị, kết thúc, sẵn sàng), không đọc từng câu transcript; toàn luồng
    làm được bằng bàn phím và phím tắt `Mod+Shift+P/M/E`.
