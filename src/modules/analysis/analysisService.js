/**
 * Create an analysis service facade over a sabaki instance.
 *
 * Phase 8: minimal adapter. Delegates live analysis scheduling to the
 * sabaki instance. Full ownership is Phase 10/12.
 *
 * @param {object} sabaki
 * @returns {{scheduleLiveAnalysis: function, analyzeMove: function}}
 */
export function createAnalysisService(sabaki) {
  return {
    /**
     * Schedule live analysis for the current game-tree position.
     *
     * @param {string} treePosition
     */
    scheduleLiveAnalysis(treePosition) {
      sabaki.scheduleLiveAnalysis(treePosition)
    },

    /**
     * Run analysis immediately on the current position.
     *
     * @param {string} treePosition
     */
    analyzeMove(treePosition) {
      sabaki.analyzeMove(treePosition)
    },
  }
}
