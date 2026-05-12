import {snapshotToGameTree} from '../study.js'
import {
  createGameTreePositionSource,
  createScratchPositionSource,
  getMutationContractFromState,
  MUTATION_CONTRACTS,
} from '../workbench/contracts/index.ts'

/**
 * Build a unified board analysis context from state.
 *
 * Replaces the large branch in sabaki.getBoardAnalysisContext() with a
 * standalone function that distinguishes three position sources:
 *   - scratch-analysis  (edit workspace snapshots)
 *   - game-tree-analysis  (real game tree navigation)
 *   - variation  (placeholder — reuses game-tree read-only path)
 *
 * @param {object} deps
 * @param {object} deps.state       Current app state
 * @param {object} deps.inferredState  Inferred state (gameTree, syncers, …)
 * @param {string|null} deps.tab    Active workspace tab override
 * @param {function} deps.getEditWorkspaceTabKeys
 * @param {function} deps.getCurrentOwnership
 * @param {function} deps.getPlayer
 * @returns {object|null} Analysis context or null
 */
export function getBoardAnalysisContext({
  state,
  inferredState,
  tab = null,
  getEditWorkspaceTabKeys,
  getCurrentOwnership,
  getPlayer,
}) {
  // Scratch-analysis context
  if (state.mode === 'analysis' && state.editWorkspace != null) {
    let activeTab = tab ?? state.editWorkspace.activeTab
    let {snapshotKey, analysisKey, ownershipKey} =
      getEditWorkspaceTabKeys(activeTab)
    let snapshot = state.editWorkspace[snapshotKey]
    if (snapshot == null) return null

    let context = snapshotToGameTree(
      snapshot,
      [],
      inferredState.gameTree,
    )
    if (context == null) return null

    let {tree, treePosition} = context
    return {
      source: 'scratch-analysis',
      tab: activeTab,
      positionSource: createScratchPositionSource(
        snapshot.id,
        snapshot.role ?? activeTab,
      ),
      mutationContract: MUTATION_CONTRACTS.SCRATCH_EDIT,
      tree,
      treePosition,
      analyzePlayer: snapshot.nextPlayer,
      analysis: state.editWorkspace[analysisKey],
      ownership: state.editWorkspace[ownershipKey],
    }
  }

  // Game-tree / variation / legacy context
  return {
    source: 'play',
    tab: null,
    positionSource: createGameTreePositionSource(state.treePosition),
    mutationContract: getMutationContractFromState(state),
    tree: inferredState.gameTree,
    treePosition: state.treePosition,
    analyzePlayer: getPlayer(state.treePosition),
    analysis:
      state.analysisTreePosition === state.treePosition
        ? state.analysis
        : null,
    ownership: getCurrentOwnership(),
  }
}
