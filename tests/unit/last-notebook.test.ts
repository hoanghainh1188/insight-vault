// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  getLastNotebookId,
  setLastNotebookId,
} from "../../src/renderer/shared/lastNotebook";

describe("lastNotebook (025)", () => {
  beforeEach(() => localStorage.clear());

  it("chưa lưu → null", () => {
    expect(getLastNotebookId()).toBeNull();
  });

  it("set rồi get đúng id", () => {
    setLastNotebookId("nb-42");
    expect(getLastNotebookId()).toBe("nb-42");
  });

  it("id rỗng → không lưu (giữ null)", () => {
    setLastNotebookId("");
    expect(getLastNotebookId()).toBeNull();
  });

  it("giá trị rỗng trong storage → null", () => {
    localStorage.setItem("last-notebook-id", "   ");
    expect(getLastNotebookId()).toBeNull();
  });
});
