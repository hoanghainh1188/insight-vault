import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { launchFresh, dismissOnboarding } from "./helper";
import { makePdf } from "../fixtures/pdf/make-pdf";
import { borderlessTable } from "../fixtures/pdf/samples";

// 147 (e, T006): bảng của PDF hiện dạng lưới trong Trình xem nguồn; chip [n] ⇒ <mark> trong đúng ô + nhãn [n]; công tắc Dạng văn bản;
// cột trình xem hẹp (900 px) vi / en không tràn. "Ollama" giả trả câu trả lời stream có [1].

async function fakeOllama(): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    if (req.url === "/api/chat") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const stream = (JSON.parse(body) as { stream?: boolean }).stream;
        const content = "Banana costs 0.50 [1].";
        if (stream) {
          res.setHeader("content-type", "application/x-ndjson");
          res.write(
            `${JSON.stringify({ message: { content }, done: false })}\n`,
          );
          res.end(`${JSON.stringify({ done: true })}\n`);
        } else {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ message: { content } }));
        }
      });
      return;
    }
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/show") {
      res.statusCode = 404;
      res.end("{}");
      return;
    }
    res.end(JSON.stringify({ models: [{ name: "fake:1b", size: 1 }] }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}` };
}

async function openWithTablePdf(win: Page): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "iv-147-"));
  const file = join(dir, "bang-gia.pdf");
  await writeFile(file, makePdf(borderlessTable().pages));
  const nbId = await win.evaluate(async (f) => {
    await window.api.aiSetSelectedModels({
      chatModel: "fake:1b",
      embeddingModel: null,
    });
    const nb = await window.api.notebookCreate({
      name: "Bảng",
      color: "#1E6B57",
    });
    await window.api.sourceAdd({ notebookId: nb.id, kind: "pdf", filePath: f });
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
}

for (const lang of ["vi", "en"] as const) {
  test(`147 — lưới bảng + tô sáng theo ô + công tắc (${lang})`, async ({}, testInfo) => {
    const { server, url } = await fakeOllama();
    const app = await launchFresh({ OLLAMA_HOST: url, IV_UI_LANG: lang });
    try {
      const win = await app.firstWindow();
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]!.setSize(900, 760),
      );
      await dismissOnboarding(win);
      await openWithTablePdf(win);

      await win.getByTestId("chat-input").fill("Banana price?");
      await win.getByTestId("chat-send").click();
      const chip = win.getByTestId("cite-1");
      await expect(chip).toBeVisible({ timeout: 20_000 });
      await chip.click();

      const viewer = win.getByTestId("source-viewer");
      await expect(viewer).toBeVisible();
      const table = viewer.locator("table");
      await expect(table).toBeVisible();
      await expect(table).toHaveAttribute(
        "aria-label",
        lang === "vi" ? "Bảng 1 — trang 1" : "Table 1 — page 1",
      );
      await expect(table.locator("thead th")).toHaveText([
        "Item",
        "Qty",
        "Price",
      ]);
      await expect(table.locator("mark").first()).toBeVisible();
      await expect(viewer.getByTestId("viewer-hltag")).toBeVisible();
      const overflow = await viewer.evaluate(
        (el) => el.scrollWidth - el.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      await viewer.screenshot({
        path: testInfo.outputPath(`viewer-grid-${lang}.png`),
      });

      // công tắc ⇒ dạng văn bản như cũ, vẫn có vùng tô
      await viewer.getByTestId("viewer-view-text").click();
      await expect(table).toHaveCount(0);
      await expect(viewer).toContainText("| Item | Qty | Price |");
      await expect(viewer.locator("mark").first()).toBeVisible();
    } finally {
      await app.close();
      server.close();
    }
  });
}
