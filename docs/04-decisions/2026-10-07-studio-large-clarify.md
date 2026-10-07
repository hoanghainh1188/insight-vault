# studio-large clarify (105)

- Ngày: 2026-10-07
- Feature: `105-studio-large` (issue #105)
- Nguồn: hạn chế đã biết "Studio cắt bớt khi vượt 16.000 ký tự"; người dùng chốt 1 câu hỏi.
- Liên quan: `2026-07-11-studio-context-strategy.md` (1 lượt), `2026-07-11-studio-mapreduce-citation.md`
  (**ĐÃ BÁC** map-reduce citation mức NGUỒN), `2026-07-15-studio-balanced-context.md` (chia đều theo nguồn).

## Bối cảnh
- `STUDIO_CONTEXT_BUDGET = 16000` ký tự cố định; vượt ⇒ cắt cụt (`truncated`).
- App KHÔNG truyền `num_ctx` cho Ollama ⇒ Ollama dùng cửa sổ mặc định (nhỏ hơn 16.000 ký tự tiếng Việt) và có thể
  cắt đầu prompt âm thầm — mất cả system prompt/đoạn đầu.
- Lý do bác map-reduce trước đây: citation ở bước reduce trỏ vào tóm tắt trung gian ⇒ chỉ còn mức nguồn.

## Quyết định (người dùng chốt): ngân sách theo model + map-reduce GIỮ [n]

**1. Ngân sách theo cửa sổ ngữ cảnh của model.**
- Ollama: đọc `context_length` của model đang chọn (`/api/show`), dùng `num_ctx = min(context_length, TRẦN)`
  và TRUYỀN TƯỜNG MINH `options.num_ctx` cho mọi lượt Studio. Trần giữ RAM hợp lý cho máy cá nhân.
- Online: cửa sổ theo bảng đã biết của provider (lớn), có trần ký tự để giới hạn chi phí/độ trễ trên key người dùng.
- Ngân sách ký tự = (num_ctx − dự phòng câu trả lời − dự phòng system prompt) × hệ số ký tự/token thận trọng cho
  tiếng Việt. Không đọc được cửa sổ ⇒ lùi về 16.000 (hành vi cũ).

**2. Vẫn vượt ⇒ map-reduce với [n] TOÀN CỤC (giữ citation tới ĐÚNG ĐOẠN).**
- Đánh số [1..N] cho MỌI đoạn của notebook (theo nguồn → thứ tự đọc) — một bảng n→đoạn dùng chung.
- Map: chia thành các lô vừa ngân sách; mỗi lô → ghi chú ý chính, mỗi ý kèm [n] của đoạn (số toàn cục). Hậu kiểm
  ghi chú theo BẢNG CỦA LÔ (gỡ [n] không thuộc lô).
- Reduce: bước cuối theo loại Studio nhận các ghi chú (đã kèm [n]) và GIỮ NGUYÊN [n]; hậu kiểm theo bảng toàn cục
  ⇒ chip trỏ đoạn thật (Constitution II mức đoạn — khác phương án đã bác).
- Ghi chú quá dài ⇒ rút gọn ghi chú theo lô (vẫn giữ [n]) trước bước cuối.
- Giới hạn số lượt map; vượt ⇒ vẫn `truncated` (minh bạch). UI ghi "Tổng hợp từ N phần".
- _Loại bỏ:_ chỉ ngân sách theo model (notebook vượt cửa sổ vẫn cắt); chỉ map-reduce với 16.000 (chậm không cần
  thiết với notebook vừa-lớn).

## Điều chỉnh sau review (2026-10-07)

- **Hậu kiểm theo ĐẦU VÀO của từng bước** (không theo bảng toàn cục): lượt map chỉ nhận [n] của lô; lượt rút gọn chỉ
  nhận [n] có trong ghi chú đầu vào; bước cuối chỉ nhận [n] có trong ghi chú nó nhận. Model không thể trích đoạn
  nó chưa đọc. Dự phòng citation (khi bước cuối không chèn [n]) chỉ gồm các đoạn có trong ghi chú — không phải cả
  notebook. Chip gộp "[1, 2]" được tách.
- Mọi lô không trích được ghi chú có [n] ⇒ báo lỗi (không để bước cuối viết từ đầu vào rỗng). Lô lỗi tạm / rỗng ⇒
  thử lại 1 lần; vẫn rỗng hoặc ghi chú phải cắt cho vừa ⇒ `truncated`.
- Chọn 1 lượt hay map-reduce theo **tổng độ dài thật** (round-robin cũ nhận chunk đầu mọi nguồn bất chấp ngân sách).
- **Trần num_ctx 16.384** (KV cache/RAM + thời gian prefill trên máy cá nhân); lượt có num_ctx dùng timeout 5 phút.
- **Cùng num_ctx cho mọi lượt chat Ollama** (hỏi đáp + Studio): Ollama nạp lại model khi num_ctx đổi; hỏi đáp cũng
  không bị cắt ở cửa sổ mặc định nhỏ.
- Chưa có tiến độ i/N cho map-reduce (UI chỉ "Đang tạo…" + thông báo trình đọc màn hình bắt đầu/xong) — để sau.
