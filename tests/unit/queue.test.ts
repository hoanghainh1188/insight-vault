import { describe, it, expect } from "vitest";
import { createSerialQueue } from "../../src/main/services/ingestion/queue";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("SerialQueue", () => {
  it("chạy TUẦN TỰ theo FIFO (không chồng lấn)", async () => {
    const q = createSerialQueue();
    const order: string[] = [];
    let active = 0;
    let maxActive = 0;
    const mk = (id: string) => async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await tick();
      order.push(id);
      active--;
    };
    q.enqueue("a", mk("a"));
    q.enqueue("b", mk("b"));
    q.enqueue("c", mk("c"));
    await q.whenIdle();
    expect(order).toEqual(["a", "b", "c"]);
    expect(maxActive).toBe(1); // không bao giờ 2 nguồn cùng lúc
  });

  it("huỷ nguồn đang chờ → không chạy", async () => {
    const q = createSerialQueue();
    const ran: string[] = [];
    q.enqueue("a", async () => {
      await tick();
      ran.push("a");
    });
    q.enqueue("b", async () => {
      ran.push("b");
    });
    q.cancel("b");
    await q.whenIdle();
    expect(ran).toEqual(["a"]);
  });

  it("một task ném KHÔNG chặn task kế", async () => {
    const q = createSerialQueue();
    const ran: string[] = [];
    q.enqueue("a", async () => {
      throw new Error("boom");
    });
    q.enqueue("b", async () => {
      ran.push("b");
    });
    await q.whenIdle();
    expect(ran).toEqual(["b"]);
  });

  it("báo cancelled cho task đang chạy", async () => {
    const q = createSerialQueue();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let sawCancel = false;
    q.enqueue("a", async (signal) => {
      await gate; // dừng cho tới khi test release
      sawCancel = signal.cancelled;
    });
    await tick(); // để 'a' bắt đầu và dừng ở gate
    q.cancel("a"); // set cancelled trong lúc đang chạy
    release(); // cho 'a' tiếp tục
    await q.whenIdle();
    expect(sawCancel).toBe(true);
  });
});
