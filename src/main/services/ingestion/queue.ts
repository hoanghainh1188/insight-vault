// Hàng đợi xử lý TUẦN TỰ 1 nguồn/lần, FIFO (A4). Hàm thuần (không I/O) — unit-test tất định.
// Cho phép huỷ một nguồn đang chờ/đang chạy (US3): task tự kiểm isCancelled() ở các mốc.

interface QueueItem {
  id: string;
  task: (signal: { cancelled: boolean }) => Promise<void>;
}

export interface SerialQueue {
  /** Thêm nguồn vào cuối hàng đợi; bắt đầu chạy nếu đang rảnh. */
  enqueue(
    id: string,
    task: (signal: { cancelled: boolean }) => Promise<void>,
  ): void;
  /** Đang chờ hoặc đang chạy? */
  has(id: string): boolean;
  /** Đánh dấu huỷ: bỏ khỏi hàng đợi nếu chưa chạy; báo signal.cancelled nếu đang chạy. */
  cancel(id: string): void;
  size(): number;
  /** Chờ tới khi hàng đợi rỗng (test/đồng bộ). */
  whenIdle(): Promise<void>;
}

export function createSerialQueue(): SerialQueue {
  const items: QueueItem[] = [];
  const cancelled = new Set<string>();
  let running = false;
  let current: { id: string; signal: { cancelled: boolean } } | null = null;
  let idleResolvers: (() => void)[] = [];

  const settleIdle = (): void => {
    idleResolvers.forEach((r) => r());
    idleResolvers = [];
  };

  const drain = async (): Promise<void> => {
    if (running) return;
    running = true;
    while (items.length > 0) {
      const item = items.shift()!;
      if (cancelled.has(item.id)) {
        cancelled.delete(item.id);
        continue;
      }
      const signal = { cancelled: false };
      current = { id: item.id, signal };
      try {
        await item.task(signal);
      } catch {
        // Lỗi từng nguồn KHÔNG chặn hàng đợi (FR-013). Pipeline đã tự set trạng thái error.
      }
      current = null;
      cancelled.delete(item.id);
    }
    running = false;
    settleIdle();
  };

  return {
    enqueue(id, task) {
      items.push({ id, task });
      void drain();
    },
    has(id) {
      return current?.id === id || items.some((i) => i.id === id);
    },
    cancel(id) {
      cancelled.add(id);
      if (current?.id === id) current.signal.cancelled = true;
    },
    size() {
      return items.length + (current ? 1 : 0);
    },
    whenIdle() {
      if (!running && items.length === 0) return Promise.resolve();
      return new Promise((resolve) => idleResolvers.push(resolve));
    },
  };
}
