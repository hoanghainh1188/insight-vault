import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { launchFresh, dismissOnboarding } from "./helper";

// 178 (T020): lịch sử phiên bản Studio end-to-end với "Ollama" giả HTTP — mỗi lượt trả nội dung khác nhau.
// 3 lần tạo ⇒ 3 phiên bản; chọn bản 1 + Copy đúng bản; xoá bản đang xem (xác nhận); Tạo lại + Huỷ ⇒ không thêm bản;
// cửa sổ 900 px không tràn.

interface Fake {
  server: Server;
  url: string;
  stats: { requests: number };
  setDelay: (fn: (n: number) => number) => void;
}

async function fakeOllama(): Promise<Fake> {
  const stats = { requests: 0 };
  let delayFor = (_n: number): number => 30;
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/chat") {
      stats.requests += 1;
      const n = stats.requests;
      req.on("data", () => undefined);
      req.on("end", () => {
        const timer = setTimeout(
          () =>
            res.end(
              JSON.stringify({
                message: { content: `Kết quả lần ${n} [1].` },
              }),
            ),
          delayFor(n),
        );
        res.on("close", () => clearTimeout(timer));
      });
      return;
    }
    if (req.url === "/api/show") {
      res.statusCode = 404;
      res.end("{}");
      return;
    }
    res.end(JSON.stringify({ models: [{ name: "fake:1b", size: 1 }] }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    server,
    url: `http://127.0.0.1:${port}`,
    stats,
    setDelay: (fn) => (delayFor = fn),
  };
}

async function smallDoc(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "iv-178-"));
  const file = join(dir, "ngan.txt");
  await writeFile(
    file,
    "Phở là món ăn truyền thống của Việt Nam. Nước dùng hầm xương nhiều giờ.",
  );
  return file;
}

async function openNotebook(win: Page, file: string): Promise<string> {
  const nbId = await win.evaluate(async (f) => {
    await window.api.aiSetSelectedModels({
      chatModel: "fake:1b",
      embeddingModel: null,
    });
    const nb = await window.api.notebookCreate({
      name: "Phiên bản",
      color: "#1E6B57",
    });
    await window.api.sourceAdd({ notebookId: nb.id, kind: "txt", filePath: f });
    return nb.id;
  }, file);
  await expect
    .poll(
      () =>
        win.evaluate(
          async (id) => (await window.api.sourceListByNotebook(id))[0]?.status,
          nbId,
        ),
      { timeout: 30_000 },
    )
    .toBe("ready");
  await win.evaluate((id) => {
    window.location.hash = `#/workspace/${id}`;
  }, nbId);
  return nbId;
}

async function countVersions(win: Page, nbId: string): Promise<number> {
  return win.evaluate(
    async (id) =>
      (await window.api.studioList(id)).filter((r) => r.kind === "summary")
        .length,
    nbId,
  );
}

test("178 — phiên bản: tạo 3 lần, chọn bản cũ + Copy, xoá có xác nhận, Tạo lại + Huỷ không thêm bản", async ({}, testInfo) => {
  test.setTimeout(90_000);
  const fake = await fakeOllama();
  const app = await launchFresh({ OLLAMA_HOST: fake.url });
  try {
    const win = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.setSize(900, 760),
    );
    await dismissOnboarding(win);
    const nbId = await openNotebook(win, await smallDoc());

    const btn = win.getByTestId("studio-btn-summary");
    await expect(btn).toBeEnabled({ timeout: 15_000 });
    await btn.click();
    const card = win.getByTestId("studio-card-summary");
    await expect(card).toContainText("Kết quả lần 1", { timeout: 15_000 });
    // 1 bản ⇒ chưa có select nhưng có nút xoá.
    await expect(win.getByTestId("studio-version-select-summary")).toHaveCount(
      0,
    );
    await expect(
      win.getByTestId("studio-version-delete-summary"),
    ).toBeVisible();

    const regen = win.getByTestId("studio-regen-summary");
    for (const n of [2, 3]) {
      await regen.click();
      await expect(card).toContainText(`Kết quả lần ${n}`, {
        timeout: 15_000,
      });
    }
    expect(await countVersions(win, nbId)).toBe(3);
    const select = win.getByTestId("studio-version-select-summary");
    await expect(select.locator("option")).toHaveCount(3);
    await expect(select.locator("option").first()).toContainText("Bản 3/3");

    // Chọn bản 1 ⇒ thẻ hiện bản 1; Copy chép đúng bản đang xem.
    const firstId = await select.locator("option").nth(2).getAttribute("value");
    await select.selectOption(firstId!);
    await expect(card).toContainText("Kết quả lần 1");
    await win.getByTestId("studio-copy-summary").click();
    await expect
      .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
      .toContain("Kết quả lần 1");

    const overflow = await win
      .getByTestId("studio-col")
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await win
      .getByTestId("studio-col")
      .screenshot({ path: testInfo.outputPath("studio-versions-vi.png") });

    // Xoá bản đang xem (bản 1): Huỷ xác nhận ⇒ không xoá; Xoá ⇒ còn 2, thẻ về bản mới nhất.
    await win.getByTestId("studio-version-delete-summary").click();
    await expect(
      win.getByTestId("studio-version-confirm-summary"),
    ).toBeVisible();
    await win.getByTestId("studio-version-confirm-cancel-summary").click();
    expect(await countVersions(win, nbId)).toBe(3);
    await win.getByTestId("studio-version-delete-summary").click();
    await win.getByTestId("studio-version-confirm-ok-summary").click();
    await expect.poll(() => countVersions(win, nbId)).toBe(2);
    await expect(card).toContainText("Kết quả lần 3");
    await expect(select.locator("option")).toHaveCount(2);

    // Tạo lại rồi Huỷ ⇒ không thêm phiên bản.
    fake.setDelay(() => 20_000);
    await regen.click();
    await win.getByTestId("studio-cancel-summary").click();
    await expect(win.getByTestId("studio-cancel-summary")).toHaveCount(0, {
      timeout: 3_000,
    });
    expect(await countVersions(win, nbId)).toBe(2);
    await expect(card).toContainText("Kết quả lần 3");
  } finally {
    await app.close();
    fake.server.close();
  }
});
