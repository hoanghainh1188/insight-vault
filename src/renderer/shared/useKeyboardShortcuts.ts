import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { matchShortcut } from "./shortcuts";

// Hook phím tắt toàn cục (043) — gắn 1 listener keydown ở lớp App. Cmd/Ctrl+N/K điều hướng về Notebooks +
// truyền ý định qua navigation state (NotebooksGrid xử lý khi mount/đã mount). "?" mở bảng trợ giúp.
export function useKeyboardShortcuts(): {
  helpOpen: boolean;
  closeHelp: () => void;
} {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      const inField =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      const action = matchShortcut({
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        inField,
      });
      if (!action) return;
      e.preventDefault();
      if (action === "help") {
        setHelpOpen((v) => !v);
      } else if (action === "new-notebook") {
        navigate("/notebooks", {
          state: { shortcut: "create", nonce: Date.now() },
        });
      } else {
        navigate("/notebooks", {
          state: { shortcut: "focus", nonce: Date.now() },
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const closeHelp = useCallback(() => setHelpOpen(false), []);
  return { helpOpen, closeHelp };
}
