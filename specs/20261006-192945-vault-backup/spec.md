# Feature Specification: Sao lưu / khôi phục vault

**Feature Branch**: `085-vault-backup`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "Thêm tính năng sao lưu (backup) và khôi phục (restore) toàn bộ vault cho InsightVault
— ứng dụng desktop local-first — để người dùng không mất dữ liệu khi hỏng máy/xoá nhầm và có thể chuyển sang
máy mới… (nguyên văn: `docs/intake/085-vault-backup.md` mục _Prompt for /speckit-specify_; quyết định:
`docs/04-decisions/2026-10-06-vault-backup-clarify.md`)"

## Clarifications

### Session 2026-10-06

Câu hỏi lớn đã chốt ở `docs/04-decisions/2026-10-06-vault-backup-clarify.md` (không hỏi lại). Rà soát còn 3
khoảng trống nhỏ, lấp bằng mặc định (không hỏi người dùng — tác động thấp, có phương án an toàn rõ):

- Q: File mã hoá có lộ manifest khi chưa nhập mật khẩu không? → A: Không. Phần không mã hoá chỉ gồm nhận
  diện định dạng + cờ "có mã hoá"; mọi thông tin khác (ngày tạo, số notebook/nguồn, phiên bản) chỉ hiện SAU khi
  nhập đúng mật khẩu.
- Q: Ràng buộc độ dài mật khẩu? → A: Tối thiểu 8 ký tự (không ép quy tắc phức tạp).
- Q: Người dùng biết khôi phục đã xong thế nào sau khi app tự khởi động lại? → A: Lần mở đầu tiên sau khôi
  phục hiện thông báo thành công (ngày tạo bản sao lưu đã khôi phục + vị trí bản tự sao lưu); thất bại → thông
  báo lỗi + vault cũ.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Sao lưu vault ra 1 file (Priority: P1)

Người dùng mở **Cài đặt → Lưu trữ cục bộ**, bấm **"Sao lưu…"**, chọn nơi lưu (có thể là ổ ngoài/USB). Hệ
thống tạo **một file sao lưu** (`.ivbackup`) chứa toàn bộ notebook, nguồn đã xử lý, đoạn trích, lịch sử chat,
kết quả Studio, chỉ mục tìm kiếm và cấu hình — đủ để khôi phục và dùng ngay mà không phải xử lý lại.

**Why this priority**: App local-first: dữ liệu chỉ nằm trên 1 máy. Hỏng ổ đĩa/mất máy hiện = mất toàn bộ
công sức nạp và hỏi đáp. Sao lưu là lớp bảo vệ dữ liệu tối thiểu.

**Independent Test**: Có 1 notebook với vài nguồn + chat → bấm Sao lưu → file được tạo ở vị trí đã chọn,
mở được để kiểm tra manifest (số notebook/nguồn đúng); app vẫn dùng bình thường.

**Acceptance Scenarios**:

1. **Given** đang ở Cài đặt → Lưu trữ, **When** bấm "Sao lưu…", **Then** hệ thống mở hộp thoại lưu file (tên
   gợi ý có ngày giờ, đuôi `.ivbackup`) và cho chọn có/không đặt mật khẩu.
2. **Given** chọn vị trí lưu hợp lệ, **When** xác nhận, **Then** tạo 1 file chứa dữ liệu vault + manifest, hiện
   tiến trình theo bước và thông báo thành công (kích thước, vị trí).
3. **Given** đang tạo file, **When** xảy ra lỗi (hết dung lượng, không ghi được), **Then** file dở dang bị xoá,
   không để lại file hỏng, báo lỗi rõ; vault hiện tại không bị ảnh hưởng.
4. **Given** không đặt mật khẩu, **Then** UI cảnh báo file không mã hoá và chứa nội dung tài liệu đọc được.
5. **Given** vault rỗng (chưa có notebook), **When** sao lưu, **Then** vẫn tạo được file (manifest 0 notebook /
   0 nguồn).

---

### User Story 2 - Khôi phục vault từ file sao lưu (Priority: P1)

Người dùng (trên máy cũ sau sự cố, hoặc máy mới) bấm **"Khôi phục…"**, chọn file `.ivbackup`. Hệ thống hiện tóm
tắt bản sao lưu và cảnh báo **toàn bộ vault hiện tại sẽ bị thay thế**. Khi xác nhận, hệ thống tự sao lưu vault
hiện tại (đường lùi), khởi động lại và mở ra đúng dữ liệu trong bản sao lưu.

**Why this priority**: Sao lưu chỉ có giá trị khi khôi phục được. Ngang P1 với US1 — hai story tạo thành một
vòng hoàn chỉnh.

**Independent Test**: Sao lưu vault A → xoá notebook / thêm notebook khác → khôi phục file → sau khởi động lại,
vault đúng như lúc sao lưu; hỏi đáp có chip `[n]` mở đúng nguồn + highlight ngay, không xử lý lại.

**Acceptance Scenarios**:

1. **Given** bấm "Khôi phục…", **When** chọn file `.ivbackup` hợp lệ, **Then** hiện tóm tắt (ngày tạo, số
   notebook/nguồn, phiên bản app tạo ra, có mã hoá hay không) và hộp thoại xác nhận nêu rõ ghi đè toàn bộ.
2. **Given** xác nhận, **Then** app tự tạo bản sao lưu của vault hiện tại vào thư mục sao lưu nội bộ, khởi động
   lại, thay dữ liệu trước khi mở vault, rồi vào app với dữ liệu của bản sao lưu.
3. **Given** khôi phục xong, **Then** notebook, nguồn, lịch sử chat, kết quả Studio hiển thị đủ; hỏi đáp có
   trích dẫn hoạt động ngay; chip `[n]` mở đúng nguồn và highlight đúng đoạn.
4. **Given** thay dữ liệu thất bại giữa chừng (hoặc app tắt đột ngột lúc đó), **Then** vault quay lại nguyên
   trạng trước khôi phục và người dùng được báo lỗi rõ.
5. **Given** người dùng huỷ ở bất kỳ bước nào trước khi xác nhận, **Then** vault không đổi và không tạo bản tự
   sao lưu.

---

### User Story 3 - Bảo vệ file sao lưu bằng mật khẩu (Priority: P2)

Người dùng làm việc với tài liệu nhạy cảm (luật sư, nhà báo) đặt mật khẩu khi sao lưu. File chỉ mở được khi
có đúng mật khẩu.

**Why this priority**: File sao lưu thường được mang ra ngoài máy (USB, ổ ngoài) — mã hoá giữ nguyên tinh thần
riêng tư của app. P2 vì US1+US2 không mã hoá đã đủ chống mất dữ liệu.

**Independent Test**: Sao lưu có mật khẩu → file không đọc được nội dung khi không có mật khẩu → khôi phục với
mật khẩu sai bị từ chối, vault giữ nguyên → khôi phục với mật khẩu đúng thành công.

**Acceptance Scenarios**:

1. **Given** chọn đặt mật khẩu, **When** nhập 2 lần khớp nhau và không rỗng, **Then** file được mã hoá; 2 lần
   không khớp hoặc ngắn hơn 8 ký tự → không cho tiếp tục.
2. **Given** màn đặt mật khẩu, **Then** hiện cảnh báo rõ "quên mật khẩu = không mở được bản sao lưu".
3. **Given** khôi phục file mã hoá, **When** nhập đúng mật khẩu, **Then** tiếp tục luồng US2.
4. **Given** nhập sai mật khẩu (hoặc file bị sửa), **Then** báo "Sai mật khẩu hoặc file sao lưu bị hỏng", vault
   giữ nguyên, cho nhập lại.

---

### Edge Cases

- **Sai mật khẩu / file bị sửa đổi / hỏng** → 1 thông báo chung "Sai mật khẩu hoặc file sao lưu bị hỏng"; vault
  giữ nguyên. File không phải bản sao lưu InsightVault (sai định dạng, thiếu manifest) → thông báo riêng
  "Không phải file sao lưu InsightVault".
- **Bản sao lưu tạo từ phiên bản app mới hơn** (cấu trúc dữ liệu mới hơn) → từ chối, hướng dẫn cập nhật app.
- **Bản sao lưu từ phiên bản cũ hơn** → chấp nhận; dữ liệu được nâng cấp tự động khi mở.
- **Bản sao lưu dùng mô hình embedding khác** → chấp nhận; app tự lập chỉ mục lại nền như cơ chế sẵn có.
- **Đang có nguồn xử lý hoặc lập chỉ mục lại** → nút Sao lưu/Khôi phục bị vô hiệu kèm lý do "Đang xử lý
  nguồn…"; không xếp hàng chờ.
- **Hết dung lượng đĩa** khi sao lưu, khi tự sao lưu trước khôi phục, hoặc khi chuẩn bị dữ liệu khôi phục →
  dừng, dọn file dở, báo lỗi; không bao giờ làm hỏng vault hiện tại.
- **Máy mới thiếu file gốc media** → văn bản, trích dẫn, highlight vẫn dùng được; phát audio/video, xem ảnh,
  "Thử lại" báo lỗi theo hành vi thiếu file sẵn có.
- **Máy mới thiếu API key online** → không nằm trong bản sao lưu; người dùng nhập lại; provider online không tự
  hoạt động khi thiếu khoá.
- **Máy mới thiếu mô hình đã tải** (bóc băng, OCR, embedding) → tải lại theo cơ chế sẵn có khi cần.
- **File sao lưu chứa đường dẫn bất thường** (thoát ra ngoài thư mục đích, liên kết tượng trưng) → từ chối
  toàn bộ file.
- **Khởi động lại khi đang dở việc thay dữ liệu** → lần khởi động đó phát hiện trạng thái dở và hoàn tất hoặc
  quay lui an toàn.
- **Thư mục sao lưu nội bộ** giữ 3 bản tự sao lưu gần nhất; xoá bản cũ thất bại không chặn luồng khôi phục.

## Requirements _(mandatory)_

### Functional Requirements

**Sao lưu**

- **FR-001**: Section "Lưu trữ cục bộ" trong Cài đặt MUST có nút "Sao lưu…" và "Khôi phục…".
- **FR-002**: Khi sao lưu, hệ thống MUST để người dùng chọn vị trí và tên file qua hộp thoại lưu của hệ điều
  hành; tên gợi ý gồm ngày giờ và đuôi `.ivbackup`.
- **FR-003**: File sao lưu MUST chứa ảnh chụp nhất quán của toàn bộ dữ liệu vault (notebook, nguồn, đoạn trích
  kèm vị trí trích dẫn, lịch sử chat, kết quả Studio, chỉ mục tìm kiếm toàn văn), kho vector, và cấu hình app —
  đủ để khôi phục mà không phải xử lý/embed lại.
- **FR-004**: File sao lưu MUST KHÔNG chứa: file gốc của nguồn, mô hình AI đã tải, file tạm, API key online.
- **FR-005**: File sao lưu MUST kèm manifest: phiên bản app, phiên bản cấu trúc dữ liệu, phiên bản mô hình
  embedding, thời điểm tạo, cờ mã hoá, số notebook, số nguồn.
- **FR-006**: Ảnh chụp MUST nhất quán (không lấy file cơ sở dữ liệu đang ghi dở); app vẫn đọc/dùng được trong
  lúc sao lưu.
- **FR-007**: Sao lưu MUST ghi file tạm rồi mới đổi tên thành file đích khi hoàn tất; mọi lỗi giữa chừng xoá
  file dở.
- **FR-008**: Hệ thống MUST hiển thị tiến trình theo bước và kết quả cuối (thành công kèm kích thước + vị trí,
  hoặc lỗi kèm lý do).

**Khôi phục**

- **FR-009**: Khi khôi phục, hệ thống MUST để người dùng chọn file qua hộp thoại mở của hệ điều hành (lọc
  `.ivbackup`).
- **FR-010**: Trước khi xác nhận, hệ thống MUST kiểm tra định dạng + toàn vẹn + tương thích và hiện tóm tắt
  manifest.
- **FR-011**: Hệ thống MUST từ chối bản sao lưu có phiên bản cấu trúc dữ liệu mới hơn app đang chạy, kèm hướng
  dẫn cập nhật app; MUST chấp nhận bản cũ hơn và nâng cấp tự động khi mở.
- **FR-012**: Hộp thoại xác nhận MUST nêu rõ toàn bộ vault hiện tại sẽ bị thay thế; huỷ thì không đổi gì.
- **FR-013**: Sau xác nhận và trước khi thay dữ liệu, hệ thống MUST tự sao lưu vault hiện tại (không mã hoá)
  vào thư mục sao lưu nội bộ của app và giữ 3 bản gần nhất.
- **FR-014**: Hệ thống MUST thay dữ liệu vault khi app khởi động lại, **trước** khi mở vault; app tự khởi động
  lại sau xác nhận.
- **FR-015**: Thay dữ liệu MUST nguyên tử theo nghĩa người dùng: hoặc vault mới đầy đủ, hoặc vault cũ nguyên
  vẹn. Thất bại / gián đoạn → quay về vault cũ và báo lỗi ở lần mở app kế tiếp.
- **FR-016**: Sau khôi phục, trích dẫn `[n]` MUST mở đúng nguồn và đúng vị trí như trước khi sao lưu.
- **FR-016a**: Lần mở app đầu tiên sau khi thay dữ liệu MUST thông báo kết quả: thành công (ngày tạo bản sao
  lưu đã khôi phục, vị trí bản tự sao lưu) hoặc thất bại (lý do, vault cũ được giữ).
- **FR-017**: Nếu mô hình embedding của bản sao lưu khác với app hiện tại, hệ thống MUST lập chỉ mục lại theo
  cơ chế nền sẵn có.

**Mã hoá**

- **FR-018**: Khi sao lưu, người dùng MAY đặt mật khẩu; MUST nhập 2 lần khớp nhau, tối thiểu 8 ký tự.
- **FR-019**: File có mật khẩu MUST được mã hoá bằng thuật toán đối xứng mạnh (AES-256) với khoá dẫn xuất từ
  mật khẩu bằng hàm dẫn xuất chậm có salt ngẫu nhiên, và MUST có xác thực toàn vẹn.
- **FR-020**: UI MUST cảnh báo quên mật khẩu = không mở được bản sao lưu; khi không đặt mật khẩu, UI MUST cảnh
  báo file chứa nội dung đọc được.
- **FR-021**: Khôi phục file mã hoá MUST hỏi mật khẩu; sai mật khẩu hoặc file bị sửa MUST bị phát hiện **trước**
  khi đụng tới vault, báo "Sai mật khẩu hoặc file sao lưu bị hỏng" và cho nhập lại.
- **FR-021a**: Với file mã hoá, phần đọc được khi chưa có mật khẩu MUST chỉ gồm nhận diện định dạng và cờ mã
  hoá; manifest đầy đủ chỉ hiển thị sau khi giải mã thành công.
- **FR-022**: Mật khẩu MUST KHÔNG được lưu ở bất kỳ đâu và KHÔNG xuất hiện trong log.

**Ràng buộc chung**

- **FR-023**: Sao lưu/khôi phục MUST hoàn toàn cục bộ, không có kết nối mạng.
- **FR-024**: Mọi thao tác đọc/ghi file, mã hoá, chụp dữ liệu MUST nằm ở tiến trình chính; giao diện chỉ gửi yêu
  cầu và nhận kết quả, MUST KHÔNG truyền đường dẫn file tuỳ ý — đường dẫn chỉ đến từ hộp thoại do tiến trình
  chính mở.
- **FR-025**: Khi giải nén, hệ thống MUST từ chối mục có đường dẫn thoát khỏi thư mục đích hoặc liên kết tượng
  trưng, và chỉ chấp nhận các mục thuộc danh sách thành phần cho phép.
- **FR-026**: Khi có nguồn đang xử lý hoặc đang lập chỉ mục lại, nút Sao lưu/Khôi phục MUST bị vô hiệu kèm lý
  do.
- **FR-027**: Log MUST KHÔNG chứa nội dung tài liệu hay mật khẩu.

### Key Entities _(include if feature involves data)_

- **Bản sao lưu (backup file)**: 1 file `.ivbackup` = manifest + dữ liệu vault (ảnh chụp CSDL, kho vector,
  cấu hình); có thể được mã hoá toàn bộ.
- **Manifest**: siêu dữ liệu mô tả bản sao lưu (phiên bản app, phiên bản cấu trúc dữ liệu, phiên bản mô hình
  embedding, thời điểm tạo, mã hoá, số notebook/nguồn). Hiển thị trước khi xác nhận; với file mã hoá chỉ
  đọc được sau khi giải mã (phần hở chỉ có nhận diện định dạng + cờ mã hoá).
- **Bản tự sao lưu trước khôi phục (pre-restore backup)**: bản sao lưu không mã hoá vault hiện tại, tạo tự động
  trong thư mục nội bộ của app, giữ 3 bản gần nhất.
- **Dữ liệu chờ khôi phục (staged restore)**: nội dung bản sao lưu đã giải nén + kiểm tra, đặt sẵn chờ lần khởi
  động kế tiếp để thay vào vault, kèm đánh dấu trạng thái để hoàn tất/quay lui an toàn.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Người dùng tạo được bản sao lưu trong ≤ 3 thao tác từ màn Cài đặt; vault 500 MB sao lưu xong
  trong dưới 2 phút trên máy phổ thông.
- **SC-002**: 100% vòng sao lưu → khôi phục trong bộ kiểm thử cho ra vault tương đương (cùng số notebook, nguồn,
  đoạn trích, tin nhắn chat, kết quả Studio; trích dẫn mở đúng vị trí).
- **SC-003**: 0 trường hợp vault bị hỏng hoặc nửa vời khi khôi phục thất bại/gián đoạn trong kiểm thử lỗi (lỗi
  ghi, lỗi giải mã, tắt đột ngột giữa lúc thay dữ liệu).
- **SC-004**: 100% file mã hoá mở với mật khẩu sai hoặc bị sửa 1 byte đều bị từ chối trước khi vault bị đụng tới.
- **SC-005**: Sau khôi phục, người dùng hỏi đáp được ngay (không chờ xử lý/embed lại) khi bản sao lưu dùng cùng
  mô hình embedding.
- **SC-006**: Không có kết nối mạng nào phát sinh trong toàn bộ luồng sao lưu/khôi phục.

## Assumptions

- Data dir là thư mục dữ liệu ứng dụng chuẩn của hệ điều hành (quyết định 001); app chạy 1 phiên duy nhất
  (single-instance lock 070) nên không có tiến trình khác ghi vault lúc thay dữ liệu.
- Phiên bản cấu trúc dữ liệu tăng dần theo migration append-only; migration hiện có nâng được mọi phiên bản cũ.
- Cơ chế lập chỉ mục lại nền khi đổi mô hình embedding (059) dùng lại nguyên vẹn.
- Chỉ thủ công ở v1; tự động định kỳ, gộp notebook, đồng bộ đám mây, UI quản lý danh sách bản tự sao lưu nằm
  ngoài phạm vi.
- Thư mục sao lưu nội bộ nằm trong data dir (cùng máy, cùng mức bảo vệ với vault vốn không mã hoá) nên bản tự
  sao lưu không mã hoá.
- Văn phong UI tiếng Việt theo prototype S5; không i18n.
