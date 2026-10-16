# rename-quillhold — đổi tên sản phẩm InsightVault → Quillhold

- Ngày: 2026-10-16
- PR: #217 (giấy phép phân phối), #218 (đổi tên), đổi tên repo GitHub `insight-vault` → `quillhold`
- Nguồn: rà soát để phân phối an toàn về bản quyền/nhãn hiệu — `InsightVault™` đang được EDC (Edgar, Dunn & Company)
  dùng cho một nền tảng AI phân tích tài liệu (cùng lĩnh vực) → rủi ro trùng nhãn hiệu.

## Quyết định (người dùng chốt)

1. **Tên mới: Quillhold.** Tìm web + GitHub không thấy sản phẩm trùng. CHƯA tra cơ sở dữ liệu nhãn hiệu chính thức
   (USPTO, WIPO, Cục Sở hữu trí tuệ VN) — cần làm trước khi quảng bá rộng.
2. **Giữ nguyên định danh cũ có chủ đích** để người dùng đang dùng không mất dữ liệu / nâng cấp tại chỗ:
   - thư mục dữ liệu `…/InsightVault` (ghim `userData` khi đã tồn tại — `app-shell/user-data-path.ts`);
   - service keychain `InsightVault` (API key online đã lưu);
   - tên tệp DB nội bộ `insightvault.db` (cũng nằm trong định dạng `.ivbackup`);
   - `appId` `com.insightvault.app` (Windows nâng cấp tại chỗ).
   Không "dọn" các mục này nếu chưa có kế hoạch migrate dữ liệu.
3. **Tài liệu gốc KHÔNG sửa:** `docs/OVERVIEW.md`, `docs/01-basic-design`, `02-detail-design`, `03-ui` (kể cả prototype),
   cùng `specs/`, `docs/intake/` và các bản ghi quyết định lịch sử vẫn ghi "InsightVault". Đọc chúng với quy ước:
   **InsightVault = Quillhold**. Khi có bản mới của tài liệu gốc, thêm tệp mới + CHANGELOG theo `CLAUDE.md`.
4. Repo GitHub đổi tên `quillhold`; URL cũ được GitHub tự chuyển hướng (không dựa vào đó cho URL mới).

## Giấy phép đi kèm (#217)

FFmpeg LGPL tự dựng thay `ffmpeg-static` (GPL + nonfree); loại decoder AAC/WMA (GPL); `THIRD-PARTY-NOTICES.md` sinh
bằng `npm run licenses`.
