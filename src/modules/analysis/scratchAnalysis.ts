import {getSnapshotSignature, snapshotToGameTree} from '../study.js'
import type {ScratchPosition} from '../workbench/contracts/positionSource.ts'
import type {
  EditWorkspaceAnalysisState,
  EngineAnalysis,
  EngineSyncerLike,
  GameTreeLike,
  OwnershipGrid,
  RunBoardAnalysis,
  ScratchAnalysisTab,
} from './analysisTypes.ts'
import {SCRATCH_ANALYSIS_REQUEST_GROUP} from './analysisTypes.ts'

// Legacy constant name for backward compatibility
export {SCRATCH_ANALYSIS_REQUEST_GROUP as SCRATCH_ANALYSIS_SOURCE} from './analysisTypes.ts'

// ---------------------------------------------------------------------------
// Internal scratch analysis state — owned by this module.
// ---------------------------------------------------------------------------

let scratchTimer: ReturnType<typeof setTimeout> | null = null
let scratchGeneration = 0
let scratchOwnershipCache: Record<string, OwnershipGrid> = {}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

export function getScratchAnalysisCacheKey(
  syncerId: string | null,
  snapshot: ScratchPosition | null,
): string | null {
  if (syncerId == null || snapshot == null) return null
  let signature = getSnapshotSignature(snapshot)
  if (signature == null) return null
  return [syncerId, signature].join(':')
}

export function cacheScratchOwnership(
  syncerId: string,
  snapshot: ScratchPosition,
  ownership: OwnershipGrid,
): void {
  let key = getScratchAnalysisCacheKey(syncerId, snapshot)
  if (key != null) scratchOwnershipCache[key] = ownership
}

export function getCachedScratchOwnership(
  syncerId: string,
  snapshot: ScratchPosition,
): OwnershipGrid | null {
  let key = getScratchAnalysisCacheKey(syncerId, snapshot)
  return key == null ? null : scratchOwnershipCache[key] ?? null
}

// ---------------------------------------------------------------------------
// Scratch analysis context creation
// ---------------------------------------------------------------------------

/**
 * Create a legacy analysis context from a scratch snapshot.
 *
 * Returns a plain object with a `source` field for backward compat with
 * callers that still check `ctx.source`. New code should use
 * `getBoardAnalysisContext()` which returns `kind`-discriminated contexts.
 */
export function createScratchAnalysisContext(
  snapshot: ScratchPosition | null,
  options: {
    tab: ScratchAnalysisTab
    sourceTree: GameTreeLike | null
    syncerId: string
  },
) {
  if (snapshot == null) return null

  let result = snapshotToGameTree(snapshot, [], options.sourceTree)
  if (result == null) return null

  let {tree, treePosition} = result
  return {
    source: SCRATCH_ANALYSIS_REQUEST_GROUP,
    tab: options.tab,
    tree,
    treePosition,
    analyzePlayer: snapshot.nextPlayer,
    syncerId: options.syncerId,
  }
}

// ---------------------------------------------------------------------------
// Deps type
// ---------------------------------------------------------------------------

export type ScratchAnalysisDeps = {
  getState: () => {editWorkspace?: EditWorkspaceAnalysisState; [k: string]: unknown}
  setState: (patch: Record<string, unknown>) => void
  getSyncer: () => EngineSyncerLike | null
  engineSupportsOwnership: (syncer: EngineSyncerLike) => boolean
  runBoardAnalysis: RunBoardAnalysis
  getSourceTree: () => GameTreeLike | null
  logger?: {log: (...args: unknown[]) => void}
}

// ---------------------------------------------------------------------------
// Scheduling & refresh — owned by this module
// ---------------------------------------------------------------------------

/**
 * Schedule a debounced scratch analysis refresh.
 *
 * Auto-increments the generation counter so any in-flight analysis will be
 * discarded when the new one starts.
 */
export function scheduleScratchAnalysis(
  refreshFn: (targetTab: string | null) => void,
  delayMs: number,
  targetTab: string | null = null,
): void {
  scratchGeneration = (scratchGeneration || 0) + 1
  if (scratchTimer != null) clearTimeout(scratchTimer)
  scratchTimer = setTimeout(() => {
    refreshFn(targetTab)
  }, delayMs)
}

/**
 * Refresh scratch analysis for one or both edit-workspace tabs.
 *
 * Owns the generation tracking, pending state, cache checking, engine
 * invocation, and write-back lifecycle. Results are written ONLY to
 * editWorkspace — never to state.analysis or the SGF tree.
 */
export async function refreshScratchAnalysis(
  deps: ScratchAnalysisDeps,
  targetTab: ScratchAnalysisTab | null = null,
): Promise<void> {
  let generation = scratchGeneration
  let ws = deps.getState().editWorkspace
  if (ws == null) return

  let syncer = deps.getSyncer()
  if (syncer == null || !deps.engineSupportsOwnership(syncer)) {
    deps.setState({
      editWorkspace: {
        ...ws,
        currentAnalysis: null,
        currentOwnership: null,
        referenceAnalysis: null,
        referenceOwnership: null,
        analysisPending: false,
      },
    })
    return
  }

  deps.setState({editWorkspace: {...ws, analysisPending: true}})

  let analyzeTab = async (
    snapshot: ScratchPosition | null,
    analysisKey: keyof EditWorkspaceAnalysisState,
    ownershipKey: keyof EditWorkspaceAnalysisState,
    tab: ScratchAnalysisTab,
  ): Promise<EngineAnalysis | null> => {
    if (snapshot == null) return null

    let cached = getCachedScratchOwnership(syncer.id, snapshot)
    if (cached != null) {
      return {ownership: cached} as EngineAnalysis
    }

    let ctx = createScratchAnalysisContext(snapshot, {
      tab,
      sourceTree: deps.getSourceTree(),
      syncerId: syncer.id,
    })
    if (ctx == null) return null

    let result = await deps.runBoardAnalysis({
      syncer,
      tree: ctx.tree as GameTreeLike,
      treePosition: ctx.treePosition,
      analyzePlayer: ctx.analyzePlayer,
      requestGroup: SCRATCH_ANALYSIS_REQUEST_GROUP,
      analysisSource: SCRATCH_ANALYSIS_REQUEST_GROUP,
      skipOwnershipCache: true,
      onAnalysisUpdate: (analysis: EngineAnalysis | null) => {
        if (scratchGeneration !== generation) return
        let current = deps.getState().editWorkspace
        if (current != null) {
          deps.setState({
            editWorkspace: {
              ...current,
              [analysisKey]: analysis,
              [ownershipKey]: analysis?.ownership ?? null,
            },
          })
        }
      },
    })

    if (result?.ownership != null) {
      cacheScratchOwnership(syncer.id, snapshot, result.ownership)
    }

    return result
  }

  let analyzeCurrent = targetTab == null || targetTab === 'current'
  let analyzeReference = targetTab == null || targetTab === 'reference'

  let wsSnapshot = deps.getState().editWorkspace!
  let currentSnapshot = wsSnapshot.currentSnapshot
  let referenceSnapshot = wsSnapshot.referenceSnapshot

  let currentAnalysis = analyzeCurrent
    ? await analyzeTab(currentSnapshot, 'currentAnalysis', 'currentOwnership', 'current')
    : wsSnapshot.currentAnalysis

  let referenceAnalysis = analyzeReference
    ? await analyzeTab(referenceSnapshot, 'referenceAnalysis', 'referenceOwnership', 'reference')
    : wsSnapshot.referenceAnalysis

  if (scratchGeneration !== generation) {
    let pendingWs = deps.getState().editWorkspace
    if (pendingWs != null) {
      deps.setState({editWorkspace: {...pendingWs, analysisPending: false}})
    }
    return
  }

  let finalWs = deps.getState().editWorkspace
  if (finalWs != null) {
    deps.setState({
      editWorkspace: {
        ...finalWs,
        currentAnalysis: currentAnalysis ?? finalWs.currentAnalysis,
        currentOwnership: currentAnalysis?.ownership ?? finalWs.currentOwnership,
        referenceAnalysis: referenceAnalysis ?? finalWs.referenceAnalysis,
        referenceOwnership: referenceAnalysis?.ownership ?? finalWs.referenceOwnership,
        analysisPending: false,
      },
    })
    deps.logger?.log('info', 'engine', 'analysis.completed', 'Analysis completed', {
      targetTab,
    })
  }
}
