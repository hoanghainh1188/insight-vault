## Quillhold 0.3.0

**English** · [Tiếng Việt](#tiếng-việt)

**InsightVault is now Quillhold.** The app was renamed to avoid a trademark clash; everything else works as before, and your existing data carries over.

### ✨ What's new

- **New name: Quillhold.** The window title, menus, About box, backup file names (`Quillhold-….ivbackup`) and installers now use the new name.
- **Your data stays put.** Notebooks, sources, chats, settings, backups and saved online-AI keys are kept — the app keeps reading the same data folder and keychain entry it used before. Old `.ivbackup` files still restore.
- **Distribution-friendly licenses.** The app's own code stays **MIT**. A full list of the bundled libraries, AI models and their licenses now ships with the app (`THIRD-PARTY-NOTICES.md`, also in the repository).
- **Video audio extraction** now uses a minimal **LGPL** build of FFmpeg instead of a GPL one. Supported audio inside videos: AAC, MP3, MP2, Opus, Vorbis, FLAC, AC-3/E-AC-3, WMA, ALAC and PCM. Videos with other audio codecs (for example DTS or TrueHD) may fail to import.

### ⚠️ Notes

- **Windows:** this is the first release built with the new FFmpeg on Windows. If the installer or video import misbehaves, please open an issue.
- **Upgrading:** install over the old version. On macOS the app is now `Quillhold.app` — you can delete the old `InsightVault.app` afterwards.
- The GitHub repository moved to `hoanghainh1188/quillhold` (old links redirect).

### ⚠️ Installing (unsigned builds)

- macOS: if blocked → right-click → **Open**, or `xattr -dr com.apple.quarantine /Applications/Quillhold.app`.
- Windows: SmartScreen → **More info → Run anyway**.

---

### Tiếng Việt

**InsightVault nay là Quillhold.** App được đổi tên để tránh trùng nhãn hiệu; mọi thứ khác hoạt động như cũ và dữ liệu hiện có được giữ nguyên.

#### ✨ Có gì mới

- **Tên mới: Quillhold.** Tiêu đề cửa sổ, menu, hộp Giới thiệu, tên tệp backup (`Quillhold-….ivbackup`) và bộ cài đều dùng tên mới.
- **Dữ liệu được giữ nguyên.** Notebook, nguồn, hội thoại, cài đặt, backup và API key AI online đã lưu vẫn còn — app tiếp tục đọc đúng thư mục dữ liệu và mục keychain cũ. Các tệp `.ivbackup` cũ vẫn khôi phục được.
- **Giấy phép thuận lợi cho phân phối.** Mã của app vẫn là **MIT**. Danh sách đầy đủ thư viện, model AI và giấy phép nay đi kèm app (`THIRD-PARTY-NOTICES.md`, cũng có trong kho mã).
- **Tách audio từ video** nay dùng bản **LGPL** tối giản của FFmpeg thay cho bản GPL. Audio trong video được hỗ trợ: AAC, MP3, MP2, Opus, Vorbis, FLAC, AC-3/E-AC-3, WMA, ALAC và PCM. Video có codec audio khác (ví dụ DTS, TrueHD) có thể không nạp được.

#### ⚠️ Lưu ý

- **Windows:** đây là bản đầu tiên dựng với FFmpeg mới trên Windows. Nếu bộ cài hoặc nạp video có vấn đề, xin mở issue.
- **Nâng cấp:** cài đè lên bản cũ. Trên macOS app nay là `Quillhold.app` — có thể xoá `InsightVault.app` cũ sau đó.
- Kho GitHub đã chuyển sang `hoanghainh1188/quillhold` (liên kết cũ tự chuyển hướng).

#### ⚠️ Lưu ý cài đặt (chưa ký số)

- macOS: nếu bị chặn → chuột phải → **Open**, hoặc `xattr -dr com.apple.quarantine /Applications/Quillhold.app`.
- Windows: SmartScreen → **More info → Run anyway**.

**Full changelog:** https://github.com/hoanghainh1188/quillhold/compare/v0.2.23...v0.3.0
