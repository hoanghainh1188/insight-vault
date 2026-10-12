import { describe, it, expect } from "vitest";
import {
  sessionTransition,
  sourceStatusForPhase,
  type SessionSnapshot,
} from "../../src/main/services/meeting-capture/session-state";

// 186 — máy trạng thái phiên ghi (data-model §5). Hàm thuần.

const at = (
  phase: SessionSnapshot["phase"],
  endedByUser = false,
): SessionSnapshot => ({
  phase,
  endedByUser,
});

describe("sessionTransition — luồng chính", () => {
  it("recording ⇄ paused (user, deviceLost)", () => {
    const p = sessionTransition(at("recording"), {
      type: "pause",
      reason: "user",
    });
    expect(p).toEqual({ ok: true, state: at("paused") });
    const d = sessionTransition(at("recording"), {
      type: "pause",
      reason: "deviceLost",
    });
    expect(d).toEqual({ ok: true, state: at("paused") });
    expect(sessionTransition(at("paused"), { type: "resume" })).toEqual({
      ok: true,
      state: at("recording"),
    });
  });

  it("stop từ recording/paused ⇒ stopping + endedByUser (mọi nguyên nhân người dùng/đĩa/thoát)", () => {
    for (const from of ["recording", "paused"] as const) {
      for (const cause of ["user", "diskFull", "quitConfirmed"] as const) {
        expect(sessionTransition(at(from), { type: "stop", cause })).toEqual({
          ok: true,
          state: at("stopping", true),
        });
      }
    }
  });

  it("stopping --segmentsClosed--> finalizing (giữ endedByUser)", () => {
    expect(
      sessionTransition(at("stopping", true), { type: "segmentsClosed" }),
    ).toEqual({
      ok: true,
      state: at("finalizing", true),
    });
  });

  it("finalizing --finalized(final|draft)--> done; --finalizeFailed--> incomplete", () => {
    expect(
      sessionTransition(at("finalizing", true), {
        type: "finalized",
        quality: "final",
      }),
    ).toEqual({ ok: true, state: at("done", true) });
    expect(
      sessionTransition(at("finalizing", true), {
        type: "finalized",
        quality: "draft",
      }),
    ).toEqual({ ok: true, state: at("done", true) });
    expect(
      sessionTransition(at("finalizing", true), { type: "finalizeFailed" }),
    ).toEqual({
      ok: true,
      state: at("incomplete", true),
    });
  });

  it("interrupt từ recording/paused ⇒ interrupted, endedByUser=false", () => {
    for (const cause of ["rendererGone", "noAudio", "crash"] as const) {
      expect(
        sessionTransition(at("recording"), { type: "interrupt", cause }),
      ).toEqual({
        ok: true,
        state: at("interrupted", false),
      });
      expect(
        sessionTransition(at("paused"), { type: "interrupt", cause }),
      ).toEqual({
        ok: true,
        state: at("interrupted", false),
      });
    }
  });

  it("recover từ interrupted", () => {
    expect(
      sessionTransition(at("interrupted"), {
        type: "recover",
        action: "finalize",
      }),
    ).toEqual({ ok: true, state: at("finalizing", false) });
    expect(
      sessionTransition(at("interrupted"), {
        type: "recover",
        action: "keepIncomplete",
      }),
    ).toEqual({ ok: true, state: at("incomplete", false) });
  });

  it("finalizeAgain từ incomplete hoặc done ⇒ finalizing", () => {
    expect(
      sessionTransition(at("incomplete", true), { type: "finalizeAgain" }),
    ).toEqual({
      ok: true,
      state: at("finalizing", true),
    });
    expect(
      sessionTransition(at("done", true), { type: "finalizeAgain" }),
    ).toEqual({
      ok: true,
      state: at("finalizing", true),
    });
  });
});

describe("sessionTransition — chuyển không hợp lệ", () => {
  it.each([
    [at("recording"), { type: "resume" } as const],
    [at("paused"), { type: "pause", reason: "user" } as const],
    [at("done", true), { type: "pause", reason: "user" } as const],
    [at("finalizing", true), { type: "stop", cause: "user" } as const],
    [at("recording"), { type: "segmentsClosed" } as const],
    [at("recording"), { type: "finalizeAgain" } as const],
    [at("done", true), { type: "interrupt", cause: "crash" } as const],
    [at("recording"), { type: "recover", action: "finalize" } as const],
  ])("%j + %j ⇒ invalidTransition", (state, event) => {
    expect(sessionTransition(state, event)).toEqual({
      ok: false,
      reason: "invalidTransition",
    });
  });

  it("không mutate snapshot đầu vào", () => {
    const s = Object.freeze(at("recording"));
    expect(() =>
      sessionTransition(s, { type: "pause", reason: "user" }),
    ).not.toThrow();
    expect(s.phase).toBe("recording");
  });
});

describe("sourceStatusForPhase", () => {
  it("done/incomplete ⇒ ready; còn lại ⇒ processing", () => {
    expect(sourceStatusForPhase("done")).toBe("ready");
    expect(sourceStatusForPhase("incomplete")).toBe("ready");
    for (const p of [
      "recording",
      "paused",
      "stopping",
      "finalizing",
      "interrupted",
    ] as const) {
      expect(sourceStatusForPhase(p)).toBe("processing");
    }
  });
});
