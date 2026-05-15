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
import * as gametree from '../../gametree.js'
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

export type EngineGameTrainingState = {
  taskId: string
  attemptId: string
  humanMoveIndex: number
}

export type TrainingFlowController = {
  startRecallSession(gameId: string, options?: Record<string, unknown>): Promise<void>
  handleRecallMove(vertex: number[]): void
  skipRecallMove(): void
  showRecallHint(): void
  endRecallSession(): Promise<void>
  checkRecallComplete(): void
  handleProblemMove(vertex: number[]): Promise<void>
  submitProblemAttempt(): Promise<void>
  undoProblemMove(): void
  exitProblemMode(): void
  startReviewSession(): Promise<void>
  advanceReview(): Promise<void>
  startEngineGameTraining(): Promise<void>
  stopEngineGameTraining(): Promise<void>
  getEngineGameTraining(): EngineGameTrainingState | null
  notifyEngineGamePlayMove(positionBefore: string, positionAfter: string, move: string): void
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
  getTrainingContext: () => Record<string, unknown>
}): TrainingFlowController {
  const {sabaki, db} = deps

  // Held in closure — written by startRecallSession, read by endRecallSession
  let currentSession: Record<string, unknown> | null = null

  // Held in closure — engine game training state
  let engineGameTraining: EngineGameTrainingState | null = null

  // ⚠️ Do NOT call getTrainingContext() at create time.
  // All service access must be lazy (inside method bodies) to avoid
  // circular init between sabaki.getTrainingContext() and this controller.

  function getRuntimeStore(): any {
    return (deps.getTrainingContext() as any).runtimeStore
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

  // --- Problem orchestration ---

  async function handleProblemMove(vertex: number[]): Promise<void> {
    const services = deps.getTrainingContext() as any
    const {runtimeStore, problemFlowService} = services
    let pv = runtimeStore.getState().problemView
    if (!pv || !pv.legacyProblemSession || pv.submitted) return

    let {gameTrees, gameIndex, treePosition} = sabaki.state
    let positionBeforeHash = treePosition
    let tree = gameTrees[gameIndex] as any
    let board = gametree.getBoard(tree, treePosition)

    if (board.get(vertex) !== 0) return

    let player = (pv.legacyProblemSession as any).sideToMove === 'black' ? 1 : -1

    let preMoveAnalysis =
      (sabaki as any).getPlayServices().engineService.getAnalysisForPosition(treePosition)

    let newTree = tree.mutate((draft: any) => {
      draft.appendNode(treePosition, {
        [player > 0 ? 'B' : 'W']: [sgf.stringifyVertex(vertex)],
      })
    })

    let nextId = newTree.get(treePosition).children[0]?.id
    if (nextId) {
      sabaki.setCurrentTreePosition(newTree, nextId)
    }

    let moveStr = board.stringifyVertex(vertex)

    logger.info('problem.move', 'Problem move played', {
      vertex: moveStr,
      player: player > 0 ? 'B' : 'W',
      hasPreMoveAnalysis: !!preMoveAnalysis,
      evalCacheSize: pv?.evalCache?.length ?? 0,
    })

    let result
    try {
      result = await problemFlowService.appendProblemMove({
        move: moveStr,
        vertex,
        playerSign: player,
        positionBeforeHash,
        positionAfterHash: nextId,
        preMoveAnalysis,
      })
    } catch (err) {
      logger.info('problem.move.error', 'Problem move flow failed', {
        move: moveStr,
        positionBeforeHash,
        positionAfterHash: nextId,
        error: String(err),
      })
      return
    }
    if (!result) return

    runtimeStore.setProblemView({
      ...pv,
      evalCache: result.evalCache,
      badMoves: result.badMoves,
    })
  }

  async function submitProblemAttempt(): Promise<void> {
    const services = deps.getTrainingContext() as any
    const {problemFlowService} = services

    logger.info('problem.submit', 'Problem submit requested')
    const submitResult = await problemFlowService.submitActiveProblem()
    if (!submitResult) {
      logger.info('problem.submit.skip', 'Submit returned no result')
      return
    }

    logger.info('problem.submit.done', 'Problem submitted', {
      result: submitResult.result,
      attemptId: submitResult.attempt?.id,
    })

    const {runtimeStore} = services
    const currentPv = runtimeStore.getState().problemView
    if (currentPv) {
      runtimeStore.setProblemView({
        ...currentPv,
        submitted: true,
        result: submitResult.result,
      })
    }
  }

  function undoProblemMove(): void {
    const services = deps.getTrainingContext() as any
    const {problemFlowService} = services

    const result = problemFlowService.undoProblemMove()
    if (!result) return

    let {gameTrees, gameIndex, treePosition} = sabaki.state
    let tree = gameTrees[gameIndex] as any
    let node = tree.get(treePosition)
    if (node.parentId) {
      sabaki.setCurrentTreePosition(tree, node.parentId)
    }

    const {runtimeStore} = services
    const currentPv = runtimeStore.getState().problemView
    if (currentPv) {
      runtimeStore.setProblemView({
        ...currentPv,
        evalCache: result.evalCache,
        badMoves: result.badMoves,
      })
    }
  }

  function exitProblemMode(): void {
    const services = deps.getTrainingContext() as any
    const {runtimeStore} = services

    runtimeStore.setProblemView(null)

    sabaki.setMode('play')
  }

  // --- Review orchestration ---

  async function startReviewSession(): Promise<void> {
    const services = deps.getTrainingContext() as any
    const {runtimeStore, tabService} = services
    let dueItems = await (sabaki as any).db.getDueReviews()
    if (dueItems.length === 0) return

    let queue = dueItems.map((item: any) => item.item_id)

    runtimeStore.setReviewQueueView({
      queue,
      currentIndex: 0,
      totalDue: queue.length,
    })

    await tabService.openProblemTab(queue[0], {legacyCompatibility: true})
  }

  async function advanceReview(): Promise<void> {
    const services = deps.getTrainingContext() as any
    const {runtimeStore, tabService} = services
    let rv = runtimeStore.getState().reviewQueueView
    if (!rv) return
    let nextIndex = rv.currentIndex + 1

    if (nextIndex >= rv.queue.length) {
      runtimeStore.setReviewQueueView(null)
      exitProblemMode()
      return
    }

    runtimeStore.setReviewQueueView({...rv, currentIndex: nextIndex})

    await tabService.openProblemTab(rv.queue[nextIndex], {legacyCompatibility: true})
  }

  // --- Recall state check ---

  function checkRecallComplete(): void {
    const runtimeStore = getRuntimeStore()
    let view: RecallView | null = runtimeStore.getState().recallView
    if (view && view.moveIndex >= view.expectedMoves.length) {
      runtimeStore.setRecallView({...view, completed: true})
    }
  }

  // --- Engine game training ---

  async function startEngineGameTraining(): Promise<void> {
    const services = deps.getTrainingContext() as any
    const {attemptService, monitor, repository} = services

    let {gameTrees, gameIndex} = sabaki.state
    let tree = gameTrees[gameIndex]

    let task = {
      id: `task_game_${Date.now()}`,
      kind: 'game',
      source: {kind: 'game'},
      rootPositionSgf: sgf.stringify([tree]),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    let savedTask = await repository.createTask(task)

    let attempt = await attemptService.createAttempt({
      taskId: savedTask.id,
      rootPositionSgf: task.rootPositionSgf,
    })

    monitor.startForAttempt({attemptId: attempt.id, taskId: savedTask.id})

    engineGameTraining = {
      taskId: savedTask.id,
      attemptId: attempt.id,
      humanMoveIndex: 0,
    }

    logger.info('engineGame.training', 'Training started for engine game', {
      taskId: savedTask.id,
      attemptId: attempt.id,
    })
  }

  async function stopEngineGameTraining(): Promise<void> {
    let training = engineGameTraining
    if (!training) return

    const services = deps.getTrainingContext() as any
    const {attemptService, monitor} = services
    monitor.stopForAttempt(training.attemptId)

    try {
      await attemptService.freezeAttempt(training.attemptId)
      logger.info('engineGame.training.freeze', 'Training attempt frozen', {
        attemptId: training.attemptId,
        humanMoveCount: training.humanMoveIndex,
      })
    } catch (err) {
      logger.info('engineGame.training.freeze.error', 'Failed to freeze attempt', {
        error: String(err),
      })
    }

    engineGameTraining = null
  }

  function getEngineGameTraining(): EngineGameTrainingState | null {
    return engineGameTraining
  }

  function notifyEngineGamePlayMove(
    positionBefore: string,
    positionAfter: string,
    move: string,
  ): void {
    let training = engineGameTraining
    if (!training) return

    const services = deps.getTrainingContext() as any
    const {monitor} = services
    let moveIndex = training.humanMoveIndex++
    monitor.onUserMove({
      attemptId: training.attemptId,
      moveIndex,
      move,
      positionBeforeHash: positionBefore,
      positionAfterHash: positionAfter,
    }).catch((err: unknown) => {
      logger.info('engineGame.training.moveError', 'Error in onUserMove', {
        error: String(err),
        moveIndex,
      })
    })
  }

  return {
    startRecallSession,
    handleRecallMove,
    skipRecallMove,
    showRecallHint,
    endRecallSession,
    handleProblemMove,
    submitProblemAttempt,
    undoProblemMove,
    exitProblemMode,
    startReviewSession,
    advanceReview,
    checkRecallComplete,
    startEngineGameTraining,
    stopEngineGameTraining,
    getEngineGameTraining,
    notifyEngineGamePlayMove,
  }
}
