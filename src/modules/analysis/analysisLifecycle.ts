import * as gametree from '../gametree.js'
import * as dialog from '../dialog.js'
import type {
  EngineSyncerLike,
  EngineAnalysis,
  GameTree,
  OwnershipGrid,
} from './analysisTypes.ts'
import type {AnalysisCache} from './analysisCache.ts'

// ---------------------------------------------------------------------------
// Dependencies — all passed explicitly, no sabaki reference.
// ---------------------------------------------------------------------------

export type AnalysisLifecycleDeps = {
  // State reads
  getState: () => Record<string, any>
  getInferredState: () => {
    analyzingEngineSyncer: EngineSyncerLike | null
    gameTree: GameTree | null
  }

  // State writes
  setState: (patch: Record<string, any>) => void

  // Engine service (direct calls)
  engineService: {
    getAnalyzeCommand: (syncer: EngineSyncerLike) => string | null
    engineSupportsOwnership: (syncer: EngineSyncerLike) => boolean
    buildAnalyzeArgs: (
      syncer: EngineSyncerLike,
      analyzePlayer: number,
      opts?: {
        analysisAreaVertices?: string[] | null
        gameBoard?: any,
      },
    ) => string[] | null
    syncEngine: (
      syncerId: string,
      treePosition: string,
      opts?: {tree?: GameTree},
    ) => Promise<boolean>
    prepareAnalysis: (syncer: EngineSyncerLike, commandName: string) => Promise<void>
    getAnalysisVisitLimit: (syncer: EngineSyncerLike | null) => number | null
    getAnalysisMaxTime: (syncer: EngineSyncerLike | null) => number | null
    getLastAnalyzingEngineSyncerId: () => string | null
    attachEngines: (engines: any[]) => EngineSyncerLike[]
    detachEngines: (syncerIds: string[]) => Promise<void>
    normalizeEngineConfig: (engine: any, index?: number) => any
    startAnalysis: (syncerId: string) => Promise<void>
  }

  // Cache operations
  cache: AnalysisCache

  // Self-references (break circular callbacks)
  analyzeMove: (treePosition: string) => Promise<void>
  scheduleEditWorkspaceAnalysis: (tab?: string | null) => void

  // UI
  showInfoOverlay: (text: string) => void
  hideInfoOverlay: () => void

  // Engine detection
  detectEngines: () => any[]

  // Engine readiness
  waitForEngineCommands: (
    syncer: EngineSyncerLike,
    opts?: {timeout?: number},
  ) => Promise<boolean>

  // Settings
  getSetting: (key: string) => any

  // Dialog
  showMessageBox: (message: string, type: string) => Promise<void>

  // Logger
  applogger: {
    log: (
      level: string,
      area: string,
      event: string,
      message: string,
      data?: any,
    ) => void
  }

  // i18n
  i18n: {t: (key: string, fallback: string) => string}
}

// ---------------------------------------------------------------------------
// Internal request ID counters
// ---------------------------------------------------------------------------

let analysisRequestId = 0
let auxAnalysisRequestId = 0
let scratchAnalysisRequestId = 0

function resetRequestIds() {
  analysisRequestId = 0
  auxAnalysisRequestId = 0
  scratchAnalysisRequestId = 0
}

function getCurrentRequestId(requestGroup: string): number {
  if (requestGroup === 'analysis') return analysisRequestId
  if (requestGroup === 'scratch-analysis') return scratchAnalysisRequestId
  return auxAnalysisRequestId
}

function incrementRequestId(requestGroup: string): number {
  if (requestGroup === 'analysis') return ++analysisRequestId
  if (requestGroup === 'scratch-analysis') return ++scratchAnalysisRequestId
  return ++auxAnalysisRequestId
}

// ---------------------------------------------------------------------------
// runBoardAnalysis — core analysis request lifecycle
// ---------------------------------------------------------------------------

export type RunBoardAnalysisOptions = {
  syncer: EngineSyncerLike
  tree: GameTree
  treePosition: string
  analyzePlayer: number
  pendingStateKey?: string | null
  requestGroup?: string
  analysisSource?: string
  skipOwnershipCache?: boolean
  showLoadingText?: string | null
  previewCacheMoves?: any[] | null
  onAnalysisUpdate?: ((analysis: EngineAnalysis) => void) | null
}

export async function runBoardAnalysis(
  deps: AnalysisLifecycleDeps,
  opts: RunBoardAnalysisOptions,
): Promise<EngineAnalysis | null> {
  let {
    syncer,
    tree,
    treePosition,
    analyzePlayer,
    pendingStateKey = null,
    requestGroup = 'aux',
    analysisSource = 'game-tree',
    skipOwnershipCache = false,
    showLoadingText = null,
    previewCacheMoves = null,
    onAnalysisUpdate = null,
  } = opts

  deps.applogger.log('info', 'engine', 'runBoardAnalysis', 'Board analysis requested', {
    syncerId: syncer?.id,
    suspended: syncer?.suspended,
    treePosition,
    analyzePlayer,
    requestGroup,
    analysisSource,
  })

  if (
    syncer == null ||
    syncer.suspended ||
    tree == null ||
    treePosition == null
  ) {
    deps.applogger.log('debug', 'engine', 'runBoardAnalysis.skip', 'Analysis skipped', {
      syncerNull: syncer == null,
      suspended: syncer?.suspended,
      treeNull: tree == null,
      treePositionNull: treePosition == null,
    })
    return null
  }

  let commandName = deps.engineService.getAnalyzeCommand(syncer)
  if (commandName == null) {
    deps.applogger.log('debug', 'engine', 'runBoardAnalysis.no_command', 'No analyze command available', {
      syncerId: syncer.id,
      commands: syncer.commands,
    })
    return null
  }

  let state = deps.getState()
  let analysisAreaVertices = state.analysisAreaVertices as string[] | null
  let args = deps.engineService.buildAnalyzeArgs(syncer, analyzePlayer, {
    analysisAreaVertices,
    gameBoard:
      analysisAreaVertices != null && analysisAreaVertices.length > 0
        ? gametree.getBoard(tree, treePosition)
        : null,
  })

  let requestId = incrementRequestId(requestGroup)
  let visitLimit = deps.engineService.getAnalysisVisitLimit(syncer)
  let maxTime = deps.engineService.getAnalysisMaxTime(syncer)
  let timeoutMs = maxTime != null ? Math.round(maxTime * 1000) : null
  let originTreePosition = state.treePosition as string

  if (pendingStateKey != null) {
    deps.setState({[pendingStateKey]: true})
  }
  if (showLoadingText != null) {
    deps.showInfoOverlay(showLoadingText)
  }

  try {
    let synced = await deps.engineService.syncEngine(syncer.id, treePosition, {tree})
    let currentId = getCurrentRequestId(requestGroup)
    if (!synced || requestId !== currentId) {
      deps.applogger.log('debug', 'engine', 'runBoardAnalysis.cancelled', 'Analysis cancelled after sync', {
        synced,
        staleRequestId: requestId !== currentId,
        requestId,
        currentId,
        requestGroup,
      })
      return null
    }

    await deps.engineService.prepareAnalysis(syncer, commandName)

    let analysis = await new Promise<EngineAnalysis | null>((resolve) => {
      let settled = false
      let latestAnalysis: EngineAnalysis | null = null
      let timeoutId: ReturnType<typeof setTimeout> | null = null

      let finish = (value: EngineAnalysis | null) => {
        if (settled) return
        settled = true
        if (timeoutId != null) clearTimeout(timeoutId)
        syncer.removeListener('analysis-update', handleUpdate)
        syncer.sendAbort()
        resolve(value)
      }

      let handleUpdate = () => {
        let currentId = getCurrentRequestId(requestGroup)

        if (requestId !== currentId) {
          finish(null)
          return
        }

        if (syncer.treePosition !== treePosition || syncer.analysis == null) {
          return
        }

        let bestVisits = Math.max(
          0,
          ...syncer.analysis.variations.map(
            (variation) => variation.visits || 0,
          ),
        )
        latestAnalysis = syncer.analysis
        onAnalysisUpdate?.(latestAnalysis!)

        if (visitLimit != null && bestVisits < visitLimit) {
          return
        }

        finish(latestAnalysis)
      }

      syncer.on('analysis-update', handleUpdate)
      if (timeoutMs != null) {
        timeoutId = setTimeout(() => finish(latestAnalysis), timeoutMs)
      }

      try {
        deps.applogger.log(
          'info',
          'engine',
          'analysis.start',
          'Engine analysis started',
          {
            commandName,
            args,
            enginePath: syncer.engine.path,
            visitLimit,
            maxTime,
            requestGroup,
            treePosition,
            analyzePlayer: analyzePlayer > 0 ? 'B' : 'W',
            analysisAreaVertices,
          },
        )
        deps.applogger.log('debug', 'engine', 'runBoardAnalysis.queue_command', 'Queuing analyze command', {
          commandName,
          args,
          treePosition,
          requestGroup,
        })
        syncer.queueCommand({name: commandName, args})
      } catch (err) {
        deps.applogger.log('warn', 'engine', 'runBoardAnalysis.queue_error', 'Failed to queue analyze command', {
          error: (err as Error)?.message,
          treePosition,
        })
        finish(null)
      }
    })

    if (analysis?.ownership != null && !skipOwnershipCache) {
      if (previewCacheMoves != null) {
        deps.cache.cachePreviewOwnership(
          syncer.id,
          tree,
          treePosition,
          previewCacheMoves,
          analysis.ownership,
        )
      } else {
        deps.cache.cacheOwnership(syncer.id, tree, treePosition, analysis.ownership)
      }
    }

    return analysis
  } finally {
    let currentState = deps.getState()
    if (
      currentState.analyzingEngineSyncerId === syncer.id &&
      currentState.treePosition === originTreePosition &&
      requestGroup !== 'analysis' &&
      requestGroup !== 'scratch-analysis' &&
      !(currentState.mode === 'analysis' && currentState.editWorkspace != null)
    ) {
      deps.analyzeMove(originTreePosition)
    }

    if (pendingStateKey != null) {
      deps.setState({[pendingStateKey]: false})
    }
    if (showLoadingText != null) {
      deps.hideInfoOverlay()
    }
  }
}

// ---------------------------------------------------------------------------
// runOwnershipAnalysis — ownership analysis with caching
// ---------------------------------------------------------------------------

export type RunOwnershipAnalysisOptions = {
  syncer: EngineSyncerLike
  tree: GameTree
  treePosition: string
  analyzePlayer: number
  pendingStateKey?: string | null
  requestGroup?: string
  showLoadingText?: string | null
  previewCacheMoves?: any[] | null
  onOwnershipUpdate?: ((ownership: OwnershipGrid | null) => void) | null
}

export async function runOwnershipAnalysis(
  deps: AnalysisLifecycleDeps,
  opts: RunOwnershipAnalysisOptions,
): Promise<OwnershipGrid | null> {
  let {
    syncer,
    tree,
    treePosition,
    analyzePlayer,
    pendingStateKey = null,
    requestGroup = 'aux',
    showLoadingText = null,
    previewCacheMoves = null,
    onOwnershipUpdate = null,
  } = opts

  if (
    syncer == null ||
    syncer.suspended ||
    tree == null ||
    treePosition == null
  ) {
    return null
  }

  let cachedOwnership =
    previewCacheMoves != null
      ? deps.cache.getCachedPreviewOwnership(
          syncer.id,
          tree,
          treePosition,
          previewCacheMoves,
        )
      : deps.cache.getCachedOwnership(syncer.id, tree, treePosition)
  if (cachedOwnership != null) {
    onOwnershipUpdate?.(cachedOwnership)
    return cachedOwnership
  }

  let analysis = await runBoardAnalysis(deps, {
    syncer,
    tree,
    treePosition,
    analyzePlayer,
    pendingStateKey,
    requestGroup,
    showLoadingText,
    previewCacheMoves,
    onAnalysisUpdate: (nextAnalysis) => {
      onOwnershipUpdate?.(nextAnalysis?.ownership ?? null)
    },
  })

  return analysis?.ownership ?? null
}

// ---------------------------------------------------------------------------
// getAnalysisSyncerId — find suitable syncer for analysis
// ---------------------------------------------------------------------------

export function getAnalysisSyncerId(
  deps: AnalysisLifecycleDeps,
  opts: {requireOwnership?: boolean} = {},
): string | null {
  let {requireOwnership = false} = opts
  let state = deps.getState()
  let attachedSyncers = state.attachedEngineSyncers as EngineSyncerLike[]

  let candidates = attachedSyncers.filter((syncer) => {
    if (deps.engineService.getAnalyzeCommand(syncer) == null) return false
    if (!requireOwnership) return true
    return deps.engineService.engineSupportsOwnership(syncer)
  })

  if (candidates.length === 0) return null

  let preferredSyncer = candidates.find(
    (syncer) => syncer.id === deps.engineService.getLastAnalyzingEngineSyncerId(),
  )

  return (preferredSyncer || candidates[0]).id
}

// ---------------------------------------------------------------------------
// attachDefaultAnalysisEngine — attach first suitable engine
// ---------------------------------------------------------------------------

export async function attachDefaultAnalysisEngine(
  deps: AnalysisLifecycleDeps,
  opts: {requireOwnership?: boolean} = {},
): Promise<EngineSyncerLike | null> {
  let {requireOwnership = false} = opts
  let engines = (deps.getSetting('engines.list') as any[])
    .filter(
      (engine) => engine != null && engine.path != null && engine.path !== '',
    )

  // Auto-detect engines if none configured (transient — not persisted)
  if (engines.length === 0) {
    let detected = deps.detectEngines()
    console.log('[attach.detect]', {
      detectedCount: detected.length,
      detectedPaths: detected.map((e: any) => e.path),
    })
    if (detected.length > 0) {
      engines = detected
    }
  } else {
    console.log('[attach.configured]', {
      engineCount: engines.length,
      enginePaths: engines.map((e: any) => e.path),
    })
  }

  for (let i = 0; i < engines.length; i++) {
    let engine = deps.engineService.normalizeEngineConfig(engines[i], i)
    let [syncer] = deps.engineService.attachEngines([engine])
    if (syncer == null) continue

    let ready = await deps.waitForEngineCommands(syncer)

    if (
      ready &&
      deps.engineService.getAnalyzeCommand(syncer) != null &&
      (!requireOwnership || deps.engineService.engineSupportsOwnership(syncer))
    ) {
      deps.applogger.log(
        'info',
        'engine',
        'attach.success',
        'Engine attached successfully',
        {
          enginePath: engine.path,
          requireOwnership,
          commands: syncer.commands,
          analyzeCommand: deps.engineService.getAnalyzeCommand(syncer),
        },
      )
      return syncer
    }

    await deps.engineService.detachEngines([syncer.id])
  }

  deps.applogger.log(
    'warn',
    'engine',
    'attach.failed',
    'Failed to attach engine',
    {
      requireOwnership,
      enginesCount: engines.length,
    },
  )
  return null
}

// ---------------------------------------------------------------------------
// ensureAnalysisReady — ensure engine is attached and ready for analysis
// ---------------------------------------------------------------------------

export async function ensureAnalysisReady(
  deps: AnalysisLifecycleDeps,
  opts: {requireOwnership?: boolean} = {},
): Promise<EngineSyncerLike | null> {
  let {requireOwnership = false} = opts
  let syncer = deps.getInferredState().analyzingEngineSyncer

  console.log('[ensure.ready.start]', {
    hasSyncer: syncer != null,
    requireOwnership,
    syncerId: syncer?.id,
    syncerSuspended: syncer?._suspended,
    syncerCommands: syncer?.commands?.length,
  })

  if (
    syncer != null &&
    (!requireOwnership || deps.engineService.engineSupportsOwnership(syncer))
  ) {
    console.log('[ensure.ready.reuse]', {syncerId: syncer.id})
    return syncer
  }

  let syncerId = getAnalysisSyncerId(deps, {requireOwnership})

  if (syncerId == null) {
    console.log('[ensure.ready.attach]', {requireOwnership})
    syncer = await attachDefaultAnalysisEngine(deps, {requireOwnership})
    syncerId = syncer?.id ?? null
  }

  if (syncerId == null) {
    await deps.showMessageBox(
      deps.i18n.t(
        'sabaki.engine',
        requireOwnership
          ? 'Please configure or attach an analysis engine that provides ownership data first.'
          : 'Please configure or attach an analysis engine first.',
      ),
      'warning',
    )
    return null
  }

  deps.applogger.log(
    'info',
    'engine',
    'ensure.ready',
    'Engine ready for analysis',
    {
      syncerId,
      requireOwnership,
    },
  )
  await deps.engineService.startAnalysis(syncerId)
  let state = deps.getState()
  return (
    (state.attachedEngineSyncers as EngineSyncerLike[]).find((x) => x.id === syncerId) || null
  )
}

// ---------------------------------------------------------------------------
// refreshActiveBoardAnalysis — route to scratch or game-tree analysis
// ---------------------------------------------------------------------------

export function refreshActiveBoardAnalysis(deps: AnalysisLifecycleDeps): void {
  let state = deps.getState()
  if (state.mode === 'analysis' && state.editWorkspace != null) {
    deps.scheduleEditWorkspaceAnalysis()
  } else {
    deps.analyzeMove(state.treePosition as string)
  }
}

// ---------------------------------------------------------------------------
// Factory — resets internal state (for tests / re-creation)
// ---------------------------------------------------------------------------

export function createAnalysisLifecycle(deps: AnalysisLifecycleDeps) {
  resetRequestIds()

  return {
    runBoardAnalysis: (opts: RunBoardAnalysisOptions) =>
      runBoardAnalysis(deps, opts),
    runOwnershipAnalysis: (opts: RunOwnershipAnalysisOptions) =>
      runOwnershipAnalysis(deps, opts),
    getAnalysisSyncerId: (opts?: {requireOwnership?: boolean}) =>
      getAnalysisSyncerId(deps, opts ?? {}),
    attachDefaultAnalysisEngine: (opts?: {requireOwnership?: boolean}) =>
      attachDefaultAnalysisEngine(deps, opts ?? {}),
    ensureAnalysisReady: (opts?: {requireOwnership?: boolean}) =>
      ensureAnalysisReady(deps, opts ?? {}),
    refreshActiveBoardAnalysis: () => refreshActiveBoardAnalysis(deps),
  }
}
