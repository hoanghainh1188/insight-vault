// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ModelSelect } from "../../src/renderer/features/ai-runtime/ModelSelect";

// 152: tên model rất dài (vd "llamacpp:<hash 64 ký tự>") không được đẩy dòng rộng hơn thẻ — tên cắt bằng "…" (tooltip = tên đầy đủ),
// dung lượng giữ nguyên bên phải trong dòng.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const LONG =
  "llamacpp:9ba9cc2b4e02463b933096090530aef679d534dd91ecc9afadfb2dbfdc59f3c5";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Khối khai báo của đúng selector `sel` trong CSS (khoảng trắng chuẩn hoá). */
function ruleBody(css: string, sel: string): string {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(^|\\n)${esc}\\s*\\{([^}]*)\\}`).exec(css);
  return (m?.[2] ?? "").replace(/\s+/g, " ");
}

describe("ModelSelect — tên model dài (152)", () => {
  it("tên hiển thị kèm tooltip là tên đầy đủ; nút vẫn có tên truy cập đầy đủ", () => {
    act(() =>
      root.render(
        createElement(ModelSelect, {
          kind: "chat",
          label: "Answer model",
          models: [{ name: LONG, sizeBytes: 13.8e9, kind: "chat" }],
          selected: null,
          onSelect: vi.fn(),
        }),
      ),
    );
    const nm = container.querySelector(".model-row .nm");
    expect(nm?.getAttribute("title")).toBe(LONG);
    expect(container.querySelector(".model-row")?.textContent).toContain(LONG);
  });

  it("CSS: tên co lại và cắt bằng dấu …, dung lượng không co / không xuống dòng", () => {
    const css = readFileSync(
      join(process.cwd(), "src/renderer/app/app.css"),
      "utf8",
    );
    const row = ruleBody(css, ".model-row");
    const nm = ruleBody(css, ".model-row .nm");
    const sz = ruleBody(css, ".model-row .sz");
    expect(row).toMatch(/min-width: 0/);
    expect(nm).toMatch(/min-width: 0/);
    expect(nm).toMatch(/overflow: hidden/);
    expect(nm).toMatch(/text-overflow: ellipsis/);
    expect(nm).toMatch(/white-space: nowrap/);
    expect(sz).toMatch(/flex: 0 0 auto/);
    expect(sz).toMatch(/white-space: nowrap/);
  });
});
