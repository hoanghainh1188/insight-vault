import { describe, it, expect } from "vitest";
import {
  createSecretStore,
  type KeytarLike,
} from "../../src/main/services/ai-runtime/online/secret-store";

function fakeKeytar(): KeytarLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  const k = (s: string, a: string) => `${s}::${a}`;
  return {
    store,
    async getPassword(s, a) {
      return store.get(k(s, a)) ?? null;
    },
    async setPassword(s, a, p) {
      store.set(k(s, a), p);
    },
    async deletePassword(s, a) {
      return store.delete(k(s, a));
    },
  };
}

describe("secret-store (031)", () => {
  it("set/get/has/delete theo provider id", async () => {
    const ss = createSecretStore(fakeKeytar());
    expect(await ss.hasKey("openai")).toBe(false);
    await ss.setKey("openai", "sk-123");
    expect(await ss.getKey("openai")).toBe("sk-123");
    expect(await ss.hasKey("openai")).toBe(true);
    // provider khác độc lập
    expect(await ss.hasKey("anthropic")).toBe(false);
    await ss.deleteKey("openai");
    expect(await ss.getKey("openai")).toBeNull();
    expect(await ss.hasKey("openai")).toBe(false);
  });

  it("hasKey=false với chuỗi rỗng", async () => {
    const kt = fakeKeytar();
    const ss = createSecretStore(kt);
    await ss.setKey("gemini", "");
    expect(await ss.hasKey("gemini")).toBe(false);
  });

  it("keychain ném → getKey trả null (không ném xuyên IPC)", async () => {
    const broken: KeytarLike = {
      getPassword: async () => {
        throw new Error("keychain locked");
      },
      setPassword: async () => {},
      deletePassword: async () => true,
    };
    const ss = createSecretStore(broken);
    expect(await ss.getKey("openai")).toBeNull();
    expect(await ss.hasKey("openai")).toBe(false);
  });
});
