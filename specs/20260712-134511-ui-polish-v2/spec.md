# Feature Specification: UI Polish v2 (tiến độ nguồn · nhãn [n] · Lưu trữ · polish)

**Feature Branch**: `037-ui-polish-v2`

**Created**: 2026-07-12

**Status**: Draft

**Input**: Đóng các gap UI so với `docs/03-ui/prototype.html` (giá-trị-cao / công-sức-thấp): tiến độ xử lý
nguồn realtime, nhãn `[n]` trên đoạn highlight ở Source Viewer, section "Lưu trữ cục bộ" ở Cài đặt, và
polish nhỏ (icon nguồn badge, skeleton danh sách nguồn). Thuần renderer là chính; 1 kênh IPC read-only.

## Clarifications

### Session 2026-07-12

- Q: Nguồn dữ liệu tiến độ %? → A: **Tái dùng `SourceProgressEvent{step,progress}`** đã phát từ main
  (hiện `useSources` reload rồi bỏ) — giữ ở renderer state, KHÔNG thêm cột DB.
- Q: "Lưu trữ" hiện gì? → A: **Đường dẫn data dir + dung lượng đã dùng + còn trống** (kênh read-only mới
  `app:getStorageInfo`; main tính size thư mục + `fs.statfs`). Không xoá/di chuyển dữ liệu ở feature này.
- Q: Nút "Thử lại" nguồn lỗi? → A: **Đã có sẵn** (SourceItem, status=error) — ngoài phạm vi.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Thấy tiến độ xử lý từng nguồn (Priority: P1)

Khi nạp nguồn, người dùng thấy nguồn đang ở bước nào và bao nhiêu % (không chỉ "đang xử lý" mơ hồ).

**Why this priority**: Phản hồi trực quan quan trọng nhất — người dùng biết app đang chạy, không "treo".

**Independent Test**: Nạp 1 PDF → dòng nguồn hiện nhãn bước + thanh %, cập nhật dần tới khi "Sẵn sàng".

**Acceptance Scenarios**:

1. **Given** nguồn đang xử lý, **When** nhận `SourceProgressEvent`, **Then** dòng nguồn hiện nhãn bước
   (Phân tích/Làm sạch/Chia đoạn/Nhúng/Lưu) + thanh tiến độ theo `progress`.
2. **Given** nguồn chuyển sang `ready`, **Then** thanh tiến độ biến mất, hiện trạng thái "Sẵn sàng".
3. **Given** nguồn `error`, **Then** không hiện thanh tiến độ, hiện lỗi + nút "Thử lại" (đã có).

---

### User Story 2 - Trích dẫn nổi bật trong Source Viewer (Priority: P2)

Đoạn được trích dẫn có nhãn `[n]` nhỏ phía trên để người dùng thấy ngay "đây là nguồn của trích dẫn nào".

**Why this priority**: Củng cố "kiểm chứng được" — nhưng highlight đã hoạt động, đây là tăng rõ ràng.

**Independent Test**: Bấm chip `[1]` → viewer mở, đoạn highlight có nhãn "[1]" phía trên.

**Acceptance Scenarios**:

1. **Given** viewer mở từ 1 trích dẫn, **When** hiển thị đoạn highlight, **Then** có nhãn `[n]` gắn phía
   trên/cạnh đoạn (không che chữ), cuộn tới đúng đoạn.

---

### User Story 3 - Xem dung lượng lưu trữ cục bộ (Priority: P2)

Người dùng thấy dữ liệu app lưu ở đâu và chiếm bao nhiêu — củng cố niềm tin "dữ liệu ở máy tôi".

**Why này priority**: Minh bạch local-first (Constitution I); prototype S5 có section này.

**Independent Test**: Mở Cài đặt → section "Lưu trữ cục bộ" hiện đường dẫn + dung lượng đã dùng + còn trống.

**Acceptance Scenarios**:

1. **Given** ở màn Cài đặt, **When** hiển thị, **Then** thấy đường dẫn thư mục dữ liệu + dung lượng đã dùng
   (định dạng dễ đọc) + dung lượng trống của ổ đĩa.
2. **Given** không đọc được thông tin (lỗi), **Then** hiện thông báo nhẹ, không crash.

---

### Edge Cases

- Nhiều nguồn xử lý tuần tự → mỗi dòng hiện tiến độ riêng, không lẫn.
- `progress` = 0 hoặc 1 → hiển thị hợp lý (0% khi bắt đầu, ẩn khi done).
- Data dir rất lớn → tính size không chặn UI (async), hiển thị "đang tính…" nếu chậm.
- Danh sách nguồn đang tải → skeleton thay vì trống.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Dòng nguồn đang xử lý MUST hiển thị bước hiện tại (nhãn tiếng Việt của `IngestStep`) + tiến độ
  `progress` (0..1) dưới dạng thanh/%, cập nhật realtime theo `SourceProgressEvent`.
- **FR-002**: Khi nguồn `ready`/`error`, MUST ẩn thanh tiến độ (trạng thái cuối hiển thị như hiện tại).
- **FR-003**: Tiến độ MUST giữ ở renderer state (KHÔNG thêm cột DB / migration).
- **FR-004**: Source Viewer MUST hiển thị nhãn `[n]` gắn với đoạn highlight (không che nội dung), giữ hành
  vi cuộn-tới-đoạn hiện có.
- **FR-005**: Cài đặt MUST có section "Lưu trữ cục bộ" hiển thị đường dẫn data dir + dung lượng đã dùng +
  còn trống, lấy qua kênh IPC read-only mới; lỗi → thông báo nhẹ.
- **FR-006**: Kênh `app:getStorageInfo` MUST chỉ đọc metadata cục bộ (kích thước thư mục, dung lượng ổ);
  KHÔNG log nội dung, KHÔNG egress.
- **FR-007**: Polish: icon nguồn hiển thị dạng badge (nền màu theo loại); danh sách nguồn hiện skeleton khi
  đang tải. KHÔNG đổi logic.
- **FR-008**: Mọi thay đổi MUST KHÔNG sửa logic ingestion/RAG/Studio — chỉ trình bày + 1 IPC đọc.

### Key Entities _(include if feature involves data)_

- **StorageInfo** (mới, cho IPC): `{ path: string, usedBytes: number, freeBytes: number }`. Không lưu DB.
- **SourceProgressEvent** (đã có): dùng `step` + `progress` (trước bị bỏ).

## Success Criteria _(mandatory)_

- **SC-001**: Nạp nguồn → thấy bước + % cập nhật realtime, kết thúc ở "Sẵn sàng".
- **SC-002**: Đoạn highlight trong viewer có nhãn `[n]` rõ ràng, không che chữ, cuộn đúng.
- **SC-003**: Cài đặt hiện đường dẫn + dung lượng dùng/trống chính xác (khớp thực tế thư mục).
- **SC-004**: 0 hồi quy — ingestion, RAG, Source Viewer highlight, Studio vẫn đúng.
- **SC-005**: Không egress, không log nội dung; không migration DB.

## Assumptions

- **A1** — Tiến độ tái dùng `SourceProgressEvent` (renderer state, không DB).
- **A2** — Nhãn `[n]` render bằng phần tử/CSS (`.hltag`), không đổi cơ chế highlight (`buildSegments`).
- **A3** — Storage: path (getDataDir đã có) + used (đệ quy size thư mục) + free (`fs.statfs`), kênh mới.
- **A4** — Retry đã có sẵn; icon badge + skeleton là polish CSS/nhẹ.

## Out of Scope

- Streaming, map-reduce, canvas PDF viewer, dark mode, phím tắt, tìm kiếm xuyên notebook.
- Xoá/di chuyển thư mục dữ liệu (chỉ hiển thị).
- Đổi schema/migration.
