/**
 * Legacy Training Flow Controller
 *
 * Bridges UI Container and training services during migration.
 * Owns side-effect orchestration: legacy state patch, mode switch,
 * navigation, sound, loadGameTrees.
 *
 * Layering: Container → Controller → (runtimeStore + sabaki facade)
 * Controller does NOT call recallService — it manages legacy runtimeView directly.
 * recallService integration is deferred to a later commit.
 */

import * as sgf from '@sabaki/sgf'
import * as helper from '../../helper.js'
import * as sound from '../../sound.js'
import {logger} from '../../logger/index.js'

type ExpectedMove = {
  sign: number
  vertex: string | null
}

type RecallAttempt = {
  moveNumber: number
  expectedMove: string
  userMove: string
  isCorrect: boolean
  hintLevelUsed: number
}

type RecallView = {
  recallSessionId: string
  taskId: string | null
  moveIndex: number
  expectedMoves: ExpectedMove[]
  userAttempts: RecallAttempt[]
  showHint: boolean
  completed: boolean
}

type DbLike = {
  getGame(id: string): Promise<{sgf: string} | null>
  saveRecallSession(session: Record<string, unknown>): Promise<Record<string, unknown>>
  saveRecallAttempts(attempts: Record<string, unknown>[]): Promise<void>
  [key: string]: unknown
}

type SabakiLike = {
  state: {
    gameTrees: unknown[]
    gameIndex: number
    gameCurrents: Record<string, unknown>[]
    treePosition: string
    recallSession: Record<string, unknown> | null
    [key: string]: unknown
  }
  setState(patch: Record<string, unknown>, callback?: (() => void) | null): void
  setMode(mode: string): void
  loadGameTrees(trees: unknown[], options?: Record<string, unknown>): Promise<void>
  setCurrentTreePosition(tree: unknown, position: string, options?: Record<string, unknown>): void
  [key: string]: unknown
}

export type TrainingFlowController = {
  startRecallSession(gameId: string, options?: Record<string, unknown>): Promise<void>
  handleRecallMove(vertex: number[]): void
  skipRecallMove(): void
  showRecallHint(): void
  endRecallSession(): Promise<void>
  submitProblemAttempt(): Promise<void>
  undoProblemMove(): void
  exitProblemMode(): void
  advanceReview(): void
}

// --- Internal helpers ---

/** Extract expected moves by walking the SGF tree's main line. */
function extractRecallExpectedMoves(tree: any): ExpectedMove[] {
  let moves: ExpectedMove[] = []
  let nodeId = tree.root.id

  while (true) {
    let node = tree.get(nodeId)
    if (!node) break
    let sign = 0
    let vertex: string | null = null
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

  return moves
}

/** Navigate game tree to next move along the main line. */
function recallNavigateNext(sabaki: SabakiLike) {
  let {gameTrees, gameIndex, gameCurrents, treePosition} = sabaki.state
  let tree = gameTrees[gameIndex as number]
  let currents = gameCurrents[gameIndex as number]
  let nextNode = tree.navigate(treePosition, 1, currents)
  if (nextNode) {
    sabaki.setCurrentTreePosition(tree, nextNode.id)
  }
}

// --- Factory ---

export function createLegacyTrainingFlowController(deps: {
  sabaki: SabakiLike
  db: DbLike
  getTrainingServices: () => Record<string, unknown>
}): TrainingFlowController {
  const {sabaki, db} = deps

  // Held in closure — written by startRecallSession, read by endRecallSession
  let currentSession: Record<string, unknown> | null = null

  // ⚠️ Do NOT call getTrainingServices() at create time.
  // All service access must be lazy (inside method bodies) to avoid
  // circular init between sabaki.getTrainingServices() and controller.

  function getRuntimeStore(): any {
    return (deps.getTrainingServices() as any).runtimeStore
  }

  // --- Recall methods ---

  async function startRecallSession(
    gameId: string,
    options: Record<string, unknown> = {},
  ): Promise<void> {
    const fileformats = await import('../../fileformats/index.js')
    const game = await db.getGame(gameId)
    if (!game) {
      logger.info('recall.start.skip', 'No game found for recall', {gameId})
      return
    }

    let trees = fileformats.sgf.parse(game.sgf)
    if (!trees || trees.length === 0) {
      logger.info('recall.start.skip', 'No SGF trees parsed for recall', {gameId})
      return
    }

    let tree = trees[0]
    let moves = extractRecallExpectedMoves(tree)

    let session: Record<string, unknown> = {
      gameId,
      mode: (options.mode as string) || 'full_game',
      startMove: (options.startMove as number) || 0,
    }
    session = await db.saveRecallSession(session)

    logger.info('recall.start', 'Recall session created', {
      gameId,
      sessionId: session.id,
      expectedMoveCount: moves.length,
      mode: (options.mode as string) || 'full_game',
    })

    const view: RecallView = {
      recallSessionId: session.id as string,
      taskId: null,
      moveIndex: 0,
      expectedMoves: moves,
      userAttempts: [],
      showHint: false,
      completed: false,
    }

    const runtimeStore = getRuntimeStore()
    runtimeStore.setRecallView(view)
    currentSession = session

    if (trees && trees.length > 0) {
      await sabaki.loadGameTrees(trees, {suppressAskForSave: true})
    }

    sabaki.setMode('recall')
  }

  function handleRecallMove(vertex: number[]): void {
    const runtimeStore = getRuntimeStore()
    let view: RecallView | null = runtimeStore.getState().recallView
    if (!view || view.completed) return

    let expected = view.expectedMoves[view.moveIndex]
    if (!expected) return

    let expectedCoord = sgf.parseVertex(expected.vertex)
    let isCorrect = helper.vertexEquals(vertex, expectedCoord)

    logger.info('recall.move', 'Recall attempt', {
      moveIndex: view.moveIndex,
      expectedMove: expected.vertex,
      userMove: sgf.stringifyVertex(vertex),
      isCorrect,
    })

    // Handle pass moves
    if (expected.vertex === null) {
      let attempt: RecallAttempt = {
        moveNumber: view.moveIndex,
        expectedMove: 'pass',
        userMove: 'pass',
        isCorrect: true,
        hintLevelUsed: 0,
      }
      let newAttempts = [...view.userAttempts, attempt]
      let newIndex = view.moveIndex + 1
      recallNavigateNext(sabaki)

      let completed = newIndex >= view.expectedMoves.length
      const updatedView: RecallView = {
        ...view,
        moveIndex: newIndex,
        userAttempts: newAttempts,
        showHint: false,
        completed,
      }
      runtimeStore.setRecallView(updatedView)
      return
    }

    let attempt: RecallAttempt = {
      moveNumber: view.moveIndex,
      expectedMove: expected.vertex,
      userMove: sgf.stringifyVertex(vertex),
      isCorrect,
      hintLevelUsed: view.showHint ? 1 : 0,
    }
    let newAttempts = [...view.userAttempts, attempt]

    if (isCorrect) {
      recallNavigateNext(sabaki)
      let newIndex = view.moveIndex + 1
      let completed = newIndex >= view.expectedMoves.length
      const updatedView: RecallView = {
        ...view,
        moveIndex: newIndex,
        userAttempts: newAttempts,
        showHint: false,
        completed,
      }
      runtimeStore.setRecallView(updatedView)
    } else {
      sound.playError()
      const updatedView: RecallView = {...view, userAttempts: newAttempts}
      runtimeStore.setRecallView(updatedView)
    }
  }

  function skipRecallMove(): void {
    const runtimeStore = getRuntimeStore()
    let view: RecallView | null = runtimeStore.getState().recallView
    if (!view) return

    let expected = view.expectedMoves[view.moveIndex]
    if (!expected) return

    let attempt: RecallAttempt = {
      moveNumber: view.moveIndex,
      expectedMove: expected.vertex || 'pass',
      userMove: 'skip',
      isCorrect: false,
      hintLevelUsed: 0,
    }
    let newAttempts = [...view.userAttempts, attempt]
    recallNavigateNext(sabaki)
    let newIndex = view.moveIndex + 1
    let completed = newIndex >= view.expectedMoves.length

    const updatedView: RecallView = {
      ...view,
      moveIndex: newIndex,
      userAttempts: newAttempts,
      showHint: false,
      completed,
    }
    runtimeStore.setRecallView(updatedView)
  }

  function showRecallHint(): void {
    const runtimeStore = getRuntimeStore()
    let view: RecallView | null = runtimeStore.getState().recallView
    if (!view) return

    const updatedView: RecallView = {...view, showHint: true}
    runtimeStore.setRecallView(updatedView)
  }

  async function endRecallSession(): Promise<void> {
    const runtimeStore = getRuntimeStore()
    let view: RecallView | null = runtimeStore.getState().recallView
    if (!view) return

    let session = currentSession
    currentSession = null
    if (session) {
      let completedSession = {
        ...session,
        completedAt: new Date().toISOString(),
      }
      await db.saveRecallSession(completedSession)

      let correctCount = view.userAttempts.filter((a) => a.isCorrect).length
      logger.info('recall.end', 'Recall session ended', {
        sessionId: session.id,
        totalMoves: view.expectedMoves.length,
        correctCount,
        wrongCount: view.userAttempts.length - correctCount,
      })

      if (view.userAttempts.length > 0) {
        await db.saveRecallAttempts(
          view.userAttempts.map((a) => ({
            ...a,
            sessionId: session.id,
          })),
        )
      }
    }

    runtimeStore.setRecallView(null)
    sabaki.setMode('analysis')
  }

  // --- Problem / Review — LEGACY-FREEZE: delegates to sabaki facade until problemService/reviewService migration ---

  async function submitProblemAttempt(): Promise<void> {
    return (sabaki as any).submitProblemAttempt()
  }

  function undoProblemMove(): void {
    return (sabaki as any).undoProblemMove()
  }

  function exitProblemMode(): void {
    return (sabaki as any).exitProblemMode()
  }

  function advanceReview(): void {
    return (sabaki as any).advanceReview()
  }

  return {
    startRecallSession,
    handleRecallMove,
    skipRecallMove,
    showRecallHint,
    endRecallSession,
    submitProblemAttempt,
    undoProblemMove,
    exitProblemMode,
    advanceReview,
  }
}
