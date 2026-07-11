import { useCallback, useEffect, useState } from "react";
import type { Citation, SourceContent } from "@shared/ipc/types";

// State cột-viewer: mở theo chip trích dẫn (có citation → highlight) hoặc theo nguồn (citation=null → đầu
// tài liệu). Bấm chip/nguồn khác khi đang mở → cập nhật tại chỗ (A5). getContent CHỈ ở main qua IPC.

export interface ViewerTarget {
  sourceId: string;
  citation: Citation | null; // null = mở trực tiếp từ cột Nguồn (không highlight)
}

export function useSourceViewer() {
  const [target, setTarget] = useState<ViewerTarget | null>(null);
  const [content, setContent] = useState<SourceContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false); // nguồn đã xoá (A7)

  const open = useCallback((t: ViewerTarget) => setTarget(t), []);
  const openCitation = useCallback(
    (c: Citation) => setTarget({ sourceId: c.sourceId, citation: c }),
    [],
  );
  const openSource = useCallback(
    (sourceId: string) => setTarget({ sourceId, citation: null }),
    [],
  );
  const close = useCallback(() => {
    setTarget(null);
    setContent(null);
    setMissing(false);
  }, []);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setLoading(true);
    setMissing(false);
    setContent(null);
    window.api
      .sourceGetContent(target.sourceId)
      .then((c) => {
        if (cancelled) return;
        setContent(c);
        setMissing(c === null);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  return {
    target,
    content,
    loading,
    missing,
    isOpen: target !== null,
    open,
    openCitation,
    openSource,
    close,
  };
}

export type SourceViewerState = ReturnType<typeof useSourceViewer>;
