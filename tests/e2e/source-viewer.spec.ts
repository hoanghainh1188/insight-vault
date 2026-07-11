import { test, expect, type ElectronApplication } from "@playwright/test";
import { join } from "node:path";
import { launchFresh, dismissOnboarding, UNREACHABLE_OLLAMA } from "./helper";

// 019-source-viewer e2e (tất định, không cần Ollama). Kiểm data-path source:getContent + whitelist.
// Luồng UI chip→overlay highlight cần Ollama (nguồn ready) → phủ bởi unit (reconstruct/highlight) + manual.
let app: ElectronApplication;
const TXT = join(process.cwd(), "tests/fixtures/sample.txt");
const MD = join(process.cwd(), "tests/fixtures/sample.md");

test.beforeAll(async () => {
  app = await launchFresh(UNREACHABLE_OLLAMA);
});
test.afterAll(async () => await app?.close());

test("whitelist: window.api có sourceGetContent, không invoke chung", async () => {
  const win = await app.firstWindow();
  const keys = await win.evaluate(() =>
    Object.keys((window as unknown as { api: object }).api),
  );
  expect(keys).toContain("sourceGetContent");
  expect(keys).not.toContain("invoke");
});

test("getContent: tái dựng text từ chunk; 2 nguồn khác nhau → text khác (SC-004 data path)", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);

  const nbId = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "SV",
      color: "#1E6B57",
    });
    return nb.id;
  });
  // Nạp 2 nguồn; UNREACHABLE_OLLAMA → dừng ở awaiting_embedding NHƯNG chunk đã được ghi (parse+chunk trước embed).
  const ids = await win.evaluate(
    async ([id, a, b]) => {
      const s1 = await window.api.sourceAdd({
        notebookId: id,
        kind: "txt",
        filePath: a,
      });
      const s2 = await window.api.sourceAdd({
        notebookId: id,
        kind: "md",
        filePath: b,
      });
      return [s1.source.id, s2.source.id];
    },
    [nbId, TXT, MD] as const,
  );

  // Chờ chunk được ghi (status rời 'queued'/'processing').
  await expect
    .poll(
      async () =>
        win.evaluate(async (id) => {
          const list = await window.api.sourceListByNotebook(id);
          return list.every(
            (s) => s.status !== "queued" && s.status !== "processing",
          );
        }, nbId),
      { timeout: 20000 },
    )
    .toBe(true);

  const c1 = await win.evaluate(
    (id) => window.api.sourceGetContent(id),
    ids[0],
  );
  const c2 = await win.evaluate(
    (id) => window.api.sourceGetContent(id),
    ids[1],
  );
  expect(c1?.text.length).toBeGreaterThan(0);
  expect(c2?.text.length).toBeGreaterThan(0);
  expect(c1?.text).not.toBe(c2?.text); // 2 nguồn khác nội dung → viewer đổi được
  expect(c1?.kind).toBe("txt");
  expect(c2?.kind).toBe("md");
});

test("getContent cho sourceId không tồn tại → null (A7)", async () => {
  const win = await app.firstWindow();
  const res = await win.evaluate(() => window.api.sourceGetContent("khong-co"));
  expect(res).toBeNull();
});

test("UI: bấm tên nguồn ở cột Nguồn → overlay viewer mở + hiển thị text; đổi nguồn → text đổi (US3/SC-004)", async () => {
  const win = await app.firstWindow();
  const nbId = await win.evaluate(async () => {
    const nb = await window.api.notebookCreate({
      name: "SVUI",
      color: "#1E6B57",
    });
    return nb.id;
  });
  await win.evaluate(
    async ([id, a, b]) => {
      await window.api.sourceAdd({ notebookId: id, kind: "txt", filePath: a });
      await window.api.sourceAdd({ notebookId: id, kind: "md", filePath: b });
    },
    [nbId, TXT, MD] as const,
  );
  // Chờ nguồn có chunk (rời queued/processing) → tên nguồn bấm được.
  await expect
    .poll(
      async () =>
        win.evaluate(async (id) => {
          const l = await window.api.sourceListByNotebook(id);
          return (
            l.length === 2 &&
            l.every((s) => s.status !== "queued" && s.status !== "processing")
          );
        }, nbId),
      { timeout: 20000 },
    )
    .toBe(true);

  await win.evaluate((id) => {
    window.location.hash = `#/workspace/${id}`;
  }, nbId);
  await expect(win.getByTestId("workspace")).toBeVisible();

  // Bấm nguồn đầu tiên → overlay mở.
  const openButtons = win.getByTestId("source-open");
  await openButtons.first().click();
  await expect(win.getByTestId("source-viewer")).toBeVisible();
  // Chờ nội dung nạp xong (viewer-body có text thật, không phải rỗng lúc đang tải).
  await expect
    .poll(
      async () =>
        (await win.getByTestId("viewer-body").innerText()).trim().length,
      { timeout: 5000 },
    )
    .toBeGreaterThan(0);
  const firstText = await win.getByTestId("viewer-body").innerText();

  // Đổi sang nguồn thứ hai khi viewer đang mở → text đổi.
  await openButtons.nth(1).click();
  await expect
    .poll(
      async () =>
        (await win.getByTestId("viewer-body").innerText()) !== firstText,
      {
        timeout: 5000,
      },
    )
    .toBe(true);

  // Đóng viewer → về workspace.
  await win.getByTestId("viewer-close").click();
  await expect(win.getByTestId("source-viewer")).toHaveCount(0);
});
