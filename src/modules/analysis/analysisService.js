import {getBoardAnalysisContext} from './boardAnalysisContext.js'
import {
  scheduleScratchAnalysis,
  refreshScratchAnalysis,
  SCRATCH_ANALYSIS_SOURCE,
} from './scratchAnalysis.js'
import {
  analyzeGameTreePosition,
  scheduleGameTreeAnalysis,
} from './gameTreeAnalysis.js'

export {
  SCRATCH_ANALYSIS_SOURCE,
  getBoardAnalysisContext,
  scheduleScratchAnalysis,
  refreshScratchAnalysis,
  analyzeGameTreePosition,
  scheduleGameTreeAnalysis,
}

/**
 * Create an analysis service facade over a sabaki instance.
 *
 * Phase 10: unified facade exposing scratch and game-tree analysis
 * operations. Sabaki.js provides state, syncers, and the low-level
 * runBoardAnalysis — this service owns request orchestration and
 * write-back boundaries.
 *
 * @param {object} sabaki
 * @returns {object}
 */
export function createAnalysisService(sabaki) {
  // Scratch analysis state
  let editAnalysisTimer = {id: null}
  let editAnalysisGeneration = {value: 0}

  // Game-tree analysis state
  let continuousAnalysisTimer = {id: null}

  return {
    /**
     * Build the unified board analysis context for the current state.
     */
    getBoardAnalysisContext({state = sabaki.state, tab = null} = {}) {
      return getBoardAnalysisContext({
        state,
        inferredState: sabaki.getInferredState(state),
        tab,
        getEditWorkspaceTabKeys: sabaki.getEditWorkspaceTabKeys.bind(sabaki),
        getCurrentOwnership: () =>
          sabaki.getCurrentOwnership(
            sabaki.inferredState.analyzingEngineSyncer,
          ),
        getPlayer: sabaki.getPlayer.bind(sabaki),
      })
    },

    /**
     * Schedule a debounced scratch analysis refresh.
     */
    scheduleScratchAnalysis(tab = null) {
      scheduleScratchAnalysis(
        {
          refreshFn: (targetTab) =>
            sabaki.refreshEditWorkspaceAnalysis(targetTab),
          delayMs: 200,
          timerRef: editAnalysisTimer,
        },
        tab,
      )
    },

    /**
     * Immediately refresh scratch analysis for one or both tabs.
     */
    async refreshScratchAnalysis(tab = null) {
      return refreshScratchAnalysis(
        {
          getState: () => sabaki.state,
          setState: (patch) => sabaki.setState(patch),
          getSyncer: () => sabaki.inferredState.analyzingEngineSyncer,
          engineSupportsOwnership: (s) =>
            sabaki.engineSupportsOwnership(s),
          getCachedScratchOwnership: (syncerId, snapshot) =>
            sabaki.getCachedScratchOwnership(syncerId, snapshot),
          cacheScratchOwnership: (syncerId, snapshot, ownership) =>
            sabaki.cacheScratchOwnership(syncerId, snapshot, ownership),
          runBoardAnalysis: (opts) => sabaki.runBoardAnalysis(opts),
          getSourceTree: () => sabaki.inferredState.gameTree,
          generationRef: editAnalysisGeneration,
          logger: sabaki.applogger,
        },
        tab,
      )
    },

    /**
     * Run immediate analysis on a game-tree position.
     */
    async scheduleGameTreeAnalysis(treePosition) {
      scheduleGameTreeAnalysis(
        {
          getSyncer: () => sabaki.inferredState.analyzingEngineSyncer,
          getState: () => sabaki.state,
          analyzeFn: (tp) => sabaki.analyzeMove(tp),
          getDelay: () => sabaki.setting.get('game.navigation_analysis_delay'),
          timerRef: continuousAnalysisTimer,
        },
        treePosition,
      )
    },

    /**
     * Run immediate analysis on a game-tree position.
     */
    async analyzeGameTreePosition(treePosition) {
      return analyzeGameTreePosition(
        {
          getSyncer: () => sabaki.inferredState.analyzingEngineSyncer,
          getGameTree: () => sabaki.inferredState.gameTree,
          getPlayer: (tp) => sabaki.getPlayer(tp),
          runBoardAnalysis: (opts) => sabaki.runBoardAnalysis(opts),
        },
        treePosition,
      )
    },
  }
}
