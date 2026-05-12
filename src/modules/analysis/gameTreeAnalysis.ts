import type {
  EngineSyncerLike,
  GameTree,
  PlayerSign,
  RunBoardAnalysis,
} from './analysisTypes.ts'

// Internal timer for debounced game-tree analysis
let gameTreeTimer: ReturnType<typeof setTimeout> | null = null

type GameTreeAnalysisDeps = {
  getSyncer: () => EngineSyncerLike | null
  getGameTree: () => GameTree
  getPlayer: (treePosition: string) => PlayerSign
  runBoardAnalysis: RunBoardAnalysis
}

type SchedulingState = {
  engineGameOngoing: unknown
  blackEngineSyncerId: string | undefined
  whiteEngineSyncerId: string | undefined
  analyzingEngineSyncerId: string | undefined
  mode: string | undefined
  editWorkspace: unknown
}

type SchedulingDeps = {
  getSyncer: () => EngineSyncerLike | null
  getState: () => SchedulingState
  analyzeFn: (treePosition: string) => Promise<unknown>
  getDelay: () => number
}

/**
 * Run immediate analysis on a game-tree position.
 */
export async function analyzeGameTreePosition(
  deps: GameTreeAnalysisDeps,
  treePosition: string,
): Promise<void> {
  let syncer = deps.getSyncer()
  if (syncer == null || syncer.suspended) return

  await deps.runBoardAnalysis({
    syncer,
    tree: deps.getGameTree(),
    treePosition,
    analyzePlayer: deps.getPlayer(treePosition),
    requestGroup: 'analysis',
  })
}

/**
 * Schedule delayed game-tree analysis with configurable timeout.
 *
 * Skips when in scratch-analysis mode or during engine games using the
 * analyzing engine.
 */
export function scheduleGameTreeAnalysis(
  deps: SchedulingDeps,
  treePosition: string,
): void {
  let syncer = deps.getSyncer()
  if (syncer == null || syncer.suspended) return

  let state = deps.getState()

  if (
    state.engineGameOngoing != null &&
    [state.blackEngineSyncerId, state.whiteEngineSyncerId].includes(
      state.analyzingEngineSyncerId,
    )
  ) {
    return
  }

  if (state.mode === 'analysis' && state.editWorkspace != null) return

  if (gameTreeTimer != null) clearTimeout(gameTreeTimer)

  gameTreeTimer = setTimeout(() => {
    deps.analyzeFn(treePosition)
  }, deps.getDelay())
}
