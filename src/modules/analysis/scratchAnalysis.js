import {getSnapshotSignature, snapshotToGameTree} from '../study.js'

export const SCRATCH_ANALYSIS_SOURCE = 'scratch-analysis'

/**
 * Create an analysis context from a scratch snapshot.
 *
 * Converts an edit-workspace snapshot into a temporary game tree suitable
 * for engine analysis. The tree is ephemeral — never written back to the
 * SGF game tree.
 *
 * @param {object|null} snapshot
 * @param {object} options
 * @param {string} options.tab        'current' | 'reference'
 * @param {object|null} options.sourceTree  Real game tree for komi/rules fallback
 * @param {string} options.syncerId
 * @returns {object|null} Context or null
 */
export function createScratchAnalysisContext(snapshot, {tab, sourceTree, syncerId}) {
  if (snapshot == null) return null

  let result = snapshotToGameTree(snapshot, [], sourceTree)
  if (result == null) return null

  let {tree, treePosition} = result
  return {
    source: SCRATCH_ANALYSIS_SOURCE,
    tab,
    tree,
    treePosition,
    analyzePlayer: snapshot.nextPlayer,
    syncerId,
  }
}

/**
 * Generate a cache key for scratch ownership data.
 *
 * Key is based on syncer ID + snapshot signature (JSON), ensuring it
 * never collides with game-tree ownership cache keys.
 *
 * @param {string|null} syncerId
 * @param {object|null} snapshot
 * @returns {string|null}
 */
export function getScratchAnalysisCacheKey(syncerId, snapshot) {
  if (syncerId == null || snapshot == null) return null
  let signature = getSnapshotSignature(snapshot)
  if (signature == null) return null
  return [syncerId, signature].join(':')
}

/**
 * Schedule a debounced scratch analysis refresh.
 *
 * @param {object} deps
 * @param {function} deps.refreshFn  The refresh function to call after delay
 * @param {number} deps.delayMs      Debounce delay in ms
 * @param {object} deps.timerRef     Object holding {id} for clearTimeout
 * @param {string|null} targetTab    'current' | 'reference' | null for both
 */
export function scheduleScratchAnalysis({refreshFn, delayMs, timerRef}, targetTab = null) {
  clearTimeout(timerRef.id)
  timerRef.id = setTimeout(() => {
    refreshFn(targetTab)
  }, delayMs)
}

/**
 * Refresh scratch analysis for one or both edit-workspace tabs.
 *
 * Owns the generation tracking, pending state, cache checking, engine
 * invocation, and write-back lifecycle. Results are written ONLY to
 * editWorkspace — never to state.analysis or the SGF tree.
 *
 * @param {object} deps
 * @param {function} deps.getState        () => state
 * @param {function} deps.setState        Patch setter
 * @param {function} deps.getSyncer       () => analyzing engine syncer
 * @param {function} deps.engineSupportsOwnership
 * @param {function} deps.getCachedScratchOwnership
 * @param {function} deps.cacheScratchOwnership
 * @param {function} deps.runBoardAnalysis
 * @param {function} deps.getEditWorkspaceTabKeys
 * @param {function} deps.getSourceTree   () => inferredState.gameTree
 * @param {object} deps.generationRef     {value} generation counter
 * @param {object} deps.logger
 * @param {string|null} targetTab         'current' | 'reference' | null
 */
export async function refreshScratchAnalysis(
  {
    getState,
    setState,
    getSyncer,
    engineSupportsOwnership,
    getCachedScratchOwnership,
    cacheScratchOwnership,
    runBoardAnalysis,
    getSourceTree,
    generationRef,
    logger,
  },
  targetTab = null,
) {
  let generation = (generationRef.value = (generationRef.value || 0) + 1)
  let ws = getState().editWorkspace
  if (ws == null) return

  let syncer = getSyncer()
  if (syncer == null || !engineSupportsOwnership(syncer)) {
    setState({
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

  setState({editWorkspace: {...ws, analysisPending: true}})

  let analyzeTab = async (snapshot, analysisKey, ownershipKey, tab) => {
    if (snapshot == null) return null

    let cached = getCachedScratchOwnership(syncer.id, snapshot)
    if (cached != null) {
      return {ownership: cached}
    }

    let ctx = createScratchAnalysisContext(snapshot, {
      tab,
      sourceTree: getSourceTree(),
      syncerId: syncer.id,
    })
    if (ctx == null) return null

    let result = await runBoardAnalysis({
      syncer,
      tree: ctx.tree,
      treePosition: ctx.treePosition,
      analyzePlayer: ctx.analyzePlayer,
      requestGroup: 'scratch-analysis',
      analysisSource: SCRATCH_ANALYSIS_SOURCE,
      skipOwnershipCache: true,
      onAnalysisUpdate: (analysis) => {
        if (generationRef.value !== generation) return
        let current = getState().editWorkspace
        if (current != null) {
          setState({
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

  let currentAnalysis = analyzeCurrent
    ? await analyzeTab(
        ws.currentSnapshot,
        'currentAnalysis',
        'currentOwnership',
        'current',
      )
    : ws.currentAnalysis

  let referenceAnalysis = analyzeReference
    ? await analyzeTab(
        ws.referenceSnapshot,
        'referenceAnalysis',
        'referenceOwnership',
        'reference',
      )
    : ws.referenceAnalysis

  if (generationRef.value !== generation) {
    let pendingWs = getState().editWorkspace
    if (pendingWs != null) {
      setState({editWorkspace: {...pendingWs, analysisPending: false}})
    }
    return
  }

  let finalWs = getState().editWorkspace
  if (finalWs != null) {
    setState({
      editWorkspace: {
        ...finalWs,
        currentAnalysis: currentAnalysis ?? finalWs.currentAnalysis,
        currentOwnership:
          currentAnalysis?.ownership ?? finalWs.currentOwnership,
        referenceAnalysis: referenceAnalysis ?? finalWs.referenceAnalysis,
        referenceOwnership:
          referenceAnalysis?.ownership ?? finalWs.referenceOwnership,
        analysisPending: false,
      },
    })
    logger?.log('info', 'engine', 'analysis.completed', 'Analysis completed', {
      targetTab,
    })
  }
}
