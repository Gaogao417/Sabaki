export {createAnalysisService} from './analysisService.ts'

export {getBoardAnalysisContext} from './boardAnalysisContext.ts'
export type {BoardAnalysisContextDeps} from './boardAnalysisContext.ts'

export {
  SCRATCH_ANALYSIS_REQUEST_GROUP,
  createScratchAnalysisContext,
  scheduleScratchAnalysis,
  refreshScratchAnalysis,
  getScratchAnalysisCacheKey,
  cacheScratchOwnership,
  getCachedScratchOwnership,
} from './scratchAnalysis.ts'
export type {ScratchAnalysisDeps} from './scratchAnalysis.ts'

export {
  analyzeGameTreePosition,
  scheduleGameTreeAnalysis,
} from './gameTreeAnalysis.ts'

export type {
  AnalysisContext,
  AnalysisContextBase,
  AnalysisRuntimeState,
  AnalysisTarget,
  EditWorkspaceAnalysisState,
  EngineAnalysis,
  EngineAnalysisVariation,
  EngineSyncerLike,
  GameTreeAnalysisContext,
  GameTreeAnalysisTarget,
  GameTreeDraftLike,
  GameTreeLike,
  GameTreeNodeLike,
  HumanPolicyMap,
  OwnershipGrid,
  PlayerSign,
  RunBoardAnalysis,
  RunBoardAnalysisOptions,
  ScratchAnalysisContext,
  ScratchAnalysisTab,
  ScratchAnalysisTarget,
  SgfProperties,
  SnapshotToGameTreeResult,
  VariationAnalysisContext,
  VariationAnalysisTarget,
  Vertex,
} from './analysisTypes.ts'

// Legacy constant kept for backward compat — use SCRATCH_ANALYSIS_REQUEST_GROUP
export {SCRATCH_ANALYSIS_REQUEST_GROUP as SCRATCH_ANALYSIS_SOURCE} from './analysisTypes.ts'
