# Quickstart — kiểm chứng 085 vault-backup

## Tự động

```bash
npm run lint && npm test -- --coverage && npm run build
npx playwright test tests/e2e/vault-backup.spec.ts   # IV_EMBED_FAKE + IV_E2E_DIALOG_PATH (helper)
```

Unit (vitest, `tests/unit/vault-backup-*.test.ts`) phải phủ: container header (encode/parse/sai magic/formatVersion),
round-trip pack→unpack có/không mật khẩu, sai mật khẩu, sửa 1 byte (giữa body / cuối ciphertext / header), entry
`..`/symlink/ngoài allowlist ⇒ từ chối, snapshot VACUUM INTO trên DB WAL đang mở, manifest validate, prepare
(schema mới hơn ⇒ `newerSchema`, cũ hơn ⇒ được nâng), state machine hoán đổi (thành công, lỗi ở A/B ⇒ rollback,
crash giữa A/B ⇒ boot kế hoàn tất), retention giữ 3, busy/lock.

## Thủ công (bản build `out/` hoặc đóng gói — relaunch không chạy đúng ở `electron-vite dev`)

1. Tạo notebook "A", nạp `tests/fixtures/sample.pdf`, hỏi 1 câu có chip `[n]`, chạy 1 tóm tắt Studio.
2. Cài đặt → Lưu trữ cục bộ → **Sao lưu…**, đặt mật khẩu `matkhau123` (2 lần) → thấy bước tiến trình → thông báo
   thành công kèm kích thước.
3. Xoá notebook "A", tạo notebook "B".
4. **Khôi phục…** → chọn file → nhập sai mật khẩu ⇒ "Sai mật khẩu hoặc file sao lưu bị hỏng", vault không đổi → nhập
   đúng ⇒ thấy tóm tắt (1 notebook, 1 nguồn, ngày tạo) → Xác nhận.
5. App tự khởi động lại → thông báo khôi phục thành công + vị trí bản tự sao lưu; chỉ có notebook "A"; chat + Studio
   còn; bấm chip `[n]` ⇒ mở đúng nguồn + highlight; hỏi câu mới trả lời ngay (không reindex).
6. `<userData>/backups/` có `pre-restore-*.ivbackup` (chứa notebook "B"). Khôi phục 4 lần ⇒ chỉ còn 3 bản.
7. Đang nạp 1 nguồn lớn ⇒ nút Sao lưu/Khôi phục bị vô hiệu kèm "Đang xử lý nguồn…".
8. Tắt mạng (hoặc theo dõi badge egress) suốt các bước ⇒ không có egress (SC-006).
