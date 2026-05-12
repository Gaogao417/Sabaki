/**
 * Training store: owns recall session / attempt / progress writes.
 *
 * Phase 9 migration facade — wraps sabaki.state for recall fields while
 * keeping existing visible behavior. Game-tree mutation is forbidden;
 * only setCurrentTreePosition navigation to existing nodes is allowed.
 */

import sgf from '@sabaki/sgf'
import * as helper from '../helper.js'

/**
 * @param {import('../sabaki.js')} sabaki
 * @param {{
 *   applogger?: typeof import('../applogger.js'),
 *   playErrorSound?: () => void,
 *   db?: { getGame: function, saveRecallSession: function, saveRecallAttempts: function },
 * }} [deps]
 */
export function createTrainingStore(sabaki, deps = {}) {
  let logger = deps.applogger ?? null
  let playErrorSound = deps.playErrorSound ?? (() => {})
  let db = deps.db ?? window?.sabaki?.db

  function getState() {
    return sabaki.state
  }

  function setState(patch) {
    sabaki.setState(patch)
  }

  /**
   * Start a recall session: parse SGF, save session to db, set state, load game tree.
   */
  async function startRecallSession(gameId, options = {}) {
    let fileformats = await import('../fileformats/index.js')
    let game = await db.getGame(gameId)
    if (!game) {
      logger?.log('warn', 'system', 'system.recall_game_not_found', 'Recall: game not found', {gameId})
      return
    }

    let trees = fileformats.sgf.parse(game.sgf)
    if (!trees || trees.length === 0) {
      logger?.log('warn', 'system', 'system.sgf_parse_failed', 'Recall: no trees from SGF parse', {gameId})
      return
    }
    let tree = trees[0]

    let moves = []
    let nodeId = tree.root.id
    if (nodeId == null) {
      logger?.log('error', 'system', 'system.sgf_parse_failed', 'tree.root.id is null', {gameId})
    }
    let innerTree = tree
    while (true) {
      let node = innerTree.get(nodeId)
      if (!node) break
      let sign = 0
      let vertex = null
      if (node.data.B && node.data.B[0] != null) {
        sign = 1
        vertex = node.data.B[0] === '' ? 'pass' : node.data.B[0]
      } else if (node.data.W && node.data.W[0] != null) {
        sign = -1
        vertex = node.data.W[0] === '' ? 'pass' : node.data.W[0]
      }
      if (vertex != null) {
        moves.push({sign, vertex: vertex === 'pass' ? null : vertex})
      }
      let children = node.children
      if (children.length === 0) break
      nodeId = children[0].id
    }

    let session = {
      gameId,
      mode: options.mode || 'full_game',
      startMove: options.startMove || 0,
    }
    session = await db.saveRecallSession(session)

    setState({
      recallSession: session,
      recallMoveIndex: 0,
      recallExpectedMoves: moves,
      recallUserAttempts: [],
      recallShowHint: false,
      recallCompleted: false,
    })

    if (trees && trees.length > 0) {
      await sabaki.loadGameTrees(trees, {suppressAskForSave: true})
    }

    sabaki.setMode('recall')
  }

  /**
   * Submit a recall answer for the current expected move.
   * Returns {handled, changed, isCorrect, completed, recallMoveIndex, reason, attempt}.
   */
  function submitRecallAnswer(vertex) {
    let {
      recallSession,
      recallMoveIndex,
      recallExpectedMoves,
      recallUserAttempts,
    } = getState()

    if (!recallSession || getState().recallCompleted) {
      return {handled: false, changed: false, reason: 'no active session or already completed'}
    }

    let expected = recallExpectedMoves[recallMoveIndex]
    if (!expected) {
      return {handled: false, changed: false, reason: 'no expected move at current index'}
    }

    // Handle pass moves
    if (expected.vertex === null) {
      let attempt = {
        moveNumber: recallMoveIndex,
        expectedMove: 'pass',
        userMove: 'pass',
        isCorrect: true,
        hintLevelUsed: 0,
      }
      recallUserAttempts.push(attempt)
      let newIndex = recallMoveIndex + 1
      navigateNext()

      setState({recallMoveIndex: newIndex, recallUserAttempts})
      let completed = checkComplete(newIndex)

      return {
        handled: true,
        changed: true,
        isCorrect: true,
        completed,
        recallMoveIndex: newIndex,
        attempt,
      }
    }

    let expectedCoord = sgf.parseVertex(expected.vertex)
    let isCorrect = helper.vertexEquals(vertex, expectedCoord)

    let attempt = {
      moveNumber: recallMoveIndex,
      expectedMove: expected.vertex,
      userMove: sgf.stringifyVertex(vertex),
      isCorrect,
      hintLevelUsed: getState().recallShowHint ? 1 : 0,
    }
    recallUserAttempts.push(attempt)

    if (isCorrect) {
      navigateNext()
      let newIndex = recallMoveIndex + 1
      setState({
        recallMoveIndex: newIndex,
        recallUserAttempts,
        recallShowHint: false,
      })
      let completed = checkComplete(newIndex)

      return {
        handled: true,
        changed: true,
        isCorrect: true,
        completed,
        recallMoveIndex: newIndex,
        attempt,
      }
    } else {
      playErrorSound()
      setState({recallUserAttempts})

      return {
        handled: true,
        changed: false,
        isCorrect: false,
        completed: false,
        recallMoveIndex,
        attempt,
      }
    }
  }

  function skipRecallMove() {
    let {recallMoveIndex, recallExpectedMoves, recallUserAttempts} = getState()
    let expected = recallExpectedMoves[recallMoveIndex]
    if (!expected) return

    recallUserAttempts.push({
      moveNumber: recallMoveIndex,
      expectedMove: expected.vertex || 'pass',
      userMove: 'skip',
      isCorrect: false,
      hintLevelUsed: 0,
    })

    navigateNext()
    let newIndex = recallMoveIndex + 1
    setState({
      recallMoveIndex: newIndex,
      recallUserAttempts,
      recallShowHint: false,
    })
    checkComplete(newIndex)
  }

  function showRecallHint() {
    setState({recallShowHint: true})
  }

  async function endRecallSession() {
    let {recallSession, recallUserAttempts} = getState()
    if (!recallSession) return

    let completedSession = {
      ...recallSession,
      completedAt: new Date().toISOString(),
    }
    await db.saveRecallSession(completedSession)

    if (recallUserAttempts.length > 0) {
      await db.saveRecallAttempts(
        recallUserAttempts.map((a) => ({
          ...a,
          sessionId: recallSession.id,
        })),
      )
    }

    sabaki.setMode('analysis')
  }

  // --- Internal helpers ---

  function navigateNext() {
    let {gameTrees, gameIndex, gameCurrents, treePosition} = getState()
    let tree = gameTrees[gameIndex]
    let currents = gameCurrents[gameIndex]
    let nextNode = tree.navigate(treePosition, 1, currents)
    if (nextNode) {
      sabaki.setCurrentTreePosition(tree, nextNode.id)
    }
  }

  function checkComplete(moveIndex) {
    let {recallExpectedMoves} = getState()
    let completed = moveIndex >= recallExpectedMoves.length
    if (completed) {
      setState({recallCompleted: true})
    }
    return completed
  }

  return {
    startRecallSession,
    submitRecallAnswer,
    skipRecallMove,
    showRecallHint,
    endRecallSession,
  }
}
