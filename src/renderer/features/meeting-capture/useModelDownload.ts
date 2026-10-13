import { useCallback, useState } from "react";
import { useT } from "../../shared/i18n/i18n-context";
import {
  describeIpcError,
  toParsedError,
} from "../../shared/i18n/describe-error";

// 186 PR B (T095) — tải model nhận dạng (meeting:downloadModel). Main nạp model trong worker ⇒ chỉ báo riêng tư "đang tải
// model" hiện suốt lúc tải; lỗi (thường do không có Internet) hiện bằng thông điệp đã dịch.

export interface ModelDownload {
  downloading: boolean;
  error: string | null;
  download(): Promise<boolean>;
}

export function useModelDownload(): ModelDownload {
  const t = useT();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = useCallback(async (): Promise<boolean> => {
    setDownloading(true);
    setError(null);
    try {
      await window.api.meetingDownloadModel();
      return true;
    } catch (e) {
      setError(describeIpcError(toParsedError(e), t));
      return false;
    } finally {
      setDownloading(false);
    }
  }, [t]);
  return { downloading, error, download };
}
