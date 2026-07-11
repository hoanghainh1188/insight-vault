import { Navigate, useParams } from "react-router-dom";
import { SourceList } from "./SourceList";

// Workspace 3 cột (prototype S2). Feature 011 hiện thực cột NGUỒN; Chat (005) + Studio (007-ui) sau.
export function Workspace(): JSX.Element {
  const { notebookId } = useParams<{ notebookId: string }>();
  if (!notebookId) return <Navigate to="/notebooks" replace />;

  return (
    <div className="workspace" data-testid="workspace">
      <SourceList notebookId={notebookId} />
      <section className="chat-col" aria-label="Hỏi đáp">
        <h2>Hỏi đáp</h2>
        <p className="col-hint">
          Trò chuyện theo nguồn sẽ có ở bước RAG (005).
        </p>
      </section>
      <section className="studio-col" aria-label="Studio">
        <h2>Studio</h2>
        <p className="col-hint">Tóm tắt & ghi chú (bước sau).</p>
      </section>
    </div>
  );
}
