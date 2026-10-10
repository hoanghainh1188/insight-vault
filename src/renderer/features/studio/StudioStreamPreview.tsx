import type { StudioKind } from "@shared/ipc/types";
import { stripCitationMarkers } from "./citation-strip";

// 178 (PR 4, FR-043/FR-044, clarify #5): chữ TẠM của lượt viết cuối — VĂN BẢN THƯỜNG (text node, React tự thoát), đã gỡ mọi
// dấu [n]; KHÔNG markdown, KHÔNG chip (chưa hậu kiểm). KHÔNG aria-live / role=status: trình đọc màn hình chỉ nghe các mốc
// (bắt đầu viết / xong / huỷ / lỗi) như 146/149, không từng mẩu chữ. Xong ⇒ thay bằng phiên bản đã hậu kiểm; huỷ ⇒ bỏ.

interface StudioStreamPreviewProps {
  kind: StudioKind;
  text: string;
}

export function StudioStreamPreview({
  kind,
  text,
}: StudioStreamPreviewProps): JSX.Element | null {
  const shown = stripCitationMarkers(text);
  if (shown.trim() === "") return null;
  return (
    <div className="studio-stream" data-testid={`studio-stream-${kind}`}>
      {shown}
    </div>
  );
}
