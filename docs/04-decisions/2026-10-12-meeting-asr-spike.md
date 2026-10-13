# ADR — Spike S2: tốc độ Whisper và phát hiện ngôn ngữ cho Meeting Capture (#186, PR B)

- **Ngày:** 2026-10-12
- **Trạng thái:** CHỐT TẠM (2026-10-13) — số đo Mac; số đo Windows x64 / máy yếu **giao cho người dùng thử** (mục 7–8), chốt hẳn sau
  vòng thử nghiệm.
- **Liên quan:** research R2, clarify A2/D6, tasks T071–T072. Bộ đo: `npm run spike:asr` (`tests/spike/asr-rtf.spike.ts`, dev-only,
  không vào `npm test`/CI; model tải vào `tests/spike/.cache/`, báo cáo ở `tests/spike/reports/` — cả hai gitignore).

## Phương pháp

- Model `Xenova/whisper-tiny`, `Xenova/whisper-base` × dtype `q8`, `fp32`; transformers.js 4.2.0, chạy trong Node 24 (cùng dòng với
  Node của Electron 43 — `utilityProcess`).
- **Nháp:** 5 cửa sổ 10 s có lời từ `tests/fixtures/meeting/speech-16k.wav` (bỏ lượt khởi động), `return_timestamps`. RTF = thời gian
  xử lý / thời lượng audio.
- **Chốt:** phân đoạn 5 phút dựng bằng cách lặp fixture, gọi như `asr-worker` (`chunk_length_s: 30`, `return_timestamps`).
- **Phát hiện ngôn ngữ:** encoder trên 30 s + **một bước decoder** sau `<|startoftranscript|>`, so logits `<|vi|>` / `<|en|>`
  (softmax trên 2 token). 12 mẫu: 2 đoạn của fixture + 10 đoạn 30 s đọc bằng giọng hệ thống macOS (Linh, Samantha, Daniel, Karen —
  văn bản dự án tự viết, `tests/spike/lang-samples.ts`).

## Kết quả — Mac Apple Silicon (M4 Pro, 12 nhân, 24 GB)

| Model | dtype | RTF nháp 10 s (TB) | Chậm nhất 10 s | RTF chốt 5 phút | Phát hiện ngôn ngữ (đúng / TB) |
| ----- | ----- | ------------------ | -------------- | --------------- | ------------------------------ |
| tiny  | q8    | 0,084              | 2 881 ms       | 0,048           | 12/12 · 131 ms                 |
| tiny  | fp32  | 0,046              | 1 427 ms       | 0,037           | 12/12 · 120 ms                 |
| base  | q8    | 0,040              | 521 ms         | 0,048           | 12/12 · 181 ms                 |
| base  | fp32  | 0,033              | 378 ms         | 0,061           | 12/12 · 203 ms                 |

Ghi nhận chất lượng (cửa sổ tiếng Việt đầu tiên):

- **Không khoá ngôn ngữ, Whisper "dịch/ảo giác" sang tiếng Anh** ở mọi model (vd. tiny q8: "The United States has been…"). Khoá
  `language: "vietnamese"` thì ra đúng tiếng Việt ("Chào mọi người, hôm nay chúng ta họp để rà soát tiến độ…", base sai ít hơn tiny).
- Cửa sổ chậm nhất của `tiny` (≈ 1,4–2,9 s / 10 s) là lượt sinh lặp dài khi không khoá ngôn ngữ — `base` ổn định hơn.

## Kết quả — Windows x64 chỉ CPU

_Không chặn PR B nữa (quyết định 2026-10-13, mục 7):_ thu số đo thật từ người dùng thử qua chẩn đoán trong app. Ai có môi trường dev vẫn
có thể chạy `npm ci && npm run spike:asr` và dán bảng từ `tests/spike/reports/asr-rtf-win32-x64-*.md` vào đây.

## Quyết định

1. **Phát hiện ngôn ngữ = một bước decoder giới hạn {vi, en}** (phương án chính của R2 khả thi; không cần dự phòng "chạy ASR 2 lần").
   Chi phí ≈ 0,12–0,2 s cho mỗi 30 s trên Mac. Mẫu thử là giọng tổng hợp, sạch (P(vi) = 1,00 / 0,00) — với audio họp thật vẫn dùng
   ngưỡng tin cậy + gợi ý đổi ngôn ngữ như D6.
2. **Luôn truyền `language` tường minh** cho cả nháp và chốt (từ chế độ khoá hoặc từ bước phát hiện); không bao giờ để pipeline tự
   chọn — tránh bản nháp tiếng Anh ảo giác. Bản chốt: đã áp dụng ở PR A (#192 — `resolveFinalLanguage()` +
   phát hiện một bước decoder trong `asr-worker`). Bản nháp: PR B. Nạp audio thường (045): #194 (PR #195).
3. **Model chốt giữ `Xenova/whisper-base`** (A2) — RTF chốt 0,05–0,06 trên Mac.
4. **Model nháp — CHỐT TẠM `whisper-base` + tự hạ cấp** (người dùng duyệt 2026-10-13, lệch có chủ đích chữ "nhỏ nhất" của A2):
   một model cho cả nháp và chốt (tải một lần), tiếng Việt tốt hơn `tiny`. _Làm rõ khi code:_ model chốt (045) nạp dtype mặc định
   của transformers.js trên Node = fp32; bộ trọng số q8 là tệp khác (thêm ~80 MB). Để giữ đúng "một model, tải một lần", nháp dùng
   CHUNG pipeline chốt đã nạp (base fp32 — số đo Mac còn nhanh hơn q8: 0,033 vs 0,040); `q8` chỉ dùng cho model dự phòng `tiny`. Vì chưa có số đo máy yếu, app **tự đo RTF nháp lúc chạy**
   (trung bình trượt các cửa sổ có lời): RTF > 0,5 kéo dài ⇒ chuyển nháp sang `whisper-tiny` q8 (tải khi cần, có badge egress) và áp
   chính sách bỏ cửa sổ (R6); không tự nâng lại trong cùng phiên. Chính sách là hàm thuần (`draft-model-policy.ts`), có test.
5. **Lượt 5 s pending (`DRAFT_PARTIAL_PASS`)**: bật mặc định, **tự tắt** khi RTF nháp đo được > 0,25 (cùng bộ đo mục 4).

6. **Chế độ Đa ngôn ngữ (`multi`) — sửa R7/D6.** "`language: null`, Whisper tự chọn" KHÔNG dùng được: transformers.js thiếu
   `language` thì mặc định tiếng Anh (đã thấy trên fixture). `multi` ⇒ phát hiện ngôn ngữ trên TỪNG cửa sổ (nháp 10 s; bản chốt
   theo từng cửa sổ 30 s) rồi truyền tường minh — chi phí thêm ≈ 0,1–0,2 s / 30 s trên Mac. Trước khi chế độ Tự động khoá ngôn ngữ,
   nháp cũng phát hiện theo cửa sổ (`windowLanguage()` = `"perWindow"` — hàm thuần của PR B, `meeting-capture/language-policy.ts`).

7. **Số đo máy yếu lấy từ người dùng thử — chẩn đoán trong app** (2026-10-13). Sau mỗi phiên, main ghi vào nhật ký cục bộ (088) một
   dòng tóm tắt: OS/kiến trúc, mẫu CPU + số nhân, RAM, model/dtype nháp, RTF nháp (TB/p95), RTF chốt, số cửa sổ bị bỏ, có hạ cấp không.
   KHÔNG nội dung audio/transcript, KHÔNG tiêu đề/đường dẫn (redact sẵn của 088). Mẫu GitHub issue soạn sẵn của báo lỗi opt-in (093)
   thêm mục "Hiệu năng ghi cuộc họp" từ dòng này — người dùng xem/sửa và tự gửi; app không tự gửi gì (local-first giữ nguyên).
8. **Spike S1 làm tay giao cho người dùng thử** (2026-10-13): checklist (mic thật mac, tai nghe Bluetooth, bản cài Windows) đăng ở #186
   và trong release notes bản thử nghiệm; kết quả về qua issue. Chốt hẳn mục 4–5 (bỏ chữ "tạm") khi có đủ số đo Windows x64 chỉ CPU.

`DRAFT_MODEL` / `DRAFT_PARTIAL_PASS` / ngưỡng hạ cấp trong `meeting-constants.ts` theo mục 4–5 (T072).
