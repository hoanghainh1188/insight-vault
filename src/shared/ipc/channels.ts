import type {
  AddSourceResult,
  AppInfo,
  DataDirInfo,
  Model,
  ModelSelection,
  Notebook,
  OnboardingState,
  OnlineState,
  PrivacyState,
  StorageInfo,
  RagAnswer,
  RuntimeStatus,
  Source,
  SourceContent,
  ContentSearchHit,
  StudioResult,
  StudioExportResult,
  StoredChatMessage,
  ModelRecommendation,
  OllamaHealth,
  ReindexStatus,
} from "./types";

/**
 * Whitelist đầy đủ các kênh IPC (Constitution III). NGUỒN DUY NHẤT: main (register) + preload (expose).
 * Feature sau THÊM kênh mới ở đây — KHÔNG đổi nghĩa kênh cũ.
 * - app:*    → 001-app-shell (5 kênh)
 * - ai:*     → 007-ai-runtime (5 kênh)
 * - notebook:* → 009-notebooks (5 kênh)
 * - source:* → 011-ingestion (5 invoke + 1 event push)
 */
export const CHANNELS = {
  getDataDir: "app:getDataDir",
  getStorageInfo: "app:getStorageInfo",
  getPrivacyState: "app:getPrivacyState",
  getOnboardingState: "app:getOnboardingState",
  setOnboardingComplete: "app:setOnboardingComplete",
  getAppInfo: "app:getAppInfo",
  // ghi clipboard qua main (renderer sandbox: navigator.clipboard bị chặn bởi permission handler) (#67)
  clipboardWrite: "app:clipboardWrite",
  // ai-runtime (007)
  aiListModels: "ai:listModels",
  aiTestConnection: "ai:testConnection",
  aiGetSelectedModels: "ai:getSelectedModels",
  aiSetSelectedModels: "ai:setSelectedModels",
  aiGetRuntimeStatus: "ai:getRuntimeStatus",
  // online-provider (031) — AI online tùy chọn (Claude/Gemini/OpenAI)
  aiGetOnlineState: "ai:getOnlineState",
  aiSetProviderKey: "ai:setProviderKey",
  aiDeleteProviderKey: "ai:deleteProviderKey",
  aiSetProviderModel: "ai:setProviderModel",
  aiSetActiveProvider: "ai:setActiveProvider",
  aiTestProvider: "ai:testProvider",
  // 059 — gợi ý model chat theo RAM + health-check Ollama
  aiRecommendModel: "ai:recommendModel",
  aiOllamaHealth: "ai:ollamaHealth",
  // notebooks (009)
  notebookList: "notebook:list",
  notebookCreate: "notebook:create",
  notebookRename: "notebook:rename",
  notebookSetColor: "notebook:setColor",
  notebookDelete: "notebook:delete",
  // ingestion (011) — 5 invoke
  sourceAdd: "source:add",
  sourceListByNotebook: "source:listByNotebook",
  sourceGet: "source:get",
  sourceDelete: "source:delete",
  sourceRetry: "source:retry",
  // source-viewer (019) — lấy toàn văn nguồn để hiển thị + highlight
  sourceGetContent: "source:getContent",
  // content-search (073) — tìm toàn văn nội dung nguồn trong notebook (FTS5 BM25)
  sourceSearch: "source:search",
  // ingestion (011) — 1 event push (main→renderer, KHÔNG phải invoke/ChannelResponse)
  sourceProgress: "source:progress",
  // rag-qa (013) — hỏi đáp theo nguồn
  ragAsk: "rag:ask",
  // streaming (039) — Chat trả lời chạy dần
  ragAskStream: "rag:askStream",
  ragStreamToken: "rag:streamToken", // event push main→renderer (KHÔNG vào ChannelResponse)
  ragStop: "rag:stop",
  // chat-history (027) — lưu/nạp/xoá lịch sử hội thoại theo notebook
  chatHistory: "chat:history",
  chatClear: "chat:clear",
  // studio (021) — tổng hợp tri thức từ notebook
  studioGenerate: "studio:generate",
  studioList: "studio:list",
  // studio export (025) — xuất kết quả ra tệp .md
  studioExport: "studio:export",
  // 059 embed-in-process — trạng thái tái lập chỉ mục
  embedReindexStatus: "embed:reindexStatus",
  embedReindexProgress: "embed:reindexProgress", // event push main→renderer
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

/** Tập tên kênh whitelisted (dùng cho guard ở main). */
export const WHITELISTED_CHANNELS: ReadonlySet<string> = new Set(
  Object.values(CHANNELS),
);

/** Guard thuần — kiểm 1 tên kênh có thuộc whitelist không (unit-test được, không cần electron). */
export function isWhitelisted(channel: string): channel is ChannelName {
  return WHITELISTED_CHANNELS.has(channel);
}

/** Bản đồ kiểu response theo kênh — dùng cho type-safety ở preload/renderer. */
export interface ChannelResponse {
  [CHANNELS.getDataDir]: DataDirInfo;
  [CHANNELS.getStorageInfo]: StorageInfo;
  [CHANNELS.getPrivacyState]: PrivacyState;
  [CHANNELS.getOnboardingState]: OnboardingState;
  [CHANNELS.setOnboardingComplete]: { completed: true };
  [CHANNELS.getAppInfo]: AppInfo;
  [CHANNELS.clipboardWrite]: { ok: true };
  [CHANNELS.aiListModels]: Model[];
  [CHANNELS.aiTestConnection]: RuntimeStatus;
  [CHANNELS.aiGetSelectedModels]: ModelSelection;
  [CHANNELS.aiSetSelectedModels]: ModelSelection;
  [CHANNELS.aiGetRuntimeStatus]: RuntimeStatus;
  // online-provider (031)
  [CHANNELS.aiGetOnlineState]: OnlineState;
  [CHANNELS.aiSetProviderKey]: OnlineState;
  [CHANNELS.aiDeleteProviderKey]: OnlineState;
  [CHANNELS.aiSetProviderModel]: OnlineState;
  [CHANNELS.aiSetActiveProvider]: OnlineState;
  [CHANNELS.aiTestProvider]: RuntimeStatus;
  // 059 — gợi ý model theo RAM + health Ollama
  [CHANNELS.aiRecommendModel]: ModelRecommendation;
  [CHANNELS.aiOllamaHealth]: OllamaHealth;
  [CHANNELS.notebookList]: Notebook[];
  [CHANNELS.notebookCreate]: Notebook;
  [CHANNELS.notebookRename]: Notebook;
  [CHANNELS.notebookSetColor]: Notebook;
  [CHANNELS.notebookDelete]: { deleted: true };
  // ingestion (011) — chỉ 5 kênh invoke (source:progress là event push, không vào đây).
  [CHANNELS.sourceAdd]: AddSourceResult;
  [CHANNELS.sourceListByNotebook]: Source[];
  [CHANNELS.sourceGet]: Source | null;
  [CHANNELS.sourceDelete]: { deleted: true };
  [CHANNELS.sourceRetry]: Source;
  // source-viewer (019)
  [CHANNELS.sourceGetContent]: SourceContent | null;
  // content-search (073)
  [CHANNELS.sourceSearch]: ContentSearchHit[];
  // rag-qa (013)
  [CHANNELS.ragAsk]: RagAnswer;
  // streaming (039) — ragStreamToken là event push, không vào đây
  [CHANNELS.ragAskStream]: RagAnswer;
  [CHANNELS.ragStop]: { stopped: true };
  // studio (021)
  [CHANNELS.studioGenerate]: StudioResult;
  [CHANNELS.studioList]: StudioResult[];
  // studio export (025)
  [CHANNELS.studioExport]: StudioExportResult;
  // chat-history (027)
  [CHANNELS.chatHistory]: StoredChatMessage[];
  [CHANNELS.chatClear]: { cleared: true };
  // 059 embed-in-process
  [CHANNELS.embedReindexStatus]: ReindexStatus;
}
