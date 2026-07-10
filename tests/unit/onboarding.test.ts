import { describe, it, expect } from "vitest";
import {
  getOnboardingState,
  setOnboardingComplete,
  type StoreLike,
} from "../../src/main/services/app-shell/onboarding";

function fakeStore(
  initial: Record<string, unknown> = {},
): StoreLike & { data: Record<string, unknown> } {
  const data = { ...initial };
  return {
    data,
    get: (k) => data[k],
    set: (k, v) => {
      data[k] = v;
    },
  };
}

describe("onboarding", () => {
  it("cờ thiếu → completed:false (coi là lần đầu)", () => {
    expect(getOnboardingState(fakeStore()).completed).toBe(false);
  });

  it("cờ = true → completed:true", () => {
    expect(
      getOnboardingState(fakeStore({ onboardingComplete: true })).completed,
    ).toBe(true);
  });

  it("giá trị không phải boolean → completed:false", () => {
    expect(
      getOnboardingState(fakeStore({ onboardingComplete: "yes" })).completed,
    ).toBe(false);
  });

  it("store.get ném → completed:false, không vỡ", () => {
    const bad: StoreLike = {
      get: () => {
        throw new Error("corrupt");
      },
      set: () => {},
    };
    expect(getOnboardingState(bad).completed).toBe(false);
  });

  it("setOnboardingComplete ghi cờ true (idempotent)", () => {
    const s = fakeStore();
    expect(setOnboardingComplete(s)).toEqual({ completed: true });
    expect(s.data.onboardingComplete).toBe(true);
    expect(getOnboardingState(s).completed).toBe(true);
  });

  it("store.set ném → không ném xuyên IPC, vẫn trả completed:true", () => {
    const bad: StoreLike = {
      get: () => undefined,
      set: () => {
        throw new Error("ENOSPC");
      },
    };
    expect(() => setOnboardingComplete(bad)).not.toThrow();
    expect(setOnboardingComplete(bad)).toEqual({ completed: true });
  });
});
