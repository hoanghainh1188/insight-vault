# Feature Specification: Chat history (lưu lịch sử hội thoại theo notebook)

**Feature Branch**: `027-chat-history`

**Created**: 2026-07-12

**Status**: Draft

**Input**: Lưu lịch sử hội thoại Chat theo notebook — mở lại notebook thấy lại đoạn hội thoại cũ (hiện
in-memory, mất khi đóng). Kèm nút xoá hội thoại.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Xem lại hội thoại cũ khi mở lại notebook (Priority: P1)

Người dùng hỏi đáp trong một notebook, đóng/đổi sang notebook khác rồi quay lại — thấy lại toàn bộ đoạn hội
thoại đã có (câu hỏi + câu trả lời kèm chip trích dẫn), đúng thứ tự.

**Why this priority**: Giá trị cốt lõi của yêu cầu; hiện hội thoại mất hoàn toàn khi rời notebook.

**Independent Test**: Hỏi 1–2 câu trong notebook A → chuyển sang B → quay lại A → thấy lại các lượt cũ với
nội dung + chip trích dẫn bấm được.

**Acceptance Scenarios**:

1. **Given** đã có vài lượt hội thoại trong notebook A, **When** người dùng chuyển sang notebook khác rồi
   quay lại A, **Then** toàn bộ lượt cũ hiển thị lại đúng thứ tự với nội dung và chip trích dẫn.
2. **Given** một câu trả lời cũ có chip `[n]`, **When** người dùng bấm chip sau khi nạp lại, **Then** mở
   đúng nguồn/đoạn (trích dẫn còn kiểm chứng được).
3. **Given** khởi động lại ứng dụng, **When** mở notebook A, **Then** hội thoại cũ vẫn còn.

---

### User Story 2 - Hội thoại nhiều lượt dùng lịch sử đã lưu (Priority: P2)

Khi người dùng tiếp tục hỏi trong notebook đã có lịch sử, câu hỏi mới được trả lời có tính đến các lượt
trước (multi-turn) — dựa trên lịch sử đã nạp.

**Why this priority**: Giữ hành vi multi-turn hiện có sau khi chuyển sang lịch sử bền vững.

**Independent Test**: Mở notebook có lịch sử, hỏi câu tham chiếu lượt trước ("câu vừa rồi…") → trả lời hợp
ngữ cảnh.

**Acceptance Scenarios**:

1. **Given** notebook có lịch sử đã nạp, **When** người dùng hỏi tiếp, **Then** câu trả lời tính đến các
   lượt gần nhất (như hành vi multi-turn hiện tại).

---

### User Story 3 - Xoá hội thoại của notebook (Priority: P3)

Người dùng bấm "Xoá hội thoại" để làm sạch toàn bộ lịch sử chat của notebook hiện tại.

**Why this priority**: Kiểm soát dữ liệu; nhỏ, độc lập.

**Independent Test**: Có lịch sử → bấm Xoá hội thoại → hội thoại trống; mở lại notebook vẫn trống.

**Acceptance Scenarios**:

1. **Given** notebook có lịch sử, **When** người dùng xác nhận "Xoá hội thoại", **Then** mọi lượt của
   notebook đó bị xoá và khung chat trở về trạng thái rỗng.

---

### Edge Cases

- **Câu trả lời lỗi (mô hình/kết nối)**: KHÔNG lưu lượt đó (tránh câu hỏi mồ côi không có trả lời).
- **Notebook bị xoá**: lịch sử của nó bị xoá theo (không mồ côi).
- **Lịch sử rất dài**: hiển thị lại đầy đủ khi nạp; phần gửi cho mô hình vẫn bị giới hạn số lượt gần nhất
  (như hiện tại).
- **Không log nội dung** hội thoại (kể cả khi lỗi).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Hệ thống MUST lưu bền mỗi lượt hỏi–đáp (câu hỏi của người dùng + câu trả lời kèm trích dẫn)
  theo notebook, sau khi câu trả lời hoàn tất.
- **FR-002**: Khi câu trả lời thất bại (lỗi mô hình/kết nối), hệ thống MUST KHÔNG lưu lượt đó.
- **FR-003**: Khi mở một notebook, hệ thống MUST nạp và hiển thị lại toàn bộ lịch sử hội thoại của notebook
  đó theo đúng thứ tự thời gian.
- **FR-004**: Chip trích dẫn của câu trả lời đã lưu MUST vẫn mở đúng nguồn/đoạn sau khi nạp lại.
- **FR-005**: Hội thoại nhiều lượt MUST dùng lịch sử đã nạp làm ngữ cảnh (giữ hành vi multi-turn hiện có, có
  giới hạn số lượt gần nhất).
- **FR-006**: Người dùng MUST xoá được toàn bộ lịch sử hội thoại của notebook hiện tại.
- **FR-007**: Khi một notebook bị xoá, hệ thống MUST xoá theo toàn bộ lịch sử hội thoại của notebook đó.
- **FR-008**: Việc đọc/ghi lịch sử MUST chỉ diễn ra ở tiến trình chính; giao diện trao đổi qua kênh được cấp
  phép (whitelisted).
- **FR-009**: Hệ thống MUST KHÔNG BAO GIỜ ghi log nội dung hội thoại (kể cả khi lỗi).

### Key Entities _(include if feature involves data)_

- **Lượt hội thoại (chat message)**: một tin trong lịch sử của notebook — vai trò (người dùng / trợ lý), nội
  dung, danh sách trích dẫn (với tin trợ lý), cờ "không tìm thấy", mốc thời gian. Quan hệ: thuộc về đúng một
  notebook; xoá theo khi notebook bị xoá.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Sau khi rời và quay lại một notebook (hoặc khởi động lại ứng dụng), 100% lượt hội thoại đã
  hoàn tất hiển thị lại đúng nội dung và thứ tự.
- **SC-002**: 100% chip trích dẫn trên hội thoại đã nạp lại mở đúng nguồn/đoạn (kiểm chứng được).
- **SC-003**: Xoá hội thoại làm khung chat của notebook trở về rỗng và giữ rỗng sau khi mở lại.
- **SC-004**: Xoá notebook → 0 lịch sử mồ côi còn lại.
- **SC-005**: 0 hồi quy — luồng hỏi đáp hiện có (gồm multi-turn, chip trích dẫn, chặn khi chưa sẵn sàng) vẫn
  hoạt động đúng.
- **SC-006**: Ở chế độ mặc định, lưu/nạp lịch sử không phát sinh lưu lượng mạng ra ngoài.

## Assumptions

- **A1 — Persist ở tiến trình chính** như hệ quả của luồng hỏi đáp (có sẵn ngữ cảnh notebook + câu trả lời);
  giao diện chỉ nạp/xoá qua kênh riêng.
- **A2 — Lưu cặp sau khi trả lời xong**; trả lời lỗi → không lưu.
- **A3 — Một dòng lịch sử tuyến tính mỗi notebook** (không đa phiên ở MVP).
- **A4 — Lưu**: vai trò · nội dung · trích dẫn · cờ không-tìm-thấy · thời gian. Không lưu chế độ (grounded/
  open) vì là tuỳ chọn giao diện, không thuộc lịch sử.
- **A5 — Kênh riêng để nạp và xoá lịch sử**; luồng hỏi đáp giữ nguyên giao diện (persist là hệ quả nội bộ).
- **A6 — Kế thừa 013-rag-qa** (chip trích dẫn, multi-turn) + 011 (lưu trữ + xoá theo). Có migration #4;
  không đổi các luồng khác.

## Out of Scope

- Streaming câu trả lời (feature riêng sau).
- Hiển thị markdown (feature riêng sau).
- Nhiều phiên hội thoại trong một notebook.
- Sửa/xoá từng lượt lẻ (chỉ xoá toàn bộ).
