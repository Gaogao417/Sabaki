/**
 * Create an engine service facade over a sabaki instance.
 *
 * Phase 8: minimal adapter. Delegates engine move generation and engine
 * game control to the sabaki instance. Full ownership is Phase 10/12.
 *
 * @param {object} sabaki
 * @returns {{generateReply: function, stopEngineGame: function}}
 */
export function createEngineService(sabaki) {
  return {
    /**
     * Generate an engine reply after a human move.
     *
     * @param {string} treePosition - the new tree position after the human move
     * @param {number} currentPlayer - sign of the player who just moved (1 or -1)
     */
    generateReply(treePosition, currentPlayer) {
      let syncerId =
        currentPlayer > 0
          ? sabaki.state.whiteEngineSyncerId
          : sabaki.state.blackEngineSyncerId

      if (syncerId == null) return

      sabaki.generateMove(syncerId, treePosition)
    },

    /**
     * Stop an ongoing engine game.
     */
    stopEngineGame() {
      sabaki.stopEngineGame()
    },
  }
}
