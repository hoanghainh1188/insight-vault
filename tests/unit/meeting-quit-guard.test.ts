import { describe, it, expect, vi } from "vitest";
import { createQuitGuard } from "../../src/main/services/meeting-capture/quit-guard";

// 186 PR C1 (T115, FR-038) — thoát khi đang ghi ⇒ hỏi; đồng ý ⇒ kết thúc phiên rồi mới thoát; huỷ ⇒ ghi tiếp.

const flush = async (): Promise<void> => {
  await new Promise((r) => setTimeout(r, 0));
};

function setup(answer: boolean, recording = true) {
  let rec = recording;
  const deps = {
    isRecording: () => rec,
    ask: vi.fn(async () => answer),
    stopForQuit: vi.fn(async () => {
      rec = false;
    }),
    log: vi.fn(),
  };
  return { guard: createQuitGuard(deps), deps };
}

describe("createQuitGuard", () => {
  it("không ghi ⇒ không chặn, không hỏi", () => {
    const t = setup(true, false);
    const e = { preventDefault: vi.fn() };
    t.guard.intercept(e, vi.fn());
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(t.deps.ask).not.toHaveBeenCalled();
  });

  it("đang ghi + đồng ý ⇒ chặn, kết thúc phiên RỒI mới thoát", async () => {
    const t = setup(true);
    const e = { preventDefault: vi.fn() };
    const proceed = vi.fn(() => {
      expect(t.deps.stopForQuit).toHaveBeenCalled();
    });
    t.guard.intercept(e, proceed);
    expect(e.preventDefault).toHaveBeenCalled();
    await flush();
    expect(proceed).toHaveBeenCalledTimes(1);
  });

  it("đang ghi + huỷ ⇒ chặn, không kết thúc, không thoát", async () => {
    const t = setup(false);
    const proceed = vi.fn();
    t.guard.intercept({ preventDefault: vi.fn() }, proceed);
    await flush();
    expect(t.deps.stopForQuit).not.toHaveBeenCalled();
    expect(proceed).not.toHaveBeenCalled();
  });

  it("bấm thoát lặp khi hộp đang mở ⇒ chỉ một hộp thoại", async () => {
    const t = setup(true);
    t.guard.intercept({ preventDefault: vi.fn() }, vi.fn());
    t.guard.intercept({ preventDefault: vi.fn() }, vi.fn());
    await flush();
    expect(t.deps.ask).toHaveBeenCalledTimes(1);
  });
});
