import type { LanguageCode } from "@shared/i18n";
import { UserFacingError } from "@shared/codes/user-error";
import type {
  Chunk,
  ChatMessage,
  Source,
  StudioGenerateInput,
  StudioResult,
} from "@shared/ipc/types";
import type { ScoredChunk } from "../rag/rag-types";
import { buildBalancedContext } from "./balanced-context";
import { postprocessCitations, citationsFromMap } from "../rag/citation";
import { STUDIO_CONTEXT_BUDGET, STUDIO_KINDS } from "./constants";
import { languageReminder, systemPromptFor } from "./prompt";
import {
  runMapReduce,
  safeProgress,
  type OnStudioProgress,
} from "./map-reduce";
import type { StudioRepo } from "./studio-repo";
import { assertNotAborted, isChatAborted } from "../ai-runtime/abort";

// Điều phối Studio (studio:generate / studio:list). DI: nguồn chunk + chat + repo lưu.
// 105 (ADR studio-large-clarify): ngân sách theo CỬA SỔ NGỮ CẢNH của model (contextInfo) + num_ctx tường minh.
// Vừa ngân sách ⇒ 1 lượt (chia đều theo nguồn, #65); vượt ⇒ map-reduce với [n] TOÀN CỤC (chip vẫn trỏ đúng đoạn).
// Hậu kiểm chip (Constitution II) → lưu PHIÊN BẢN mới (178). KHÔNG log nội dung (Constitution III).

export interface StudioServiceDeps {
  /** 123: ngôn ngữ đầu ra mặc định (ngôn ngữ hiệu lực của main) khi input không gửi/không hợp lệ. */
  defaultOutputLanguage?: () => LanguageCode;
  /** Nguồn của notebook (011) — chỉ đọc. */
  listSources: (notebookId: string) => Source[];
  listChunks: (sourceId: string) => Chunk[];
  studioRepo: StudioRepo;
  /** Gọi LLM chat với messages[], trả nội dung (wrap LLMProvider.chat → content). numCtx: cửa sổ Ollama (105). */
  chat: (
    messages: ChatMessage[],
    opts?: { numCtx?: number; signal?: AbortSignal },
  ) => Promise<string>;
  /**
   * 105: ngân sách ký tự cho phần đoạn nguồn + num_ctx theo model đang dùng. Thiếu ⇒ 16.000 ký tự, không ép num_ctx
   * (hành vi cũ).
   */
  contextInfo?: () => Promise<{ budget: number; numCtx: number | null }>;
}

function isStudioKind(k: string): k is (typeof STUDIO_KINDS)[number] {
  return (STUDIO_KINDS as readonly string[]).includes(k);
}

export function createStudioService(deps: StudioServiceDeps) {
  /**
   * 146: `onProgress` (tuỳ chọn) nhận reading i/N · condensing · writing — không ảnh hưởng kết quả.
   * 149: `signal` huỷ lượt — không gọi thêm AI, KHÔNG lưu; ném UserFacingError("studioCancelled").
   */
  async function generate(
    input: StudioGenerateInput,
    opts: { onProgress?: OnStudioProgress; signal?: AbortSignal } = {},
  ): Promise<StudioResult> {
    try {
      return await run(input, opts);
    } catch (e) {
      if (isChatAborted(e) || opts.signal?.aborted) {
        throw new UserFacingError("studioCancelled");
      }
      throw e;
    }
  }

  async function run(
    input: StudioGenerateInput,
    {
      onProgress,
      signal,
    }: { onProgress?: OnStudioProgress; signal?: AbortSignal },
  ): Promise<StudioResult> {
    const { notebookId, kind, sourceId } = input;
    // 123 (FR-018): chỉ nhận vi/en; khác ⇒ ngôn ngữ hiệu lực của main (mặc định vi).
    const outputLanguage: LanguageCode =
      input.outputLanguage === "vi" || input.outputLanguage === "en"
        ? input.outputLanguage
        : (deps.defaultOutputLanguage?.() ?? "vi");
    if (!notebookId || !isStudioKind(kind)) {
      throw new Error("Invalid Studio request.");
    }

    // Gom chunk theo NHÓM NGUỒN (mỗi nguồn 1 mảng, chunk theo ordinal). buildBalancedContext chia đều
    // ngân sách cho mọi nguồn (#65) → bản tóm tắt không thiên về 1 tài liệu.
    // sourceId (025): lọc CHỈ nguồn đó (phải ready + thuộc notebook); bỏ trống → toàn bộ nguồn ready.
    const groups: ScoredChunk[][] = [];
    let totalChunks = 0;
    for (const src of deps.listSources(notebookId)) {
      if (src.status !== "ready") continue;
      if (sourceId && src.id !== sourceId) continue;
      const chunks = deps
        .listChunks(src.id)
        .map((chunk) => ({ chunk, sourceTitle: src.title, score: 0 }));
      if (chunks.length > 0) {
        groups.push(chunks);
        totalChunks += chunks.length;
      }
    }
    if (totalChunks === 0) {
      throw new UserFacingError(
        sourceId ? "studioSourceNotReady" : "studioNoReadySources",
      );
    }

    const ctx = deps.contextInfo
      ? await deps.contextInfo()
      : { budget: STUDIO_CONTEXT_BUDGET, numCtx: null };
    assertNotAborted(signal); // 149: sau khi lấy ngân sách
    const chatOpts =
      ctx.numCtx || signal
        ? {
            ...(ctx.numCtx ? { numCtx: ctx.numCtx } : {}),
            ...(signal ? { signal } : {}),
          }
        : undefined;
    const chat = (messages: ChatMessage[]): Promise<string> =>
      deps.chat(messages, chatOpts);

    // Vừa ngân sách (theo TỔNG độ dài thật — không theo round-robin, vốn nhận chunk đầu mọi nguồn bất chấp ngân
    // sách) ⇒ 1 lượt như cũ. Vượt ⇒ map-reduce (ném nếu runtime chưa sẵn sàng → bubble lên, không bịa).
    const single = buildBalancedContext(groups, Number.POSITIVE_INFINITY);
    let raw: string;
    let map = single.map;
    let parts = 1;
    let truncated = false;
    if (single.contextText.length <= ctx.budget) {
      safeProgress(onProgress)({ phase: "writing" }); // 146: một lượt ⇒ chỉ pha viết (bất định)
      raw = await chat([
        { role: "system", content: systemPromptFor(kind, outputLanguage) },
        {
          role: "user",
          content: `${single.contextText}\n\n${languageReminder(outputLanguage)}`,
        },
      ]);
    } else {
      const mr = await runMapReduce({
        kind,
        groups,
        budget: ctx.budget,
        chat,
        outputLanguage,
        onProgress,
        signal,
      });
      ({ raw, map, parts, truncated } = mr);
    }
    const { answer, citations } = postprocessCitations(raw, map);

    if (answer.trim() === "") {
      throw new UserFacingError("studioEmptyOutput");
    }
    // Grounded fallback: có nội dung nhưng model không chèn [n] hợp lệ → gắn nguồn đã dùng (kiểm chứng được).
    const finalCitations =
      citations.length > 0 ? citations : citationsFromMap(map);

    assertNotAborted(signal); // 149: ngay trước khi lưu — lượt đã huỷ KHÔNG ghi DB
    // 178: mỗi lượt thành công = 1 phiên bản; parts / truncated / local (nhãn 098) lưu cùng phiên bản (G4).
    return deps.studioRepo.insert({
      notebookId,
      kind,
      content: answer,
      citations: finalCitations,
      parts,
      truncated,
      local: input.target === "local",
    });
  }

  function list(notebookId: string): StudioResult[] {
    return deps.studioRepo.listByNotebook(notebookId);
  }

  /** 178: xoá một phiên bản — tham số từ renderer (không tin) ⇒ kiểm chuỗi không rỗng; repo chỉ xoá khi khớp notebook. */
  function deleteVersion(
    notebookId: unknown,
    id: unknown,
  ): { deleted: boolean } {
    if (
      typeof notebookId !== "string" ||
      notebookId === "" ||
      typeof id !== "string" ||
      id === ""
    ) {
      return { deleted: false };
    }
    return { deleted: deps.studioRepo.deleteVersion(notebookId, id) };
  }

  return { generate, list, deleteVersion };
}

export type StudioService = ReturnType<typeof createStudioService>;
