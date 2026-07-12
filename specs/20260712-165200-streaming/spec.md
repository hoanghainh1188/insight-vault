# Feature Specification: Streaming câu trả lời Chat (+ nút Dừng)

**Feature Branch**: `039-streaming`

**Created**: 2026-07-12

**Status**: Draft

**Input**: Chat trả lời streaming (chữ chạy dần) thay vì chờ trọn. Giữ "kiểm chứng được" (chip `[n]` hậu
kiểm sau khi có toàn văn). Có nút Dừng huỷ giữa chừng. Chỉ Chat (Studio giữ nguyên).

## Clarifications

### Session 2026-07-12

- Q: Áp streaming cho đâu? → A: **Chỉ Chat (rag-qa)**; Studio giữ chờ-trọn.
- Q: Nút Dừng? → A: **Có** — AbortController xuyên chuỗi provider→rag→IPC; giữ phần đã nhận + hậu kiểm chip.
- Q: Chip `[n]` khi đang stream? → A: **Stream token thô (chưa chip); xong → hậu kiểm → thay bằng
  markdown + chip bấm được.** Constitution II giữ nguyên (chip chỉ hiện sau toàn văn).
- Q: Provider nào stream? → A: Provider **đang active** — Ollama (NDJSON) + 3 online (SSE).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Câu trả lời chạy dần (Priority: P1)

Người dùng hỏi → thấy chữ trả lời xuất hiện dần (không chờ im lặng), kết thúc thành câu trả lời hoàn chỉnh
có chip `[n]`.

**Why**: Cảm nhận chất lượng/độ phản hồi — giá trị chính.

**Independent Test**: Hỏi 1 câu → text tăng dần trong bong bóng AI; khi xong, chip `[n]` bấm được xuất hiện.

**Acceptance Scenarios**:

1. **Given** runtime sẵn sàng, **When** hỏi, **Then** bong bóng AI hiện text tăng dần theo token.
2. **Given** stream kết thúc, **Then** thay bằng markdown + chip `[n]` bấm mở đúng nguồn (hậu kiểm).
3. **Given** chế độ grounded không có căn cứ, **Then** trả "Không tìm thấy trong nguồn" (không stream bịa).

---

### User Story 2 - Dừng giữa chừng (Priority: P1)

Đang stream, người dùng bấm Dừng → ngừng ngay, giữ phần đã nhận (có chip hậu kiểm trên phần đó).

**Why**: Câu trả lời dài/sai hướng — kiểm soát chi phí & thời gian.

**Independent Test**: Bắt đầu 1 câu trả lời dài → bấm Dừng → text ngừng tăng, phần đã có được giữ + chip hợp lệ.

**Acceptance Scenarios**:

1. **Given** đang stream, **When** bấm Dừng, **Then** dừng gọi model, giữ phần đã nhận, hậu kiểm chip trên
   phần đó, không báo lỗi.
2. **Given** đã dừng, **Then** composer trở lại trạng thái nhập được (nút gửi thay nút Dừng).

---

### User Story 3 - An toàn & riêng tư không đổi (Priority: P1)

Streaming không phá vỡ ranh giới: network chỉ ở main, không log nội dung; provider online vẫn opt-in + badge.

**Independent Test**: Stream bằng Ollama local → badge "local", không request ngoài. Không có nội dung trong log.

**Acceptance Scenarios**:

1. **Given** provider local active, **When** stream, **Then** không egress; badge "local".
2. **Given** kiểm log, **Then** không có token/câu hỏi/đoạn nguồn.

---

### Edge Cases

- Lỗi mạng/model giữa stream → báo lỗi rõ; giữ phần đã nhận nếu có.
- prefers-reduced-motion → không animation con trỏ (hiện text tăng dần vẫn được, không nhấp nháy).
- Stream rỗng (model trả rỗng) → như "không tìm thấy" (grounded) / câu trả lời rỗng xử lý an toàn.
- Đóng notebook/gửi câu mới khi đang stream → huỷ stream cũ (không lẫn token).

## Requirements _(mandatory)_

- **FR-001**: Chat MUST hiển thị câu trả lời tăng dần theo token khi model sinh (provider đang active).
- **FR-002**: Khi stream kết thúc, hệ thống MUST hậu kiểm toàn văn → chip `[n]` bấm được (giữ cơ chế
  citation hiện có); trong lúc stream chip chưa xuất hiện (text thô).
- **FR-003**: MUST có nút Dừng khi đang stream; bấm → huỷ gọi model (AbortController), giữ phần đã nhận +
  hậu kiểm chip trên phần đó, KHÔNG coi là lỗi.
- **FR-004**: Streaming MUST hoạt động với provider đang active: Ollama (NDJSON) + 3 online (SSE).
- **FR-005**: Gọi mạng + đọc stream MUST chỉ ở main; renderer nhận token qua kênh IPC whitelisted; KHÔNG
  log token/câu hỏi/đoạn nguồn (Constitution III).
- **FR-006**: Chế độ grounded không căn cứ MUST KHÔNG stream nội dung bịa (giữ "Không tìm thấy").
- **FR-007**: Gửi câu mới / đổi notebook khi đang stream MUST huỷ stream trước (không lẫn token giữa lượt).
- **FR-008**: KHÔNG đổi Studio; KHÔNG migration; caller non-stream (Studio) giữ nguyên hành vi.
- **FR-009**: Lưu lịch sử (027) MUST vẫn hoạt động: lưu câu trả lời CUỐI (sau stream/dừng) như hiện tại.

### Key Entities

- **Không thực thể DB mới.** `RagAnswer` (đã có) là kết quả cuối. Token stream là sự kiện tạm (không lưu).

## Success Criteria _(mandatory)_

- **SC-001**: Câu trả lời hiện tăng dần; kết thúc có chip `[n]` bấm đúng nguồn.
- **SC-002**: Nút Dừng huỷ trong <1s, giữ phần đã nhận + chip hợp lệ.
- **SC-003**: Stream local Ollama không egress; không log nội dung.
- **SC-004**: 0 hồi quy — Studio, lịch sử hội thoại, citation, 2 chế độ, provider online vẫn đúng.

## Assumptions

- **A1** — `LLMProvider.chat(req, opts?:{onToken,signal})` — nhánh stream tuỳ chọn; caller cũ (Studio) không đổi.
- **A2** — IPC: `rag:askStream` (invoke → RagAnswer cuối) + event `rag:streamToken{streamId,delta}` +
  `rag:stop{streamId}`; AbortController theo streamId ở main.
- **A3** — Hậu kiểm citation trên toàn văn (hoặc phần đã nhận khi Dừng) — tái dùng `postprocessCitations`.
- **A4** — Parse NDJSON (Ollama) + SSE (online) THUẦN test được; đọc body stream = I/O (exclude coverage).

## Out of Scope

- Streaming Studio; streaming embedding; đổi cơ chế citation; đổi schema/migration.
