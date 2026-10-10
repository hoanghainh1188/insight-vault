// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { readFileSync } from "node:fs";
import { createTranslator } from "@shared/i18n";
import type { StudioGenerateInput } from "@shared/ipc/types";
import { UiLanguageContext } from "../../src/renderer/shared/i18n/i18n-context";
import { StudioColumn } from "../../src/renderer/features/studio/StudioColumn";

// 178 (T032, FR-014): khu nút 8 loại — lưới 2 cột (2×4), thứ tự 4 loại cũ rồi 4 loại mới, tên đọc đúng loại, thứ tự Tab = thứ
// tự hiển thị (không tabindex dương), "Đang tạo…" từng nút; CSS cho nhãn dài xuống dòng, không tràn cột 262 px.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const ORDER = [
  "summary",
  "keyPoints",
  "faq",
  "outline",
  "studyGuide",
  "briefing",
  "timeline",
  "keyTerms",
];

let container: HTMLDivElement;
let root: Root;
let inputs: StudioGenerateInput[];

beforeEach(() => {
  inputs = [];
  (window as unknown as { api: unknown }).api = {
    aiGetRuntimeStatus: () => Promise.resolve({ ollamaReady: true }),
    sourceListByNotebook: () =>
      Promise.resolve([
        { id: "s1", notebookId: "nb1", status: "ready", title: "A" },
      ]),
    onSourceProgress: () => () => undefined,
    onStudioProgress: () => () => undefined,
    studioList: () => Promise.resolve([]),
    studioCancel: () => Promise.resolve({ cancelled: true }),
    studioGenerate: (i: StudioGenerateInput) =>
      new Promise(() => {
        inputs.push(i);
      }),
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const buttons = (): HTMLButtonElement[] =>
  [
    ...container.querySelectorAll<HTMLButtonElement>(
      ".studio-actions .studio-btn",
    ),
  ].filter((b) => b.dataset.testid?.startsWith("studio-btn-"));

async function mount(el: ReactElement): Promise<void> {
  await act(async () => root.render(el));
  await act(async () => {});
}

function inEnglish(el: ReactElement): ReactElement {
  return createElement(
    UiLanguageContext.Provider,
    {
      value: {
        preference: "en",
        effective: "en",
        translator: createTranslator("en"),
        setPreference: async () => undefined,
      },
    },
    el,
  );
}

describe("StudioColumn — 8 loại (178)", () => {
  it("8 nút theo thứ tự, nhãn tiếng Việt, không tabindex dương", async () => {
    await mount(createElement(StudioColumn, { notebookId: "nb1" }));
    const bs = buttons();
    expect(bs.map((b) => b.dataset.testid)).toEqual(
      ORDER.map((k) => `studio-btn-${k}`),
    );
    expect(bs.slice(4).map((b) => b.textContent)).toEqual([
      "Hướng dẫn học",
      "Bản tóm lược",
      "Dòng thời gian",
      "Bảng thuật ngữ",
    ]);
    for (const b of bs) {
      expect(Number(b.getAttribute("tabindex") ?? "0")).toBeLessThanOrEqual(0);
      expect(b.disabled).toBe(false);
    }
  });

  it("English: nhãn loại mới dịch", async () => {
    await mount(inEnglish(createElement(StudioColumn, { notebookId: "nb1" })));
    expect(
      buttons()
        .slice(4)
        .map((b) => b.textContent),
    ).toEqual(["Study guide", "Briefing", "Timeline", "Glossary"]);
  });

  it("bấm một loại mới ⇒ gửi đúng kind; chỉ nút đó 'Đang tạo…'", async () => {
    await mount(createElement(StudioColumn, { notebookId: "nb1" }));
    await act(async () =>
      (
        container.querySelector(
          "[data-testid=studio-btn-timeline]",
        ) as HTMLButtonElement
      ).click(),
    );
    expect(inputs[0].kind).toBe("timeline");
    const bs = buttons();
    expect(
      bs.find((b) => b.dataset.testid === "studio-btn-timeline")?.textContent,
    ).toBe("Đang tạo…");
    expect(
      bs
        .filter((b) => b.textContent === "Đang tạo…")
        .map((b) => b.dataset.testid),
    ).toEqual(["studio-btn-timeline"]);
  });

  it("CSS: lưới 2 cột; nhãn dài xuống dòng (min-width 0, overflow-wrap), không cắt chữ", () => {
    const css = readFileSync("src/renderer/features/studio/studio.css", "utf8");
    const grid = /\.studio-actions\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(grid).toMatch(
      /grid-template-columns:\s*(1fr 1fr|repeat\(2,\s*minmax\(0,\s*1fr\)\))/,
    );
    const btn = /\.studio-btn\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(btn).toMatch(/min-width:\s*0/);
    expect(btn).toMatch(/overflow-wrap:\s*anywhere/);
    expect(btn).not.toMatch(/text-overflow:\s*ellipsis/);
    expect(btn).not.toMatch(/white-space:\s*nowrap/);
  });
});
