// Barrel feature embedding in-process (059).
export { createEmbedder, type Embedder } from "./embed-model";
export { withE5Prefix, type EmbedRole } from "./e5-prefix";
export { l2normalize } from "./vector-normalize";
export {
  EMBEDDING_MODEL,
  EMBEDDING_DIM,
  EMBEDDING_MODEL_VERSION,
  EMBEDDING_VERSION_REINDEXING,
  matchesVersion,
  reindexPhase,
  type ReindexPhase,
} from "./model-version";
export { planReindexBatches } from "./reindex-plan";
export {
  runReindex,
  needsReindex,
  type ReindexDeps,
  type ChunkRef,
  type ReindexVectorStore,
} from "./reindex-runner";
