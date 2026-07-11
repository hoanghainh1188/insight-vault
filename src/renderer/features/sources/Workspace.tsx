import { Navigate, useParams } from "react-router-dom";
import { SourceList } from "./SourceList";
import { ChatColumn } from "../rag-qa/ChatColumn";

// Workspace 3 cột (prototype S2). Cột NGUỒN (011) + Chat (013-rag-qa); Studio (007-ui) sau.
export function Workspace(): JSX.Element {
  const { notebookId } = useParams<{ notebookId: string }>();
  if (!notebookId) return <Navigate to="/notebooks" replace />;

  return (
    <div className="workspace" data-testid="workspace">
      <SourceList notebookId={notebookId} />
      <ChatColumn notebookId={notebookId} />
      <section className="studio-col" aria-label="Studio">
        <h2>Studio</h2>
        <p className="col-hint">Tóm tắt & ghi chú (bước sau).</p>
      </section>
    </div>
  );
}
