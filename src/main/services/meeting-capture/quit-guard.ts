// 186 PR C1 (T115, FR-038) — thoát app / đóng cửa sổ chính khi đang ghi ⇒ hỏi xác nhận (hộp thoại ở main). Đồng ý ⇒ kết thúc
// phiên như người dùng bấm "Kết thúc ghi" (endedByUser ⇒ khởi động lại tự hoàn tất) rồi mới thoát/đóng; Huỷ ⇒ ghi tiếp.
// Tiêm phụ thuộc ⇒ test không cần Electron. Một hộp thoại tại một thời điểm (bấm thoát lặp không mở nhiều hộp).

export interface QuitGuardDeps {
  isRecording(): boolean;
  /** true = người dùng đồng ý kết thúc ghi và thoát. */
  ask(): Promise<boolean>;
  stopForQuit(): Promise<void>;
  log(event: string, meta?: Record<string, string | number | boolean>): void;
}

export interface QuitGuard {
  /**
   * Gọi trong `before-quit` / `close`. Không ghi ⇒ để sự kiện đi tiếp. Đang ghi ⇒ chặn, hỏi; đồng ý ⇒ kết thúc phiên rồi gọi
   * `proceed` (app.quit / win.close — lần này đi qua vì không còn phiên).
   */
  intercept(event: { preventDefault(): void }, proceed: () => void): void;
}

export function createQuitGuard(d: QuitGuardDeps): QuitGuard {
  let asking: Promise<boolean> | null = null;
  return {
    intercept(event, proceed) {
      if (!d.isRecording()) return;
      event.preventDefault();
      asking ??= d
        .ask()
        .then(async (ok) => {
          d.log("meeting.quitPrompt", { confirmed: ok });
          if (ok) await d.stopForQuit();
          return ok;
        })
        .catch(() => false)
        .finally(() => {
          asking = null;
        });
      void asking.then((ok) => {
        if (ok) proceed();
      });
    },
  };
}
