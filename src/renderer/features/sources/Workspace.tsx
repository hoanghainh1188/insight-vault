import { useEffect, type CSSProperties } from "react";
import { Navigate, useParams } from "react-router-dom";
import { SourceList } from "./SourceList";
import { ChatColumn } from "../rag-qa/ChatColumn";
import { StudioColumn } from "../studio/StudioColumn";
import { SourceViewer } from "../source-viewer/SourceViewer";
import { useSourceViewer } from "../source-viewer/useSourceViewer";
import { useColumnWidths } from "./useColumnWidths";
import { setLastNotebookId } from "../../shared/lastNotebook";

// Workspace 3 cột (prototype S2). Cột NGUỒN (011) + Chat (013) + Studio (021). Quản state trình xem nguồn
// (019). 025: kéo đổi độ rộng cột (splitter + CSS var) + nhớ notebook gần nhất (nav).
export function Workspace(): JSX.Element {
  const { notebookId } = useParams<{ notebookId: string }>();
  const viewer = useSourceViewer();
  const { widths, onDragSrc, onDragStudio } = useColumnWidths();

  // Nhớ notebook mở gần nhất (C) — nút Workspace trên rail dùng để mở lại.
  useEffect(() => {
    if (notebookId) setLastNotebookId(notebookId);
  }, [notebookId]);

  if (!notebookId) return <Navigate to="/notebooks" replace />;

  const style = {
    "--col-src": `${widths.src}px`,
    "--col-studio": `${widths.studio}px`,
  } as CSSProperties;

  return (
    <div className="workspace" data-testid="workspace" style={style}>
      <SourceList notebookId={notebookId} onOpenSource={viewer.openSource} />
      <div
        className="col-splitter"
        data-testid="splitter-src"
        onPointerDown={onDragSrc}
        role="separator"
        aria-orientation="vertical"
        aria-label="Kéo đổi độ rộng cột Nguồn"
      />
      <ChatColumn notebookId={notebookId} onCite={viewer.openCitation} />
      <div
        className="col-splitter"
        data-testid="splitter-studio"
        onPointerDown={onDragStudio}
        role="separator"
        aria-orientation="vertical"
        aria-label="Kéo đổi độ rộng cột Studio"
      />
      <StudioColumn notebookId={notebookId} onCite={viewer.openCitation} />
      <SourceViewer viewer={viewer} />
    </div>
  );
}
