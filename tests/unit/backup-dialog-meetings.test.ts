// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { BackupDialog } from "../../src/renderer/features/vault-backup/BackupDialog";
import { I18nProvider } from "../../src/renderer/shared/i18n/I18nProvider";

// 186 (C3, FR-016): hộp sao lưu hiện dung lượng ghi âm cuộc họp khi có (audio cuộc họp được đưa vào bản sao lưu).

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function mountWith(meetingsBytes: number | undefined): Promise<void> {
  (window as unknown as { api: unknown }).api = {
    getUiLanguage: () => Promise.resolve({ preference: "vi", effective: "vi" }),
    onUiLanguageChanged: () => () => undefined,
    onBackupProgress: () => () => undefined,
    getStorageInfo: () =>
      Promise.resolve({
        path: "/data",
        usedBytes: 1,
        freeBytes: 1,
        ...(meetingsBytes !== undefined ? { meetingsBytes } : {}),
      }),
  };
  act(() =>
    root.render(
      createElement(
        I18nProvider,
        null,
        createElement(BackupDialog, { onClose: () => undefined }),
      ),
    ),
  );
  return act(async () => {});
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("BackupDialog — dung lượng ghi âm cuộc họp", () => {
  it("có ghi âm ⇒ hiện dòng 'Gồm ghi âm cuộc họp' kèm dung lượng", async () => {
    await mountWith(150 * 1024 * 1024);
    const line = container.querySelector(
      '[data-testid="backup-meetings-size"]',
    );
    expect(line?.textContent).toMatch(/ghi âm cuộc họp/i);
    expect(line?.textContent).toMatch(/150/);
  });

  it("không có ghi âm ⇒ không hiện dòng", async () => {
    await mountWith(undefined);
    expect(
      container.querySelector('[data-testid="backup-meetings-size"]'),
    ).toBeNull();
  });
});
