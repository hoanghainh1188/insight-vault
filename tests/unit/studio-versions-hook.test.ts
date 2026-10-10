// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useStudio } from "../../src/renderer/features/studio/useStudio";
import type { StudioGenerateInput, StudioResult } from "@shared/ipc/types";

// 178 (T016): useStudio — phiên bản: nạp studio:list ⇒ versions theo loại; tạo xong ⇒ bản mới đứng đầu + được chọn;
// chọn bản cũ; xoá phiên bản (IPC rồi cập nhật); results = phiên bản ĐANG XEM; xoá khi đang Tạo lại không ảnh hưởng lượt.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let hook: ReturnType<typeof useStudio>;
let inputs: StudioGenerateInput[];
let settle: Array<{ ok: (v: unknown) => void; fail: (e: unknown) => void }>;
let stored: StudioResult[];
let studioDeleteVersion: ReturnType<typeof vi.fn>;

function Harness({ nb }: { nb: string }): null {
  hook = useStudio(nb);
  return null;
}

const ver = (
  id: string,
  createdAt: number,
  kind: StudioResult["kind"] = "summary",
  extra: Partial<StudioResult> = {},
): StudioResult => ({
  id,
  notebookId: "A",
  kind,
  content: id,
  citations: [],
  createdAt,
  ...extra,
});

beforeEach(() => {
  inputs = [];
  settle = [];
  stored = [ver("s2", 2), ver("s1", 1), ver("f1", 1, "faq")];
  studioDeleteVersion = vi.fn(() => Promise.resolve({ deleted: true }));
  (window as unknown as { api: unknown }).api = {
    aiGetRuntimeStatus: () => Promise.resolve({ ollamaReady: true }),
    sourceListByNotebook: () => Promise.resolve([]),
    onSourceProgress: () => () => undefined,
    onStudioStreamToken: () => () => undefined, // 178 PR 4
    onStudioProgress: () => () => undefined,
    studioList: () => Promise.resolve(stored),
    studioCancel: () => Promise.resolve({ cancelled: true }),
    studioDeleteVersion,
    studioGenerate: vi.fn(
      (input: StudioGenerateInput) =>
        new Promise((ok, fail) => {
          inputs.push(input);
          settle.push({ ok, fail });
        }),
    ),
  };
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

async function mount(nb = "A"): Promise<void> {
  await act(async () => root.render(createElement(Harness, { nb })));
}

describe("useStudio — phiên bản (178)", () => {
  it("nạp studio:list ⇒ versions theo loại (mới nhất trước); results = bản mới nhất", async () => {
    await mount();
    expect(hook.versions.summary?.map((v) => v.id)).toEqual(["s2", "s1"]);
    expect(hook.versions.faq?.map((v) => v.id)).toEqual(["f1"]);
    expect(hook.results.summary?.id).toBe("s2");
  });

  it("select(kind, id) ⇒ results[kind] là bản được chọn", async () => {
    await mount();
    act(() => hook.select("summary", "s1"));
    expect(hook.results.summary?.id).toBe("s1");
    expect(hook.selected.summary).toBe("s1");
  });

  it("tạo xong ⇒ bản mới đứng đầu và được chọn (kể cả đang xem bản cũ)", async () => {
    await mount();
    act(() => hook.select("summary", "s1"));
    act(() => void hook.generate("summary"));
    await act(async () => settle[0].ok(ver("s3", 3)));
    expect(hook.versions.summary?.map((v) => v.id)).toEqual(["s3", "s2", "s1"]);
    expect(hook.results.summary?.id).toBe("s3");
  });

  it("nhãn AI cục bộ đọc từ phiên bản (local), không còn localKinds", async () => {
    await mount();
    act(() => void hook.generate("summary", { target: "local" }));
    await act(async () =>
      settle[0].ok(ver("s3", 3, "summary", { local: true })),
    );
    expect(hook.results.summary?.local).toBe(true);
    expect("localKinds" in hook).toBe(false);
  });

  it("deleteVersion ⇒ gọi IPC {notebookId, id}; xoá bản đang xem ⇒ về bản mới nhất còn lại; trả nextId", async () => {
    await mount();
    let next: string | undefined = "x";
    await act(async () => {
      next = await hook.deleteVersion("summary", "s2");
    });
    expect(studioDeleteVersion).toHaveBeenCalledWith({
      notebookId: "A",
      id: "s2",
    });
    expect(hook.versions.summary?.map((v) => v.id)).toEqual(["s1"]);
    expect(hook.results.summary?.id).toBe("s1");
    expect(next).toBe("s1");
  });

  it("xoá bản cuối ⇒ loại không còn kết quả", async () => {
    await mount();
    await act(async () => void (await hook.deleteVersion("faq", "f1")));
    expect(hook.versions.faq).toBeUndefined();
    expect(hook.results.faq).toBeUndefined();
  });

  it("IPC trả deleted:false (bản đã không còn trong DB) ⇒ vẫn gỡ khỏi UI, không để bản ma", async () => {
    studioDeleteVersion.mockResolvedValueOnce({ deleted: false });
    await mount();
    await act(async () => void (await hook.deleteVersion("summary", "s2")));
    expect(hook.versions.summary?.map((v) => v.id)).toEqual(["s1"]);
  });

  it("IPC xoá lỗi ⇒ ném cho UI xử lý, state không đổi", async () => {
    studioDeleteVersion.mockRejectedValueOnce(new Error("ipc"));
    await mount();
    let err: unknown;
    await act(async () => {
      err = await hook.deleteVersion("summary", "s2").catch((e) => e);
    });
    expect(err).toBeInstanceOf(Error);
    expect(hook.versions.summary?.map((v) => v.id)).toEqual(["s2", "s1"]);
  });

  it("race: lượt tạo xong TRONG LÚC chờ IPC xoá ⇒ bản mới không bị ghi đè mất", async () => {
    let releaseDelete: (v: { deleted: boolean }) => void = () => undefined;
    studioDeleteVersion.mockImplementationOnce(
      () => new Promise((r) => (releaseDelete = r)),
    );
    await mount();
    act(() => void hook.generate("summary"));
    let pending: Promise<string | undefined> = Promise.resolve(undefined);
    act(() => {
      pending = hook.deleteVersion("summary", "s1");
    });
    await act(async () => settle[0].ok(ver("s3", 3)));
    await act(async () => {
      releaseDelete({ deleted: true });
      await pending;
    });
    expect(hook.versions.summary?.map((v) => v.id)).toEqual(["s3", "s2"]);
    expect(hook.results.summary?.id).toBe("s3");
  });

  it("xoá bản đang xem trong lúc 'Tạo lại' ⇒ lượt vẫn chạy, xong chèn bản mới và chọn nó", async () => {
    await mount();
    act(() => void hook.generate("summary"));
    await act(async () => void (await hook.deleteVersion("summary", "s2")));
    expect(hook.loading.summary).toBe(true);
    await act(async () => settle[0].ok(ver("s3", 3)));
    expect(hook.versions.summary?.map((v) => v.id)).toEqual(["s3", "s1"]);
    expect(hook.results.summary?.id).toBe("s3");
    expect(hook.loading.summary).toBeFalsy();
  });

  it("đổi notebook ⇒ versions / selected nạp lại", async () => {
    await mount("A");
    act(() => hook.select("summary", "s1"));
    stored = [ver("b1", 1)];
    await mount("B");
    expect(hook.versions.summary?.map((v) => v.id)).toEqual(["b1"]);
    expect(hook.selected.summary).toBeUndefined();
  });
});

describe("useStudio — phạm vi nhiều nguồn (178 PR 4)", () => {
  it("generate(kind, { sourceIds }) ⇒ gửi sourceIds (mảng mới), không gửi sourceId cũ", async () => {
    await mount();
    const ids = ["a", "b"];
    act(() => void hook.generate("summary", { sourceIds: ids }));
    expect(inputs[0].sourceIds).toEqual(["a", "b"]);
    expect(inputs[0].sourceIds).not.toBe(ids);
    expect("sourceId" in inputs[0]).toBe(false);
  });

  it("sourceIds rỗng / thiếu ⇒ không gửi trường (mọi nguồn ready)", async () => {
    await mount();
    act(() => void hook.generate("summary", { sourceIds: [] }));
    act(() => void hook.generate("faq"));
    expect("sourceIds" in inputs[0]).toBe(false);
    expect("sourceIds" in inputs[1]).toBe(false);
  });

  it("sources = MỌI nguồn của notebook; readySources chỉ nguồn ready", async () => {
    (
      window as unknown as { api: { sourceListByNotebook: unknown } }
    ).api.sourceListByNotebook = () =>
      Promise.resolve([
        { id: "a", status: "ready", title: "A" },
        { id: "p", status: "processing", title: "P" },
      ]);
    await mount();
    expect(hook.sources.map((s) => s.id)).toEqual(["a", "p"]);
    expect(hook.readySources.map((s) => s.id)).toEqual(["a"]);
  });
});
