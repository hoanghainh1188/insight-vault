# App-shell — đường dẫn thư mục dữ liệu cục bộ (F1)

- Ngày: 2026-07-11
- Feature liên quan: `001-app-shell` (issue #1)
- Câu hỏi gốc: `/speckit-analyze` phát hiện mâu thuẫn (F1) — spec/OVERVIEW/prototype nói `~/Library/InsightVault`
  (mac), còn plan chọn `app.getPath('userData')` → `~/Library/Application Support/InsightVault`. Không khớp.
- Người quyết định: hoanghainh1188 (2026-07-11)

## Quyết định
Dùng **`app.getPath('userData')`** của Electron làm thư mục dữ liệu cục bộ:
- macOS: `~/Library/Application Support/InsightVault`
- Windows: `%APPDATA%/InsightVault`

Và **sửa spec FR-011** cho khớp (đã cập nhật). Ghi chú "~/Library/InsightVault" trong OVERVIEW/prototype
là gợi ý bố cục, không phải ràng buộc cứng — theo Source-of-truth precedence, mâu thuẫn được nêu qua analyze
và chốt tại đây thay vì tự chọn im lặng.

## Lý do
- `userData` là chuẩn Electron, đúng convention từng OS, ít vấn đề quyền/sandbox, tự đúng khi đóng gói/ký app.
- Tránh tự ghép path thủ công (dễ sai chuẩn OS).

## Hệ quả
- Data-model/research/quickstart đã dùng `userData` → nhất quán, không phải sửa.
- Feature "đổi thư mục dữ liệu" (Settings, pha sau) cho phép override path này.
- OVERVIEW là nguồn gốc bất biến (không sửa tay); khác biệt path được ghi nhận tại quyết định này.
