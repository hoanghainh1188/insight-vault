# Quyết định — review PR B Ghi cuộc họp (#186): nháp không lập chỉ mục, model dự phòng chỉ tải theo yêu cầu

- **Ngày:** 2026-10-13
- **Trạng thái:** Đã chốt (người dùng chọn trong phiên review PR B)
- **Liên quan:** spec FR-027, FR-036, D5 (`2026-10-12-meeting-capture-clarify.md`); ADR `2026-10-12-meeting-asr-spike.md` mục 4–8.

## 1. Transcript nháp KHÔNG được lập chỉ mục (giải mâu thuẫn FR-027 ↔ FR-036/D5)

Code review phát hiện spec tự mâu thuẫn: FR-027 "Transcript nháp MUST NOT được dùng để trả lời hay trích dẫn", trong khi FR-036/D5
"bản chốt thất bại ⇒ nguồn dùng transcript nháp" (bản PR B đầu đã lập chỉ mục văn bản nháp).

**Chốt:** giữ FR-027 (bất biến "kiểm chứng được"). Khi bản chốt lỗi hoặc thiếu model chốt mà có nháp:

- nguồn `done` + `transcriptQuality = "draft"` (nghe được, có nhãn "Transcript nháp" + "Chốt lại" ở PR C1);
- **0 chunk** — không vào hỏi đáp, Studio, trích dẫn cho tới khi "Chốt lại" thành công;
- văn bản nháp nằm ở `draft.jsonl` để trình xem (PR C2) hiển thị; phân đoạn WAV được giữ cho "Chốt lại".

"Nguồn dùng transcript nháp" trong FR-036/D5 hiểu là **hiển thị**, không phải lập chỉ mục.

## 2. Model nháp dự phòng chỉ tải khi người dùng bấm "Tải model"

Security review: tự tải `Xenova/whisper-tiny` (q8) giữa cuộc họp khi máy chậm là egress không do người dùng chủ động.

**Chốt:** nút "Tải model" (hộp bắt đầu ghi và màn ghi) tải cả model chốt lẫn model dự phòng (`meeting:downloadModel` ⇒ worker
`load` primary + fallback, chỉ báo riêng tư "đang tải model"). Trong lúc ghi, nháp CHỈ hạ cấp khi model dự phòng đã có trên máy;
chưa có ⇒ không hạ cấp, hàng việc tự bỏ cửa sổ (R6). Không bao giờ tự kết nối mạng giữa cuộc họp.

## 3. Sửa kỹ thuật kèm theo (không cần quyết định của người dùng)

- RTF chỉ lấy từ cửa sổ nháp đủ 10 s và không tính thời gian nạp model (tránh hạ cấp oan).
- Kết thúc phiên: xả nháp còn dở (tối đa 30 s) rồi mới hoàn tất; xoá nguồn ⇒ huỷ việc nháp đang chạy ở worker.
- Đa ngôn ngữ rồi khoá tay: phần trước lần khoá vẫn phát hiện theo cửa sổ ở bản chốt.
- Tải model: một lượt tại một thời điểm, mọi lỗi đều báo (không coi là đã có model); tối đa 5 000 đánh dấu/phiên; đọc
  `draft.jsonl` có trần 5 MB.
