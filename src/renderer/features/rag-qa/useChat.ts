import { useCallback, useEffect, useState } from "react";
import type { Citation, RagMode, RagTurn } from "@shared/ipc/types";

// Hook cột Chat: hội thoại IN-MEMORY phiên (không persist — A8) + gọi ragAsk + kiểm runtime/nguồn ready.
// Multi-turn: gửi toàn bộ lịch sử hiện có làm history (main tự cắt MAX_HISTORY_TURNS).

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  notFound?: boolean;
}

export function useChat(notebookId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<RagMode>("grounded");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runtimeReady, setRuntimeReady] = useState<boolean | null>(null);
  const [hasReadySources, setHasReadySources] = useState(false);

  // Đổi notebook → reset hội thoại (không persist).
  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [notebookId]);

  const refreshReadiness = useCallback(() => {
    window.api
      .aiGetRuntimeStatus()
      .then((s) => setRuntimeReady(s.ollamaReady))
      .catch(() => setRuntimeReady(false));
    window.api
      .sourceListByNotebook(notebookId)
      .then((list) =>
        setHasReadySources(list.some((s) => s.status === "ready")),
      )
      .catch(() => setHasReadySources(false));
  }, [notebookId]);

  useEffect(() => refreshReadiness(), [refreshReadiness]);

  // Nguồn vừa nạp xong → cập nhật lại "có nguồn ready".
  useEffect(() => {
    const off = window.api.onSourceProgress((e) => {
      if (e.notebookId === notebookId) refreshReadiness();
    });
    return off;
  }, [notebookId, refreshReadiness]);

  const canSend = runtimeReady === true && hasReadySources && !loading;

  const send = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || !canSend) return;
      setError(null);
      const history: RagTurn[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      setMessages((prev) => [...prev, { role: "user", content: q }]);
      setLoading(true);
      try {
        const res = await window.api.ragAsk({
          notebookId,
          question: q,
          mode,
          history,
        });
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.answer,
            citations: res.citations,
            notFound: res.notFound,
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không hỏi được.");
      } finally {
        setLoading(false);
      }
    },
    [canSend, messages, mode, notebookId],
  );

  return {
    messages,
    mode,
    setMode,
    loading,
    error,
    runtimeReady,
    hasReadySources,
    canSend,
    send,
  };
}
