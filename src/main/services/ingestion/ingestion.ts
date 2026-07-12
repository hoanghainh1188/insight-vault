import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type { SourceProgressEvent } from "@shared/ipc/types";
import type { Db } from "../../db/database";
import type { AiRuntime } from "../ai-runtime/ai-runtime";
import { createSourceRepo, type SourceRepo } from "./source-repo";
import { createLanceVectorStore, type VectorStore } from "./vector-store";
import { createIngestionPipeline, type IngestionPipeline } from "./pipeline";
import { parseText } from "./parsers/text";
import { parsePdf } from "./parsers/pdf";
import { parseDocx } from "./parsers/docx";
import { fetchAndParseUrl } from "./parsers/url";

// Ghép domain ingestion ở main: source-repo (SQLite) + vector-store (LanceDB) + pipeline (parse/chunk/
// embed). Composition root — loại khỏi ngưỡng coverage (như ai-runtime.ts). Business logic thuần đã
// phủ ở chunker/cleaning/dedup/size-limits/status/source-repo/queue/pipeline test (DI).

export interface Ingestion {
  sourceRepo: SourceRepo;
  vectorStore: VectorStore;
  pipeline: IngestionPipeline;
}

export async function createIngestion(opts: {
  db: Db;
  dataDir: string;
  aiRuntime: AiRuntime;
  emit: (e: SourceProgressEvent) => void;
  setOnline?: (online: boolean) => void;
}): Promise<Ingestion> {
  const sourceRepo = createSourceRepo(opts.db);
  const vectorStore = await createLanceVectorStore(
    join(opts.dataDir, "vectors"),
  );

  const pipeline = createIngestionPipeline({
    sourceRepo,
    vectorStore,
    // Embedding lúc nạp nguồn LUÔN dùng Ollama local (031, FR-005 / quyết định #1) — KHÔNG qua
    // registry.getActive() (đổi theo provider chat online). Trộn embedding khác nhà cung cấp sẽ phá vector
    // index + rò rỉ corpus ra ngoài nếu provider online implement embed. embedLocal buộc cứng về Ollama.
    getProvider: () => ({ embed: opts.aiRuntime.embedLocal }),
    isRuntimeReady: async () =>
      (await opts.aiRuntime.getRuntimeStatus()).ollamaReady,
    readFile: async (p) => new Uint8Array(await readFile(p)),
    parseFile: async (kind, bytes) => {
      if (kind === "pdf") return parsePdf(bytes);
      if (kind === "docx") return parseDocx(Buffer.from(bytes));
      return parseText(new TextDecoder().decode(bytes)); // txt/md
    },
    parseUrl: (url) => fetchAndParseUrl(url),
    setOnline: opts.setOnline,
    emit: opts.emit,
  });

  return { sourceRepo, vectorStore, pipeline };
}
