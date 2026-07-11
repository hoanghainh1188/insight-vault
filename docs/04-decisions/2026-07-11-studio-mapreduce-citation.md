# Studio map-reduce & citation khi notebook lớn (025-workspace-enhance)

- Ngày: 2026-07-11
- Feature: `025-workspace-enhance`
- **TRẠNG THÁI: ĐÃ BÁC (REJECTED) — phương án đã cân nhắc nhưng KHÔNG áp dụng.** Người dùng
  (hoanghainh1188, 2026-07-11) ưu tiên **độ chính xác citation tuyệt đối** (chip `[n]` tới đúng đoạn) hơn là
  bao phủ toàn bộ notebook rất lớn. Thay vào đó: **tăng `STUDIO_CONTEXT_BUDGET` 8000 → 16000**, giữ 1-lượt +
  chip `[n]` chính xác; notebook vượt ngân sách mới vẫn cắt cụt (cờ `truncated`, như 021); kết hợp lọc-theo-
  nguồn để tổng hợp riêng từng tài liệu lớn. Xem `2026-07-11-workspace-enhance-clarify.md` mục 1.
- Giữ tài liệu này làm GHI CHÉP phương án map-reduce đã phân tích (nếu sau muốn bao phủ notebook cực lớn mà
  chấp nhận citation mức nguồn, có thể mở lại).
- **REVISE (ban đầu)**: mục "Phương án loại bỏ → Map-reduce (hoãn)" trong `2026-07-11-studio-context-strategy.md`.
- Người quyết định: hoanghainh1188 (2026-07-11)

## Bối cảnh

021-studio dùng **1 lượt chat** theo `STUDIO_CONTEXT_BUDGET` (~8000 ký tự): notebook lớn bị **cắt cụt**
(chỉ tổng hợp phần đầu, `truncated=true`). ADR studio-context-strategy đã HOÃN map-reduce vì: tóm tắt nhiều
lượt → citation `[n]` ở bước reduce trỏ vào **tóm tắt trung gian**, KHÔNG phải chunk THẬT → lệch Constitution
II (kiểm chứng được). Nay muốn bao phủ TOÀN BỘ nguồn.

## Quyết định — HYBRID theo ngân sách

### Nhánh A: vừa ngân sách (như 021 — KHÔNG đổi)

Tổng chunk ≤ `STUDIO_CONTEXT_BUDGET` → 1 lượt chat, `buildContext` đánh số `[1..k]`, `postprocessCitations`
→ chip `[n]` **chính xác từng chunk**. Constitution II ở mức CAO nhất (trỏ đúng đoạn).

### Nhánh B: vượt ngân sách → map-reduce, citation MỨC NGUỒN

1. **Map**: chia chunk thành các LÔ vừa ngân sách (theo thứ tự source→ordinal). Mỗi lô → 1 lượt chat tóm
   tắt cục bộ (system prompt "tóm tắt trung thành, không bịa"). KHÔNG yêu cầu `[n]` ở bước map.
2. **Reduce**: ghép các tóm tắt lô → 1 lượt chat cuối theo `kind` (summary/keyPoints/faq/outline).
3. **Citation**: KHÔNG trỏ `[n]` vào tóm tắt trung gian. Thay vào đó gắn citation **mức NGUỒN** —
   `citationsFromMap` trên TẬP NGUỒN đã đưa vào (mỗi nguồn 1 citation, `locator` = chunk đầu của nguồn để
   mở Source Viewer về đầu tài liệu). Kết quả kèm cờ `truncated=false` + ghi chú UI "tổng hợp từ N phần".

### Ranh giới Constitution II

- Nhánh A: citation trỏ **đúng đoạn** (không đổi — vàng, bấm → highlight chính xác).
- Nhánh B: citation trỏ **đúng NGUỒN** (không phải đoạn chính xác). Vẫn "truy được về nguồn" — người dùng mở
  được nguồn để đối chiếu, nhưng KHÔNG nhảy tới đúng câu. Đây là mức kiểm-chứng-được THẤP HƠN, chỉ áp dụng
  khi tài liệu vượt ngân sách (không còn cách trỏ đoạn chính xác qua nhiều lượt tóm tắt).
- **KHÔNG bịa**: mọi bước map/reduce đều "chỉ dùng nội dung đã cho". Không có nguồn ảo.

## Lý do

- Bao phủ toàn bộ notebook lớn (hết cắt cụt) mà KHÔNG đánh mất tính truy-về-nguồn.
- Giữ độ chính xác tối đa (chip đoạn) cho trường hợp phổ biến (notebook vừa) — chỉ hạ mức khi buộc phải
  (notebook rất lớn).
- Minh bạch: UI ghi rõ "tổng hợp từ N phần" để người dùng biết đây là tổng hợp nhiều lượt, citation ở mức
  nguồn.

## Phương án loại bỏ

- **Chỉ 1 lượt + tăng ngân sách** (16000): đơn giản, giữ chip chính xác, nhưng notebook cực lớn vẫn cắt cụt
  → không đạt mục tiêu "bao phủ toàn bộ". (Người dùng đã cân nhắc, chọn hybrid.)
- **Map-reduce + ép `[n]` xuyên suốt**: citation trỏ tóm tắt trung gian → SAI Constitution II. Loại.

## Hệ quả

- `studio-service.ts`: thêm nhánh map-reduce (LÔ + reduce) + `citationsFromMap` mức nguồn. `StudioResult`
  giữ `truncated?` + có thể thêm `partsCount?` (số lô) cho ghi chú UI.
- Prompt map/reduce mới trong `studio/prompt.ts`.
- Test: unit cho việc chia lô (thuần) + chọn nhánh theo ngân sách; e2e giữ luồng cũ (notebook nhỏ) xanh.
