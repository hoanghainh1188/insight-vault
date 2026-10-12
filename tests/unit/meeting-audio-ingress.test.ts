import { describe, it, expect } from "vitest";
import {
  validateAudioBatch,
  type IngressState,
} from "../../src/main/services/meeting-capture/audio-ingress";

// 186 — kiểm lô PCM renderer→main (R4). Hàm thuần: không ném, không log nội dung.

const SID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const base: IngressState = {
  sessionId: SID,
  ownerId: 7,
  phase: "recording",
  expectedSeq: 0,
  windowStartMs: 0,
  batchesInWindow: 0,
};
const pcm = (bytes = 32000): ArrayBuffer => new ArrayBuffer(bytes);
const msg = (
  over: Partial<{
    senderId: number;
    sessionId: unknown;
    seq: unknown;
    pcm: unknown;
  }> = {},
) => ({
  senderId: 7,
  sessionId: SID,
  seq: 0,
  pcm: pcm(),
  ...over,
});

describe("validateAudioBatch — chấp nhận", () => {
  it("lô hợp lệ ⇒ accept, tăng expectedSeq, trả bytes", () => {
    const r = validateAudioBatch(base, msg(), 100);
    expect(r.verdict).toBe("accept");
    if (r.verdict !== "accept") return;
    expect(r.bytes.byteLength).toBe(32000);
    expect(r.gapBatches).toBe(0);
    expect(r.next.expectedSeq).toBe(1);
  });

  it("nhận cả Uint8Array (Buffer từ IPC)", () => {
    const r = validateAudioBatch(base, msg({ pcm: new Uint8Array(3200) }), 100);
    expect(r.verdict).toBe("accept");
  });

  it("seq nhảy ⇒ accept + gapBatches (ghi nhận khoảng mất)", () => {
    const r = validateAudioBatch(
      { ...base, expectedSeq: 5 },
      msg({ seq: 8 }),
      100,
    );
    expect(r.verdict).toBe("accept");
    if (r.verdict !== "accept") return;
    expect(r.gapBatches).toBe(3);
    expect(r.next.expectedSeq).toBe(9);
  });

  it("không mutate state đầu vào", () => {
    const s = Object.freeze({ ...base });
    validateAudioBatch(s, msg(), 100);
    expect(s.expectedSeq).toBe(0);
  });
});

describe("validateAudioBatch — từ chối", () => {
  it("không có phiên ⇒ reject session", () => {
    expect(validateAudioBatch(null, msg(), 0)).toEqual({
      verdict: "reject",
      reason: "session",
    });
  });

  it("sai sessionId / không phải chuỗi ⇒ reject session", () => {
    expect(validateAudioBatch(base, msg({ sessionId: "khac" }), 0)).toEqual({
      verdict: "reject",
      reason: "session",
    });
    expect(validateAudioBatch(base, msg({ sessionId: 1 }), 0)).toEqual({
      verdict: "reject",
      reason: "session",
    });
  });

  it("sai sender ⇒ reject sender", () => {
    expect(validateAudioBatch(base, msg({ senderId: 8 }), 0)).toEqual({
      verdict: "reject",
      reason: "sender",
    });
  });

  it("phase không phải recording ⇒ reject phase", () => {
    expect(validateAudioBatch({ ...base, phase: "paused" }, msg(), 0)).toEqual({
      verdict: "reject",
      reason: "phase",
    });
  });

  it.each([
    ["rỗng", pcm(0)],
    ["lẻ byte", pcm(3201)],
    ["quá 64 KB", pcm(65538)],
    ["không phải buffer", "abc"],
    ["null", null],
  ])("payload %s ⇒ reject payload", (_n, p) => {
    expect(validateAudioBatch(base, msg({ pcm: p }), 0)).toEqual({
      verdict: "reject",
      reason: "payload",
    });
  });

  it.each([[-1], [1.5], ["0"], [Number.NaN]])(
    "seq %j ⇒ reject payload",
    (seq) => {
      expect(validateAudioBatch(base, msg({ seq }), 0)).toEqual({
        verdict: "reject",
        reason: "payload",
      });
    },
  );

  it("seq cũ hơn kỳ vọng ⇒ duplicate", () => {
    expect(
      validateAudioBatch({ ...base, expectedSeq: 4 }, msg({ seq: 3 }), 0),
    ).toEqual({
      verdict: "duplicate",
    });
  });
});

describe("validateAudioBatch — giới hạn tần suất (≤ 4 lô/giây)", () => {
  it("lô thứ 5 trong cùng cửa sổ 1 s ⇒ rateLimited; sang cửa sổ mới lại nhận", () => {
    let s: IngressState = base;
    for (let i = 0; i < 4; i++) {
      const r = validateAudioBatch(s, msg({ seq: i }), 100 + i);
      expect(r.verdict).toBe("accept");
      if (r.verdict === "accept") s = r.next;
    }
    const limited = validateAudioBatch(s, msg({ seq: 4 }), 200);
    expect(limited.verdict).toBe("rateLimited");
    const later = validateAudioBatch(s, msg({ seq: 4 }), 1200);
    expect(later.verdict).toBe("accept");
  });
});

describe("validateAudioBatch — chặn seq nhảy vọt (review M3)", () => {
  it("seq vượt kỳ vọng quá 3600 lô ⇒ reject payload", () => {
    expect(validateAudioBatch(base, msg({ seq: 3601 }), 0)).toEqual({
      verdict: "reject",
      reason: "payload",
    });
    expect(validateAudioBatch(base, msg({ seq: 3600 }), 0).verdict).toBe(
      "accept",
    );
  });
});
