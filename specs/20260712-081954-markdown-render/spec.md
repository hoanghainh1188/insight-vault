# Feature Specification: Markdown render (Chat + Studio, giữ chip [n])

**Feature Branch**: `029-markdown-render`

**Created**: 2026-07-12

**Status**: Draft

**Input**: Hiển thị markdown cho câu trả lời Chat + kết quả Studio (hiện text thuần), giữ chip trích dẫn `[n]`
bấm được. Render an toàn (không HTML thô), không phụ thuộc mạng.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Câu trả lời/kết quả hiển thị định dạng markdown (Priority: P1)

Người dùng nhận câu trả lời AI hoặc bản tổng hợp Studio có cấu trúc (tiêu đề, đậm/nghiêng, danh sách, khối
code) — nay hiển thị đúng định dạng thay vì văn bản thô lẫn ký tự `**`, `#`, `-`.

**Why this priority**: Cải thiện trực tiếp khả năng đọc — giá trị chính của yêu cầu.

**Independent Test**: Câu trả lời có `**đậm**`, `- gạch đầu dòng`, `# tiêu đề`, khối code → hiển thị đậm,
danh sách, tiêu đề, khối code đúng; không còn lộ ký tự markdown thô.

**Acceptance Scenarios**:

1. **Given** một câu trả lời AI chứa markdown, **When** hiển thị ở cột Chat, **Then** đậm/nghiêng/tiêu đề/
   danh sách/khối code render đúng định dạng.
2. **Given** một kết quả Studio chứa markdown, **When** hiển thị, **Then** cũng render đúng định dạng.
3. **Given** tin của người dùng (câu hỏi), **When** hiển thị, **Then** giữ nguyên văn bản (không diễn giải
   markdown).

---

### User Story 2 - Chip trích dẫn vẫn hoạt động trong markdown (Priority: P1)

Chip `[n]` nằm lẫn trong nội dung markdown vẫn hiển thị đúng kiểu chip và bấm được để mở nguồn.

**Why this priority**: "Kiểm chứng được" là bất biến — không được đánh mất khi thêm markdown.

**Independent Test**: Câu trả lời markdown có `[1]` giữa đoạn đậm/danh sách → chip `[1]` hiển thị đúng kiểu,
bấm mở đúng nguồn/đoạn.

**Acceptance Scenarios**:

1. **Given** nội dung markdown có chip `[n]`, **When** hiển thị, **Then** `[n]` là chip bấm được (không phải
   text thô), mở đúng nguồn/đoạn.
2. **Given** một chuỗi `[n]` nằm trong khối code, **When** hiển thị, **Then** giữ nguyên literal (không thành
   chip).

---

### User Story 3 - An toàn & offline (Priority: P1)

Nội dung do mô hình sinh không thể chèn mã độc (HTML/script); hiển thị không cần mạng.

**Why this priority**: Nội dung LLM là dữ liệu không tin cậy — bảo mật là bất biến.

**Independent Test**: Câu trả lời chứa `<script>`/`<img onerror=…>`/HTML thô → hiển thị dưới dạng văn bản
(không thực thi); không phát sinh yêu cầu mạng.

**Acceptance Scenarios**:

1. **Given** nội dung chứa thẻ HTML thô, **When** hiển thị, **Then** không thực thi HTML/script (hiển thị an
   toàn).
2. **Given** một liên kết markdown, **When** hiển thị, **Then** hiển thị chữ liên kết, KHÔNG điều hướng ra
   ngoài.
3. **Given** hiển thị markdown, **When** app chạy, **Then** không tải tài nguyên từ nguồn ngoài.

---

### Edge Cases

- Markdown không hợp lệ / lồng nhau lạ → hiển thị hợp lý, không crash (thoái lui về văn bản).
- Chip `[n]` sát ký hiệu markdown (`**[1]**`) → vẫn thành chip đúng.
- Nội dung rất dài → hiển thị đầy đủ, không vỡ bố cục.
- Không có thực thể dữ liệu mới; không đổi nội dung đã lưu (chỉ đổi cách render).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Hệ thống MUST hiển thị câu trả lời AI (Chat) và kết quả Studio dưới dạng markdown cho các cấu
  trúc: tiêu đề, đậm, nghiêng, mã nội dòng, danh sách gạch đầu dòng và đánh số, khối mã, đoạn văn, xuống dòng.
- **FR-002**: Tin của người dùng (câu hỏi) MUST giữ nguyên văn bản (không diễn giải markdown).
- **FR-003**: Chip trích dẫn `[n]` trong nội dung markdown MUST hiển thị đúng kiểu chip và giữ hành vi bấm
  (mở đúng nguồn/đoạn).
- **FR-004**: Chuỗi `[n]` nằm trong mã nội dòng/khối mã MUST giữ nguyên literal (không thành chip).
- **FR-005**: Hệ thống MUST render bằng phần tử giao diện an toàn (KHÔNG chèn HTML thô); thẻ HTML/script
  trong nội dung MUST KHÔNG được thực thi.
- **FR-006**: Liên kết trong markdown MUST hiển thị dạng chữ, KHÔNG điều hướng ra ngoài (giữ local-first).
- **FR-007**: Việc hiển thị markdown MUST KHÔNG tải bất kỳ tài nguyên nào từ nguồn ngoài (không CDN/mạng).
- **FR-008**: Thay đổi này MUST KHÔNG sửa dữ liệu đã lưu hay luồng logic (hỏi đáp/Studio) — chỉ đổi cách
  hiển thị.

### Key Entities _(include if feature involves data)_

- Không có thực thể dữ liệu mới. Thuần trình bày.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Nội dung markdown ở Chat + Studio hiển thị đúng định dạng (đậm/nghiêng/tiêu đề/danh sách/khối
  mã) — không còn lộ ký tự markdown thô.
- **SC-002**: 100% chip `[n]` trong nội dung markdown giữ hành vi bấm mở đúng nguồn/đoạn.
- **SC-003**: Nội dung chứa HTML/script hiển thị an toàn (không thực thi) — kiểm được bằng nội dung thử.
- **SC-004**: 0 yêu cầu tải tài nguyên từ nguồn ngoài khi hiển thị (app chạy offline).
- **SC-005**: 0 hồi quy — luồng hỏi đáp, Studio, mở nguồn từ chip vẫn hoạt động đúng.

## Assumptions

- **A1 — Hand-roll markdown tối giản** thành phần tử giao diện (không thư viện/CDN); subset: tiêu đề #..###,
  đậm, nghiêng, mã nội dòng, danh sách -/1., khối mã ```, đoạn, xuống dòng. (docs/04-decisions/
  2026-07-12-markdown-render-clarify.md)
- **A2 — Áp cho câu trả lời AI (Chat) + kết quả Studio**, không áp cho tin người dùng.
- **A3 — Chip `[n]` tokenize ở lớp nội dòng**; không thành chip khi ở trong mã.
- **A4 — Liên kết render dạng chữ**, không điều hướng ngoài.
- **A5 — Render bằng phần tử giao diện an toàn** (không HTML thô).
- **A6 — Kế thừa** chip/citation (013), openCitation (019); tách helper dùng chung thay `renderWithChips`.

## Out of Scope

- Bảng, ảnh, HTML thô nhúng.
- Liên kết điều hướng ra ngoài.
- Sửa dữ liệu đã lưu; thay đổi main/IPC/DB.
- Markdown editor/nhập liệu.
