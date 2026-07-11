import { Navigate, useParams } from "react-router-dom";
import { SourceList } from "./SourceList";
import { ChatColumn } from "../rag-qa/ChatColumn";
import { SourceViewer } from "../source-viewer/SourceViewer";
import { useSourceViewer } from "../source-viewer/useSourceViewer";

// Workspace 3 cột (prototype S2). Cột NGUỒN (011) + Chat (013) + Studio (sau). Quản state trình xem nguồn
// (019): bấm chip [n] ở Chat hoặc bấm tên nguồn ở cột Nguồn → mở SourceViewer overlay.
export function Workspace(): JSX.Element {
  const { notebookId } = useParams<{ notebookId: string }>();
  const viewer = useSourceViewer();
  if (!notebookId) return <Navigate to="/notebooks" replace />;

  return (
    <div className="workspace" data-testid="workspace">
      <SourceList notebookId={notebookId} onOpenSource={viewer.openSource} />
      <ChatColumn notebookId={notebookId} onCite={viewer.openCitation} />
      <section className="studio-col" aria-label="Studio">
        <h2>Studio</h2>
        <p className="col-hint">Tóm tắt & ghi chú (bước sau).</p>
      </section>
      <SourceViewer viewer={viewer} />
    </div>
  );
}
