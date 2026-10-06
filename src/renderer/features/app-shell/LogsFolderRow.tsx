import { useState } from "react";

// 088 — dòng "Nhật ký lỗi" ở Cài đặt → Lưu trữ cục bộ: mở thư mục nhật ký bằng trình quản lý tệp của HĐH để
// người dùng tự xem/gửi khi báo lỗi. Nhật ký chỉ nằm trên máy (local-first), không tự gửi đi đâu.
export function LogsFolderRow(): JSX.Element {
  const [failed, setFailed] = useState(false);

  async function open(): Promise<void> {
    setFailed(false);
    try {
      setFailed(!(await window.api.openLogsFolder()).ok);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="logs-row" data-testid="logs-row">
      <div>
        <h4>Nhật ký lỗi</h4>
        <p className="logs-desc">
          Ghi sự kiện và lỗi để chẩn đoán — không chứa nội dung tài liệu, chỉ
          lưu trên máy này.
        </p>
        {failed && (
          <p className="logs-error" role="status">
            Không mở được thư mục nhật ký.
          </p>
        )}
      </div>
      <button
        type="button"
        className="btn-outline-sm"
        onClick={() => void open()}
        data-testid="logs-open"
      >
        Mở thư mục nhật ký
      </button>
    </div>
  );
}
