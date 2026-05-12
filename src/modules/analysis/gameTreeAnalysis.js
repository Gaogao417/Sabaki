/**
 * Game-tree analysis entry points.
 *
 * Wraps analyzeMove() and scheduleLiveAnalysis() as standalone functions
 * that operate on the real game tree. SBKV/SBKS write-back and ownership
 * caching continue to apply only to game-tree positions — never to
 * editWorkspace.
 */

/**
 * Run immediate analysis on a game-tree position.
 *
 * @param {object} deps
 * @param {function} deps.getSyncer       () => analyzing engine syncer
 * @param {function} deps.getGameTree     () => game tree
 * @param {function} deps.getPlayer       (treePosition) => sign
 * @param {function} deps.runBoardAnalysis
 * @param {string} treePosition
 */
export async function analyzeGameTreePosition(
  {getSyncer, getGameTree, getPlayer, runBoardAnalysis},
  treePosition,
) {
  let syncer = getSyncer()
  if (syncer == null || syncer.suspended) return

  await runBoardAnalysis({
    syncer,
    tree: getGameTree(),
    treePosition,
    analyzePlayer: getPlayer(treePosition),
    requestGroup: 'analysis',
  })
}

/**
 * Schedule delayed game-tree analysis with configurable timeout.
 *
 * Skips when in scratch-analysis mode or during engine games using the
 * analyzing engine.
 *
 * @param {object} deps
 * @param {function} deps.getSyncer
 * @param {function} deps.getState       () => state
 * @param {function} deps.analyzeFn      Immediate analysis function
 * @param {function} deps.getDelay       () => delay in ms
 * @param {object} deps.timerRef         Object holding {id} for clearTimeout
 * @param {string} treePosition
 */
export function scheduleGameTreeAnalysis(
  {getSyncer, getState, analyzeFn, getDelay, timerRef},
  treePosition,
) {
  let syncer = getSyncer()
  if (syncer == null || syncer.suspended) return

  let state = getState()

  if (
    state.engineGameOngoing != null &&
    [state.blackEngineSyncerId, state.whiteEngineSyncerId].includes(
      state.analyzingEngineSyncerId,
    )
  ) {
    return
  }

  if (state.mode === 'analysis' && state.editWorkspace != null) return

  clearTimeout(timerRef.id)

  timerRef.id = setTimeout(() => {
    analyzeFn(treePosition)
  }, getDelay())
}
