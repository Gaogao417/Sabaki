import type {
  RecallSession,
  RecallAttempt,
  TrainingAttempt,
} from '../types/index'
import type { TrainingRepository } from '../repository/trainingRepository'
import type { TrainingRuntimeStore } from '../store/trainingRuntimeStore'
import type { RecallCheckpointService } from './recallCheckpointService'

export type RecallService = {
  createRecallFromAttempt(attemptId: string): Promise<RecallSession>
  createRecallFromGame(input: {
    taskId: string
    gameId: string
    startMove?: number
    endMove?: number
  }): Promise<RecallSession>
  submitRecallMove(input: {
    recallSessionId: string
    userMove: string
  }): Promise<RecallAttempt>
  completeRecall(recallSessionId: string): Promise<void>
}

export type RecallServiceDeps = {
  repository: TrainingRepository
  runtimeStore: TrainingRuntimeStore
  checkpointService: RecallCheckpointService
  logger?: {
    info(channel: string, message: string, data?: Record<string, unknown>): void
  }
}

export function createRecallService(deps: RecallServiceDeps): RecallService {
  const { repository, runtimeStore, checkpointService, logger } = deps

  async function createRecallFromAttempt(attemptId: string): Promise<RecallSession> {
    const attempt = await repository.loadAttempt(attemptId)
    if (!attempt) {
      throw new Error(`recallService.createRecallFromAttempt: attempt not found (id=${attemptId})`)
    }

    const session = await _createSession({
      taskId: attempt.taskId,
      tabId: attempt.tabId,
      attemptId,
      source: { kind: 'attempt', attemptId },
      expectedMoves: attempt.userLine,
    })

    logger?.info('recall.create', 'RecallSession created from attempt', {
      sessionId: session.id,
      attemptId,
      moveCount: attempt.userLine.length,
    })

    return session
  }

  async function createRecallFromGame(input: {
    taskId: string
    gameId: string
    startMove?: number
    endMove?: number
  }): Promise<RecallSession> {
    const game = await repository.getGame(input.gameId)
    if (!game) {
      throw new Error(`recallService.createRecallFromGame: game not found (id=${input.gameId})`)
    }

    // Extract main line moves from game SGF
    const sgf = game.sgf || game.sgfStr || ''
    const moves = extractMovesFromSgf(sgf)
    const startMove = input.startMove ?? 0
    const endMove = input.endMove ?? moves.length
    const expectedMoves = moves.slice(startMove, endMove)

    const session = await _createSession({
      taskId: input.taskId,
      source: {
        kind: 'game',
        gameId: input.gameId,
        startMove,
        endMove,
      },
      expectedMoves,
      startMove,
      endMove,
    })

    logger?.info('recall.createGame', 'RecallSession created from game', {
      sessionId: session.id,
      gameId: input.gameId,
      moveCount: expectedMoves.length,
    })

    return session
  }

  async function submitRecallMove(input: {
    recallSessionId: string
    userMove: string
  }): Promise<RecallAttempt> {
    const session = await repository.loadRecallSession(input.recallSessionId)
    if (!session) {
      throw new Error(`recallService.submitRecallMove: session not found (id=${input.recallSessionId})`)
    }
    if (session.completed) {
      throw new Error(`recallService.submitRecallMove: session already completed (id=${input.recallSessionId})`)
    }

    // Block recall moves while a checkpoint is active for this session
    const runtimeState = runtimeStore.getState()
    if (runtimeState.activeCheckpointId) {
      const checkpoints = await repository.listCheckpointsByRecallSession(input.recallSessionId)
      const activeCp = checkpoints.find(cp => cp.id === runtimeState.activeCheckpointId && !cp.completedAt)
      if (activeCp) {
        throw new Error(`recallService.submitRecallMove: checkpoint active (checkpointId=${activeCp.id})`)
      }
    }

    const moveIndex = session.currentMoveIndex
    if (moveIndex >= session.expectedMoves.length) {
      throw new Error(`recallService.submitRecallMove: past end of expected moves (index=${moveIndex})`)
    }

    const expectedMove = session.expectedMoves[moveIndex]
    const isCorrect = input.userMove === expectedMove

    const now = new Date().toISOString()
    const id = `ra_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const recallAttempt: RecallAttempt = {
      id,
      recallSessionId: input.recallSessionId,
      moveNumber: moveIndex,
      expectedMove,
      userMove: input.userMove,
      isCorrect,
      hintLevelUsed: 0,
      createdAt: now,
    }

    await repository.createRecallAttempt(recallAttempt)

    // Only advance on correct moves; incorrect stays at same index for retry
    if (!isCorrect) {
      logger?.info('recall.move', 'Recall move incorrect, index not advanced', {
        sessionId: input.recallSessionId,
        moveIndex,
        expectedMove,
        userMove: input.userMove,
      })
      return recallAttempt
    }

    // Check if checkpoint should trigger for this move index
    const badMove = await checkpointService.shouldTriggerCheckpoint({
      recallSessionId: input.recallSessionId,
      moveIndex,
    })

    if (badMove) {
      await checkpointService.startCheckpoint({
        recallSessionId: input.recallSessionId,
        badMoveId: badMove.id,
      })
    } else {
      await repository.updateRecallSession(input.recallSessionId, {
        currentMoveIndex: moveIndex + 1,
      })
    }

    logger?.info('recall.move', 'Recall move submitted', {
      sessionId: input.recallSessionId,
      moveIndex,
      isCorrect,
      checkpointTriggered: !!badMove,
    })

    return recallAttempt
  }

  async function completeRecall(recallSessionId: string): Promise<void> {
    const session = await repository.loadRecallSession(recallSessionId)
    if (!session) {
      throw new Error(`recallService.completeRecall: session not found (id=${recallSessionId})`)
    }

    const now = new Date().toISOString()
    await repository.updateRecallSession(recallSessionId, {
      completed: true,
      completedAt: now,
    })

    runtimeStore.setActiveRecallSession(undefined)

    logger?.info('recall.complete', 'RecallSession completed', {
      sessionId: recallSessionId,
    })
  }

  async function _createSession(input: {
    taskId: string
    tabId?: string
    attemptId?: string
    source: Record<string, unknown>
    expectedMoves: string[]
    startMove?: number
    endMove?: number
  }): Promise<RecallSession> {
    const now = new Date().toISOString()
    const id = `rs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const session: RecallSession = {
      id,
      taskId: input.taskId,
      tabId: input.tabId,
      attemptId: input.attemptId,
      type: 'line_recall',
      source: input.source as RecallSession['source'],
      startMove: input.startMove ?? 0,
      endMove: input.endMove,
      expectedMoves: input.expectedMoves,
      currentMoveIndex: 0,
      completed: false,
      createdAt: now,
    }

    await repository.createRecallSession(session)
    runtimeStore.setActiveRecallSession(id)

    return session
  }

  return {
    createRecallFromAttempt,
    createRecallFromGame,
    submitRecallMove,
    completeRecall,
  }
}

function extractMovesFromSgf(sgf: string): string[] {
  const moves: string[] = []
  const moveRegex = /;(B|W)\[([a-s]{0,2})\]/gi
  let match
  while ((match = moveRegex.exec(sgf)) !== null) {
    const coord = match[2]
    if (coord && coord.length === 2) {
      moves.push(coord)
    }
  }
  return moves
}
