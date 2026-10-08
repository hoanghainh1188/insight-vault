import { useCallback, useEffect, useRef, useState } from "react";
import type { AiTarget, Citation, RagMode, RagTurn } from "@shared/ipc/types";
import { parseIpcError } from "@shared/online-error-tag";
import { announce } from "../../shared/a11y/announcer";
import {
  chatCancelledMessage,
  chatStartedMessage,
  chatDoneMessage,
} from "../../shared/a11y/messages";

// Hook cột Chat: nạp lịch sử hội thoại đã lưu theo notebook (027-chat-history) + gọi ragAskStream (streaming,
// 039; main tự persist câu trả lời cuối) + kiểm runtime/nguồn ready. Multi-turn: gửi lịch sử hiện có.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  notFound?: boolean;
  /** 071: chế độ đã dùng — "open" → badge "không dựa trên nguồn". */
  modeUsed?: RagMode;
  streaming?: boolean; // 039: đang nhận token (render text thô, chưa chip)
  /** 098: trả lời bằng AI cục bộ sau lỗi online (người dùng bấm) — nhãn minh bạch, chỉ trong phiên. */
  answeredLocally?: boolean;
}

/** 098: lượt lỗi do provider online, chờ người dùng chọn "AI cục bộ" hoặc "Thử lại". */
export interface FailedTurn {
  question: string;
}

export function useChat(notebookId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<RagMode>("grounded");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedTurn, setFailedTurn] = useState<FailedTurn | null>(null);
  const [runtimeReady, setRuntimeReady] = useState<boolean | null>(null);
  const [hasReadySources, setHasReadySources] = useState(false);
  // 039: id stream đang chạy (để hiện nút Dừng); ref để listener token lọc đúng lượt.
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const activeStreamRef = useRef<string | null>(null);
  // 091: người dùng bấm Dừng ⇒ câu báo kết thúc là "Đã dừng" thay vì "Đã có câu trả lời".
  const stopRequestedRef = useRef(false);

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
      // 091: lượt bị huỷ không còn câu báo kết thúc ⇒ báo huỷ để "Đang soạn…" không treo lơ lửng.
      announce(chatCancelledMessage());
    }
    setError(null);
    setFailedTurn(null);
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
            modeUsed: m.modeUsed,
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
    // 098: xoá hội thoại thì bỏ luôn lượt lỗi đang chờ chọn (không còn câu hỏi để hỏi lại).
    setFailedTurn(null);
    setError(null);
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
    async (
      question: string,
      opts: { target?: AiTarget; retry?: boolean } = {},
    ) => {
      const q = question.trim();
      if (!q || !canSend) return;
      // Defense-in-depth (FR-007): huỷ stream cũ nếu còn (ngoài việc UI đã khoá nút khi loading).
      if (activeStreamRef.current) {
        void window.api.ragStop(activeStreamRef.current).catch(() => {});
      }
      setError(null);
      setFailedTurn(null);
      // 098: hỏi lại lượt lỗi ⇒ câu hỏi (và phần trả lời dở nếu lỗi giữa stream) đã nằm cuối thread — cắt bỏ từ câu
      // hỏi đó trở đi để không nhân đôi và không gửi chúng vào lịch sử.
      const retryAt = opts.retry
        ? messages
            .map((m) => m.role === "user" && m.content === q)
            .lastIndexOf(true)
        : -1;
      const base = retryAt >= 0 ? messages.slice(0, retryAt) : messages;
      const local = opts.target === "local";
      const history: RagTurn[] = base.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const streamId = crypto.randomUUID();
      activeStreamRef.current = streamId;
      setStreamingId(streamId);
      // Thêm câu hỏi + bong bóng assistant rỗng (streaming) để nối token.
      setMessages(() => [
        ...base,
        { role: "user", content: q },
        { role: "assistant", content: "", streaming: true },
      ]);
      setLoading(true);
      stopRequestedRef.current = false;
      announce(chatStartedMessage());
      try {
        const res = await window.api.ragAskStream({
          notebookId,
          question: q,
          mode,
          history,
          streamId,
          ...(local ? { target: "local" as const } : {}),
        });
        // Lượt đã bị huỷ/đổi notebook giữa chừng → không ghi đè (streamId không còn active).
        if (activeStreamRef.current !== streamId) return;
        announce(
          chatDoneMessage({
            citationCount: res.citations.length,
            notFound: res.notFound,
            stopped: stopRequestedRef.current,
          }),
        );
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
              modeUsed: res.modeUsed,
              ...(local ? { answeredLocally: true } : {}),
            },
          ];
        });
      } catch (e) {
        if (activeStreamRef.current === streamId) {
          // 098: tách thẻ lỗi online (main gắn) — lỗi provider online ⇒ giữ lượt để người dùng chọn AI cục bộ.
          const parsed = parseIpcError(
            e instanceof Error ? e.message : "Không hỏi được.",
          );
          setError(parsed.message);
          if (parsed.onlineKind && !local) setFailedTurn({ question: q });
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

  /** 098: chạy lại lượt lỗi online — "local" (Ollama) hoặc "active" (thử lại provider đang bật). */
  const retryFailed = useCallback(
    async (target: AiTarget) => {
      if (!failedTurn) return;
      // Không gửi được (Ollama ngừng chạy giữa phiên…) ⇒ báo rõ thay vì bấm mà không có gì xảy ra (ADR 098).
      if (!canSend) {
        setError(
          target === "local"
            ? "AI cục bộ (Ollama) chưa sẵn sàng. Mở Cài đặt để bật/chọn mô hình."
            : "Chưa gửi được — kiểm tra AI trong Cài đặt rồi thử lại.",
        );
        return;
      }
      await send(failedTurn.question, {
        target: target === "local" ? "local" : undefined,
        retry: true,
      });
    },
    [canSend, failedTurn, send],
  );

  // Dừng stream đang chạy (039) — main abort → ragAskStream resolve với phần đã nhận → finalize bình thường.
  const stop = useCallback(() => {
    const id = activeStreamRef.current;
    if (!id) return;
    stopRequestedRef.current = true;
    void window.api.ragStop(id).catch(() => {});
  }, []);

  return {
    messages,
    mode,
    setMode,
    loading,
    error,
    failedTurn,
    retryFailed,
    runtimeReady,
    hasReadySources,
    canSend,
    streamingId,
    send,
    stop,
    clearHistory,
  };
}
