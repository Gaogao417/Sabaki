export {createAnalysisService} from './analysisService.ts'
export type {AnalysisServiceDeps} from './analysisService.ts'

export {createAnalysisAreaStore} from './analysisAreaStore.ts'
export type {AnalysisAreaState, AnalysisAreaRect} from './analysisAreaStore.ts'

export {getBoardAnalysisContext} from './boardAnalysisContext.ts'
export type {BoardAnalysisContextDeps} from './boardAnalysisContext.ts'

export {
  createScratchAnalysisContext,
  scheduleScratchAnalysis,
  refreshScratchAnalysis,
  getScratchAnalysisCacheKey,
  cacheScratchOwnership,
  getCachedScratchOwnership,
} from './scratchAnalysis.ts'
export type {ScratchAnalysisDeps} from './scratchAnalysis.ts'

export {createWorkbenchAnalysisScratchRegion} from './workbenchAnalysisScratchRegion.ts'
export type {
  WorkbenchAnalysisScratchAdapter,
  WorkbenchAnalysisScratchRegion,
  WorkbenchAnalysisScratchResultInput,
  WorkbenchAnalysisScratchTarget,
} from './workbenchAnalysisScratchRegion.ts'

export {
  analyzeGameTreePosition,
  scheduleGameTreeAnalysis,
} from './gameTreeAnalysis.ts'

export {
  createAnalysisCache,
  getOwnershipCacheKey,
  cacheOwnership,
  getCachedOwnership,
  cachePreviewOwnership,
  getCachedPreviewOwnership,
  getCurrentOwnership,
  getOwnershipForTreePosition,
} from './analysisCache.ts'

export {
  createAnalysisLifecycle,
  runBoardAnalysis,
  runOwnershipAnalysis,
  ensureAnalysisReady,
  attachDefaultAnalysisEngine,
  getAnalysisSyncerId,
  refreshActiveBoardAnalysis,
} from './analysisLifecycle.ts'
export type {
  AnalysisLifecycleDeps,
  RunBoardAnalysisOptions,
  RunOwnershipAnalysisOptions,
} from './analysisLifecycle.ts'

export {
  SCRATCH_ANALYSIS_REQUEST_GROUP,
  SCRATCH_ANALYSIS_REQUEST_GROUP as SCRATCH_ANALYSIS_SOURCE,
} from './analysisTypes.ts'

export type {
  AnalysisContext,
  AnalysisContextBase,
  AnalysisRuntimeState,
  AnalysisTarget,
  EditWorkspaceAnalysisState,
  EngineAnalysis,
  EngineAnalysisVariation,
  EngineSyncerLike,
  GameTree,
  GameTreeAnalysisContext,
  GameTreeAnalysisTarget,
  GameTreeDraft,
  HumanPolicyMap,
  OwnershipGrid,
  PlayerSign,
  RunBoardAnalysis,
  ScratchAnalysisContext,
  ScratchAnalysisTab,
  ScratchAnalysisTarget,
  SgfProperties,
  SnapshotToGameTreeResult,
  TreeNode,
  TreeId,
  VariationAnalysisContext,
  VariationAnalysisTarget,
  Vertex,
} from './analysisTypes.ts'
