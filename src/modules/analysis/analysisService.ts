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

// ---------------------------------------------------------------------------
// Sabaki adapter boundary — `unknown` is allowed HERE ONLY.
// These types describe what sabaki.js actually passes us.
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
  getCurrentOwnership: (syncer: unknown) => unknown
  engineSupportsOwnership: (syncer: unknown) => boolean
  runBoardAnalysis: (opts: Record<string, unknown>) => Promise<unknown>
  refreshEditWorkspaceAnalysis?: (targetTab: string | null) => Promise<unknown>
  analyzeMove?: (treePosition: string) => Promise<unknown>
  applogger?: {log: (...args: unknown[]) => void}
  setting?: {get: (key: string) => unknown}
}

// ---------------------------------------------------------------------------
// Narrowing helpers — convert sabaki unknowns to domain types at the boundary.
// ---------------------------------------------------------------------------

function narrowSyncer(raw: unknown): EngineSyncerLike | null {
  if (raw == null || typeof raw !== 'object') return null
  let obj = raw as Record<string, unknown>
  if (typeof obj.id !== 'string') return null
  return {
    id: obj.id,
    suspended: obj.suspended == null ? undefined : !!obj.suspended,
  }
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

export function createAnalysisService(sabaki: SabakiLike) {
  return {
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
        ownership: narrowOwnership(sabaki.getCurrentOwnership(syncer)),
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
      let runFn = narrowRunBoardAnalysis(sabaki.runBoardAnalysis)

      let deps: ScratchAnalysisDeps = {
        getState: () => sabaki.state as ScratchAnalysisDeps['getState'] extends () => infer R ? R : never,
        setState: (patch: Record<string, unknown>) => sabaki.setState(patch),
        getSyncer: () => syncer,
        engineSupportsOwnership: (s: EngineSyncerLike) => sabaki.engineSupportsOwnership(s),
        runBoardAnalysis: runFn,
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
          runBoardAnalysis: narrowRunBoardAnalysis(sabaki.runBoardAnalysis),
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
          analyzeFn: (tp) => sabaki.analyzeMove?.(tp) ?? Promise.resolve(),
          getDelay: () =>
            (sabaki.setting?.get?.('game.navigation_analysis_delay') ?? 300) as number,
        },
        treePosition,
      )
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
}
