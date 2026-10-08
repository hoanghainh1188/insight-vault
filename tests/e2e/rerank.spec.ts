import { test, expect, type ElectronApplication } from "@playwright/test";
import { join } from "node:path";
import { launchFresh, dismissOnboarding, UNREACHABLE_OLLAMA } from "./helper";

// 109 (T035, US1/US4): bộ chấm độ liên quan trong app thật với bộ chấm GIẢ tất định (IV_RERANK_FAKE=1 qua helper — điểm = tỉ lệ
// từ của câu hỏi có trong đoạn; ngưỡng đã hiệu chuẩn 0,6). Ollama không chạy ⇒ lượt nào tới bước gọi model sẽ lỗi; lượt bị
// bộ chấm chặn trả "không tìm thấy" mà KHÔNG gọi model.

let app: ElectronApplication;
test.beforeAll(async () => {
  app = await launchFresh(UNREACHABLE_OLLAMA);
});
test.afterAll(async () => await app?.close());

test("Cài đặt hiện trạng thái bộ chấm; câu không liên quan ⇒ không tìm thấy (không gọi model); câu liên quan ⇒ đi tiếp", async () => {
  const win = await app.firstWindow();
  await dismissOnboarding(win);

  const nbId = await win.evaluate(
    async (file) => {
      const nb = await window.api.notebookCreate({
        name: "Rerank",
        color: "#1E6B57",
      });
      await window.api.sourceAdd({
        notebookId: nb.id,
        kind: "md",
        filePath: file,
      });
      return nb.id;
    },
    join(process.cwd(), "tests/eval/corpus/pho.md"),
  );
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

  // Trạng thái ở Cài đặt (seam ⇒ "ready").
  expect(await win.evaluate(() => window.api.getRerankerStatus())).toBe(
    "ready",
  );
  await win.getByTestId("nav-settings").click();
  await expect(win.getByTestId("reranker-status")).toHaveAttribute(
    "data-state",
    "ready",
  );

  // Câu chỉ trùng "phở" với tài liệu (1/5 từ = 0,2 < 0,6; BM25 vẫn khớp "phở" nên tập ứng viên KHÔNG rỗng) ⇒ bộ chấm loại mọi đoạn ⇒ không tìm thấy, không cần Ollama.
  const blocked = await win.evaluate(
    (id) =>
      window.api.ragAsk({
        notebookId: id,
        question: "Paris Zurich Nairobi Quito phở?",
        mode: "grounded",
        history: [],
      }),
    nbId,
  );
  expect(blocked.notFound).toBe(true);
  expect(blocked.citations).toEqual([]);

  // Câu khớp tài liệu ⇒ qua bộ chấm ⇒ tới bước gọi model (Ollama không chạy ⇒ lỗi) — chứng minh không bị lọc nhầm.
  const passed = await win.evaluate(async (id) => {
    try {
      await window.api.ragAsk({
        notebookId: id,
        question: "Phở có nguồn gốc từ đâu?",
        mode: "grounded",
        history: [],
      });
      return "answered";
    } catch {
      return "reachedModel";
    }
  }, nbId);
  expect(passed).toBe("reachedModel");
});
