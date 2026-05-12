import type {
  ScratchPosition,
  TreePosition,
} from '../workbench/contracts/positionSource.ts'
import {
  createGameTreePositionSource,
  createScratchPositionSource,
  getMutationContractFromState,
  getWorkspaceKindFromState,
  WORKSPACE_KINDS,
} from '../workbench/contracts/index.ts'
import type {
  AnalysisContext,
  AnalysisTarget,
  EngineAnalysis,
  EngineSyncerLike,
  GameTree,
  OwnershipGrid,
  RunBoardAnalysis,
  ScratchAnalysisTab,
} from './analysisTypes.ts'
import type {ScratchAnalysisDeps} from './scratchAnalysis.ts'
import {getBoardAnalysisContext} from './boardAnalysisContext.ts'
import {
  scheduleScratchAnalysis,
  refreshScratchAnalysis,
  getCachedScratchOwnership,
  cacheScratchOwnership as cacheScratchOwnershipInternal,
} from './scratchAnalysis.ts'
import {
  analyzeGameTreePosition,
  scheduleGameTreeAnalysis,
} from './gameTreeAnalysis.ts'
import {
  createAnalysisCache,
  getCurrentOwnership as getCurrentOwnershipFromCache,
  getOwnershipForTreePosition as getOwnershipForTreePositionFromCache,
} from './analysisCache.ts'
import {
  createAnalysisLifecycle,
  type AnalysisLifecycleDeps,
  type RunBoardAnalysisOptions,
  type RunOwnershipAnalysisOptions,
} from './analysisLifecycle.ts'

// ---------------------------------------------------------------------------
// Sabaki adapter boundary — `unknown` is allowed HERE ONLY.
// ---------------------------------------------------------------------------

type SabakiLike = {
  state: Record<string, unknown>
  inferredState: Record<string, unknown>
  setState: (patch: Record<string, unknown>) => void
  getPlayer: (tp: string) => number
  getEditWorkspaceTabKeys: (tab: string) => {
    snapshotKey: string
    analysisKey: string
    ownershipKey: string
  }
  engineSupportsOwnership: (syncer: unknown) => boolean
  refreshEditWorkspaceAnalysis?: (targetTab: string | null) => Promise<unknown>
  analyzeMove?: (treePosition: string) => Promise<unknown>
  applogger?: {log: (...args: unknown[]) => void}
  setting?: {get: (key: string) => unknown}
}

// Phase 12C: additional deps for analysis ownership.
export type AnalysisServiceDeps = {
  engineService?: any
  showInfoOverlay?: (text: string) => void
  hideInfoOverlay?: () => void
  detectEngines?: () => any[]
  waitForEngineCommands?: (syncer: any, opts?: {timeout?: number}) => Promise<boolean>
  showMessageBox?: (message: string, type: string) => Promise<void>
  applogger?: any
  getSetting?: (key: string) => any
  scheduleEditWorkspaceAnalysis?: (tab?: string | null) => void
  i18n?: {t: (key: string, fallback: string) => string}
}

// ---------------------------------------------------------------------------
// Narrowing helpers — convert sabaki unknowns to domain types at the boundary.
// ---------------------------------------------------------------------------

function narrowSyncer(raw: unknown): EngineSyncerLike | null {
  if (raw == null || typeof raw !== 'object') return null
  let obj = raw as Record<string, unknown>
  if (typeof obj.id !== 'string') return null
  return raw as EngineSyncerLike
}

function narrowGameTree(raw: unknown): GameTree | null {
  if (raw == null || typeof raw !== 'object') return null
  return raw as GameTree
}

function narrowAnalysis(raw: unknown): EngineAnalysis | null {
  if (raw == null) return null
  return raw as EngineAnalysis
}

function narrowOwnership(raw: unknown): OwnershipGrid | null {
  if (raw == null) return null
  return raw as OwnershipGrid
}

function narrowRunBoardAnalysis(
  fn: (opts: Record<string, unknown>) => Promise<unknown>,
): RunBoardAnalysis {
  return async (opts) => {
    let result = await fn(opts as Record<string, unknown>)
    return narrowAnalysis(result)
  }
}

// ---------------------------------------------------------------------------
// Analysis target builder (compat layer — reads state.mode)
// ---------------------------------------------------------------------------

function buildAnalysisTargetFromState(
  state: Record<string, unknown>,
  tab: string | null,
  getEditWorkspaceTabKeys: (tab: string) => {
    snapshotKey: string
    analysisKey: string
    ownershipKey: string
  },
): AnalysisTarget | null {
  let workspaceKind = getWorkspaceKindFromState(
    state as Parameters<typeof getWorkspaceKindFromState>[0],
  )

  if (
    workspaceKind === WORKSPACE_KINDS.SCRATCH_ANALYSIS &&
    state.editWorkspace != null
  ) {
    let ws = state.editWorkspace as Record<string, unknown>
    let activeTab = tab ?? (ws.activeTab as string) ?? 'current'
    let {snapshotKey} = getEditWorkspaceTabKeys(activeTab)
    let snapshot = ws[snapshotKey] as ScratchPosition | null
    if (snapshot == null) return null

    return {
      kind: 'scratch',
      tab: activeTab as ScratchAnalysisTab,
      snapshot,
      positionSource: createScratchPositionSource(
        snapshot.id,
        snapshot.role ?? (activeTab as ScratchAnalysisTab),
      ),
    }
  }

  let treePosition = state.treePosition as TreePosition | undefined
  if (treePosition == null) return null

  return {
    kind: 'game-tree',
    treePosition,
    positionSource: createGameTreePositionSource(treePosition),
  }
}

// ---------------------------------------------------------------------------
// Analysis service facade
// ---------------------------------------------------------------------------

export function createAnalysisService(sabaki: SabakiLike, serviceDeps: AnalysisServiceDeps = {}) {
  let cache = createAnalysisCache()

  // Lazy engine service resolver — breaks circular creation ordering.
  // engineService is set after both services are created in getPlayServices().
  let _engineService: any = serviceDeps.engineService ?? null
  function resolveEngineService(): any {
    if (_engineService != null) return _engineService
    return _engineService
  }

  function setEngineService(es: any) {
    _engineService = es
  }

  // Forward declaration — assigned after the return object is built.
  // The closure captures `facade` by reference, so it resolves correctly
  // at call time even though it's null during construction.
  let facade: any = null

  // Build lifecycle deps lazily — engineService may not be available yet at
  // construction time, but will be by the time any method is called.
  function getLifecycleDeps(): AnalysisLifecycleDeps {
    let es = resolveEngineService()
    return {
      getState: () => sabaki.state as Record<string, any>,
      getInferredState: () => ({
        analyzingEngineSyncer: narrowSyncer(sabaki.inferredState.analyzingEngineSyncer),
        gameTree: narrowGameTree(sabaki.inferredState.gameTree),
      }),
      setState: (patch) => sabaki.setState(patch),
      engineService: es,
      cache,
      analyzeMove: (tp) => facade.analyzeGameTreePosition(tp),
      scheduleEditWorkspaceAnalysis: (tab) => facade.scheduleScratchAnalysis(tab ?? null),
      showInfoOverlay: serviceDeps.showInfoOverlay ?? ((_text: string) => {}),
      hideInfoOverlay: serviceDeps.hideInfoOverlay ?? (() => {}),
      detectEngines: serviceDeps.detectEngines ?? (() => []),
      waitForEngineCommands: serviceDeps.waitForEngineCommands ?? (() => Promise.resolve(false)),
      getSetting: serviceDeps.getSetting ?? ((key) => (sabaki as any).setting?.get?.(key)),
      showMessageBox: serviceDeps.showMessageBox ?? (() => Promise.resolve()),
      applogger: serviceDeps.applogger ?? sabaki.applogger ?? {log: () => {}},
      i18n: serviceDeps.i18n ?? {t: (_key: string, fallback: string) => fallback},
    }
  }

  // The lifecycle instance — uses a Proxy so each property access resolves
  // lazily through getLifecycleDeps(). This handles late-bound engineService.
  let lifecycle = createAnalysisLifecycle(new Proxy({} as AnalysisLifecycleDeps, {
    get(_target, prop: string) {
      let deps = getLifecycleDeps()
      return (deps as any)[prop]
    },
  }))

  // Build a RunBoardAnalysis function that calls the internal lifecycle directly.
  // This replaces the old sabaki.runBoardAnalysis callback.
  function runBoardAnalysisInternal(opts: Record<string, unknown>): Promise<unknown> {
    return lifecycle.runBoardAnalysis(opts as any) as Promise<unknown>
  }

  let service = {
    // Engine service late-binding
    setEngineService,

    // Cache accessors (delegated to analysisCache)
    cacheOwnership: cache.cacheOwnership,
    getCachedOwnership: cache.getCachedOwnership,
    cachePreviewOwnership: cache.cachePreviewOwnership,
    getCachedPreviewOwnership: cache.getCachedPreviewOwnership,
    getCurrentOwnership(syncer: unknown): OwnershipGrid | null {
      return getCurrentOwnershipFromCache(
        narrowSyncer(syncer),
        sabaki.state as any,
        narrowGameTree(sabaki.inferredState.gameTree),
      )
    },
    getOwnershipForTreePosition(syncer: unknown, treePosition: string): OwnershipGrid | null {
      return getOwnershipForTreePositionFromCache(
        narrowSyncer(syncer),
        treePosition,
        sabaki.state as any,
        narrowGameTree(sabaki.inferredState.gameTree),
      )
    },

    // Lifecycle methods (Phase 12C)
    runBoardAnalysis(opts: RunBoardAnalysisOptions) {
      return lifecycle.runBoardAnalysis(opts)
    },
    runOwnershipAnalysis(opts: RunOwnershipAnalysisOptions) {
      return lifecycle.runOwnershipAnalysis(opts)
    },
    getAnalysisSyncerId(opts?: {requireOwnership?: boolean}) {
      return lifecycle.getAnalysisSyncerId(opts)
    },
    attachDefaultAnalysisEngine(opts?: {requireOwnership?: boolean}) {
      return lifecycle.attachDefaultAnalysisEngine(opts)
    },
    ensureAnalysisReady(opts?: {requireOwnership?: boolean}) {
      return lifecycle.ensureAnalysisReady(opts)
    },
    refreshActiveBoardAnalysis() {
      return lifecycle.refreshActiveBoardAnalysis()
    },

    // ── Existing methods (unchanged logic, but runBoardAnalysis now internal) ──

    buildAnalysisTarget(
      state?: Record<string, unknown>,
      tab?: string | null,
    ): AnalysisTarget | null {
      return buildAnalysisTargetFromState(
        state ?? sabaki.state,
        tab ?? null,
        sabaki.getEditWorkspaceTabKeys,
      )
    },

    getBoardAnalysisContext(
      opts: {state?: Record<string, unknown>; tab?: string | null} = {},
    ): AnalysisContext | null {
      let state = opts.state ?? sabaki.state
      let target = buildAnalysisTargetFromState(
        state,
        opts.tab ?? null,
        sabaki.getEditWorkspaceTabKeys,
      )
      if (target == null) return null

      let syncer = narrowSyncer(sabaki.inferredState.analyzingEngineSyncer)
      let gameTree = narrowGameTree(sabaki.inferredState.gameTree)

      return getBoardAnalysisContext(target, {
        sourceTree: gameTree,
        gameTree: gameTree ?? undefined,
        getPlayer: (tp) => sabaki.getPlayer(tp) as 1 | -1,
        analysis:
          state.analysisTreePosition === state.treePosition
            ? narrowAnalysis(state.analysis)
            : null,
        ownership: narrowOwnership(cache.getCurrentOwnership(
          syncer,
          state as any,
          gameTree,
        )),
        treePosition: state.treePosition as TreePosition | undefined,
        mutationContract: getMutationContractFromState(
          state as Parameters<typeof getMutationContractFromState>[0],
        ),
      })
    },

    scheduleScratchAnalysis(tab: string | null = null): void {
      scheduleScratchAnalysis(
        (targetTab) => sabaki.refreshEditWorkspaceAnalysis?.(targetTab),
        200,
        tab,
      )
    },

    async refreshScratchAnalysis(tab: string | null = null): Promise<void> {
      let syncer = narrowSyncer(sabaki.inferredState.analyzingEngineSyncer)
      let gameTree = narrowGameTree(sabaki.inferredState.gameTree)

      let deps: ScratchAnalysisDeps = {
        getState: () => sabaki.state as ScratchAnalysisDeps['getState'] extends () => infer R ? R : never,
        setState: (patch: Record<string, unknown>) => sabaki.setState(patch),
        getSyncer: () => syncer,
        engineSupportsOwnership: (s: EngineSyncerLike) => sabaki.engineSupportsOwnership(s),
        runBoardAnalysis: narrowRunBoardAnalysis(runBoardAnalysisInternal),
        getSourceTree: () => gameTree,
        logger: sabaki.applogger,
      }

      return refreshScratchAnalysis(deps, tab as ScratchAnalysisTab)
    },

    async analyzeGameTreePosition(treePosition: string): Promise<void> {
      let syncer = narrowSyncer(sabaki.inferredState.analyzingEngineSyncer)
      let gameTree = narrowGameTree(sabaki.inferredState.gameTree)

      if (syncer == null || gameTree == null) return

      return analyzeGameTreePosition(
        {
          getSyncer: () => syncer,
          getGameTree: () => gameTree,
          getPlayer: (tp) => sabaki.getPlayer(tp) as 1 | -1,
          runBoardAnalysis: narrowRunBoardAnalysis(runBoardAnalysisInternal),
        },
        treePosition,
      )
    },

    scheduleGameTreeAnalysis(treePosition: string): void {
      let syncer = narrowSyncer(sabaki.inferredState.analyzingEngineSyncer)

      scheduleGameTreeAnalysis(
        {
          getSyncer: () => syncer,
          getState: () => ({
            engineGameOngoing: sabaki.state.engineGameOngoing,
            blackEngineSyncerId: sabaki.state.blackEngineSyncerId as string | undefined,
            whiteEngineSyncerId: sabaki.state.whiteEngineSyncerId as string | undefined,
            analyzingEngineSyncerId: sabaki.state.analyzingEngineSyncerId as string | undefined,
            mode: sabaki.state.mode as string | undefined,
            editWorkspace: sabaki.state.editWorkspace,
          }),
          analyzeFn: (tp) => facade.analyzeGameTreePosition(tp),
          getDelay: () =>
            (sabaki.setting?.get?.('game.navigation_analysis_delay') ?? 300) as number,
        },
        treePosition,
      )
    },

    /** Alias used by playInteractionExecutor — delegates to scheduleGameTreeAnalysis. */
    scheduleLiveAnalysis(treePosition: string): void {
      this.scheduleGameTreeAnalysis(treePosition)
    },

    cacheScratchOwnership(
      syncerId: string,
      snapshot: ScratchPosition,
      ownership: unknown,
    ): void {
      cacheScratchOwnershipInternal(syncerId, snapshot, ownership as OwnershipGrid)
    },

    getCachedScratchOwnership(
      syncerId: string,
      snapshot: ScratchPosition,
    ): OwnershipGrid | null {
      return getCachedScratchOwnership(syncerId, snapshot)
    },
  }

  facade = service
  return service
}
