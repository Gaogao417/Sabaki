import type {
  TrainingAttempt,
  TrainingAttemptResult,
  TrainingAttemptStatus,
  MoveEvaluation,
  BadMove,
} from '../types/index'
import type { TrainingRepository } from '../repository/trainingRepository'
import type { TrainingRuntimeStore } from '../store/trainingRuntimeStore'

export type AttemptService = {
  createAttempt(input: {
    taskId: string
    tabId?: string
    rootPositionSgf: string
  }): Promise<TrainingAttempt>
  appendMove(attemptId: string, move: string): Promise<void>
  undoLastMove(attemptId: string): Promise<void>
  freezeAttempt(attemptId: string): Promise<TrainingAttempt>
  saveMoveEvaluation(evaluation: MoveEvaluation): Promise<void>
  saveBadMove(badMove: BadMove): Promise<void>
  finalizeAttemptResult(
    attemptId: string,
    result: TrainingAttemptResult,
  ): Promise<void>
}

export type AttemptServiceDeps = {
  repository: TrainingRepository
  runtimeStore: TrainingRuntimeStore
  logger?: {
    info(channel: string, message: string, data?: Record<string, unknown>): void
  }
}

export function createAttemptService(deps: AttemptServiceDeps): AttemptService {
  const { repository, runtimeStore, logger } = deps

  async function createAttempt(input: {
    taskId: string
    tabId?: string
    rootPositionSgf: string
  }): Promise<TrainingAttempt> {
    const now = new Date().toISOString()
    const id = `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const attempt: TrainingAttempt = {
      id,
      taskId: input.taskId,
      tabId: input.tabId,
      startedAt: now,
      rootPositionSgf: input.rootPositionSgf,
      userLine: [],
      status: 'playing',
      result: 'pending',
      hintLevelUsed: 0,
      recallCompleted: false,
      analysisOpened: false,
    }

    await repository.createAttempt(attempt)
    runtimeStore.setActiveAttempt(id)

    logger?.info('attempt.create', 'Attempt created', {
      attemptId: id,
      taskId: input.taskId,
    })

    return attempt
  }

  async function appendMove(attemptId: string, move: string): Promise<void> {
    const attempt = await repository.loadAttempt(attemptId)
    if (!attempt) {
      throw new Error(`attemptService.appendMove: attempt not found (id=${attemptId})`)
    }
    if (attempt.status !== 'playing') {
      throw new Error(
        `attemptService.appendMove: attempt not in playing state (status=${attempt.status})`,
      )
    }

    const updatedLine = [...attempt.userLine, move]
    await repository.updateAttempt(attemptId, { userLine: updatedLine })
  }

  async function undoLastMove(attemptId: string): Promise<void> {
    const attempt = await repository.loadAttempt(attemptId)
    if (!attempt) {
      throw new Error(`attemptService.undoLastMove: attempt not found (id=${attemptId})`)
    }
    if (attempt.status !== 'playing') {
      throw new Error(
        `attemptService.undoLastMove: attempt not in playing state (status=${attempt.status})`,
      )
    }
    if (attempt.userLine.length === 0) return

    const updatedLine = attempt.userLine.slice(0, -1)
    await repository.updateAttempt(attemptId, { userLine: updatedLine })
  }

  async function freezeAttempt(attemptId: string): Promise<TrainingAttempt> {
    const attempt = await repository.loadAttempt(attemptId)
    if (!attempt) {
      throw new Error(`attemptService.freezeAttempt: attempt not found (id=${attemptId})`)
    }

    const now = new Date().toISOString()
    const patch: Partial<TrainingAttempt> = {
      status: 'submitted',
      submittedAt: now,
    }

    await repository.updateAttempt(attemptId, patch)

    logger?.info('attempt.freeze', 'Attempt frozen', {
      attemptId,
      moveCount: attempt.userLine.length,
    })

    return { ...attempt, ...patch } as TrainingAttempt
  }

  async function saveMoveEvaluation(evaluation: MoveEvaluation): Promise<void> {
    await repository.createMoveEvaluation(evaluation)

    if (evaluation.status === 'pending') {
      runtimeStore.upsertPendingMoveEvaluation(evaluation)
    }
  }

  async function saveBadMove(badMove: BadMove): Promise<void> {
    await repository.createBadMove(badMove)

    logger?.info('attempt.badMove', 'BadMove created', {
      badMoveId: badMove.id,
      attemptId: badMove.attemptId,
      moveIndex: badMove.moveIndex,
      severity: badMove.severity,
    })
  }

  async function finalizeAttemptResult(
    attemptId: string,
    result: TrainingAttemptResult,
  ): Promise<void> {
    const now = new Date().toISOString()
    const status: TrainingAttemptStatus =
      result === 'abandoned' ? 'abandoned' : 'submitted'

    await repository.updateAttempt(attemptId, {
      result,
      status,
      completedAt: result === 'abandoned' ? now : undefined,
    })

    logger?.info('attempt.finalize', 'Attempt result finalized', {
      attemptId,
      result,
    })
  }

  return {
    createAttempt,
    appendMove,
    undoLastMove,
    freezeAttempt,
    saveMoveEvaluation,
    saveBadMove,
    finalizeAttemptResult,
  }
}
