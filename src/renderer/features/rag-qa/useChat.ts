import { useCallback, useEffect, useRef, useState } from "react";
import type { Citation, RagMode, RagTurn } from "@shared/ipc/types";

// Hook cột Chat: nạp lịch sử hội thoại đã lưu theo notebook (027-chat-history) + gọi ragAskStream (streaming,
// 039; main tự persist câu trả lời cuối) + kiểm runtime/nguồn ready. Multi-turn: gửi lịch sử hiện có.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  notFound?: boolean;
  streaming?: boolean; // 039: đang nhận token (render text thô, chưa chip)
}

export function useChat(notebookId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<RagMode>("grounded");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runtimeReady, setRuntimeReady] = useState<boolean | null>(null);
  const [hasReadySources, setHasReadySources] = useState(false);
  // 039: id stream đang chạy (để hiện nút Dừng); ref để listener token lọc đúng lượt.
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const activeStreamRef = useRef<string | null>(null);

  // Đăng ký nhận token (039) một lần — nối delta vào bong bóng assistant đang stream (khớp streamId).
  useEffect(() => {
    const off = window.api.onRagStreamToken((e) => {
      if (e.streamId !== activeStreamRef.current) return;
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (!last.streaming) return prev;
        return [
          ...prev.slice(0, -1),
          { ...last, content: last.content + e.delta },
        ];
      });
    });
    return off;
  }, []);

  // Đổi notebook → huỷ stream đang chạy (039) + nạp lịch sử đã lưu (027) thay vì reset rỗng.
  useEffect(() => {
    let cancelled = false;
    if (activeStreamRef.current) {
      void window.api.ragStop(activeStreamRef.current).catch(() => {});
      activeStreamRef.current = null;
      setStreamingId(null);
    }
    setError(null);
    setMessages([]);
    window.api
      .chatHistory(notebookId)
      .then((list) => {
        if (cancelled) return;
        setMessages(
          list.map((m) => ({
            role: m.role,
            content: m.content,
            citations: m.citations,
            notFound: m.notFound,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [notebookId]);

  const clearHistory = useCallback(() => {
    window.api
      .chatClear(notebookId)
      .then(() => setMessages([]))
      .catch(() => setError("Không xoá được hội thoại."));
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
      // Defense-in-depth (FR-007): huỷ stream cũ nếu còn (ngoài việc UI đã khoá nút khi loading).
      if (activeStreamRef.current) {
        void window.api.ragStop(activeStreamRef.current).catch(() => {});
      }
      setError(null);
      const history: RagTurn[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const streamId = crypto.randomUUID();
      activeStreamRef.current = streamId;
      setStreamingId(streamId);
      // Thêm câu hỏi + bong bóng assistant rỗng (streaming) để nối token.
      setMessages((prev) => [
        ...prev,
        { role: "user", content: q },
        { role: "assistant", content: "", streaming: true },
      ]);
      setLoading(true);
      try {
        const res = await window.api.ragAskStream({
          notebookId,
          question: q,
          mode,
          history,
          streamId,
        });
        // Lượt đã bị huỷ/đổi notebook giữa chừng → không ghi đè (streamId không còn active).
        if (activeStreamRef.current !== streamId) return;
        // Thay bong bóng streaming bằng kết quả cuối (markdown + chip hậu kiểm).
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (!last.streaming) return prev;
          return [
            ...prev.slice(0, -1),
            {
              role: "assistant",
              content: res.answer,
              citations: res.citations,
              notFound: res.notFound,
            },
          ];
        });
      } catch (e) {
        if (activeStreamRef.current === streamId) {
          setError(e instanceof Error ? e.message : "Không hỏi được.");
          // Lỗi mạng giữa stream (khác Dừng): GIỮ phần đã nhận (token đã tới bong bóng) — chỉ chốt lại
          // (streaming:false) để người dùng không mất phần đã đọc; bong bóng rỗng thì gỡ. (spec Edge Case)
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            if (!last.streaming) return prev;
            return last.content === ""
              ? prev.slice(0, -1)
              : [
                  ...prev.slice(0, -1),
                  { role: "assistant", content: last.content },
                ];
          });
        }
      } finally {
        if (activeStreamRef.current === streamId) {
          activeStreamRef.current = null;
          setStreamingId(null);
        }
        setLoading(false);
      }
    },
    [canSend, messages, mode, notebookId],
  );

  // Dừng stream đang chạy (039) — main abort → ragAskStream resolve với phần đã nhận → finalize bình thường.
  const stop = useCallback(() => {
    const id = activeStreamRef.current;
    if (id) void window.api.ragStop(id).catch(() => {});
  }, []);

  return {
    messages,
    mode,
    setMode,
    loading,
    error,
    runtimeReady,
    hasReadySources,
    canSend,
    streamingId,
    send,
    stop,
    clearHistory,
  };
}
