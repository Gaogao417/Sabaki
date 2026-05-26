import type {
  MoveEvaluation,
  BadMove,
  BadMoveSeverity,
  NormalizedAnalysisResult,
} from '../types/index'
import type { AttemptService } from './attemptService'
import type { AnalysisResultAdapter } from '../adapter/analysisResultAdapter'
import type { TrainingRepository } from '../repository/trainingRepository'
import type { TrainingRuntimeStore } from '../store/trainingRuntimeStore'
import {
  evaluateMove,
  classifySeverity,
  shouldCreateBadMove,
} from './evaluationRules'

export type PlayTrainingMonitor = {
  startForAttempt(input: { attemptId: string; taskId: string }): void
  stopForAttempt(attemptId: string): void
  onUserMove(input: {
    attemptId: string
    moveIndex: number
    move: string
    positionBeforeHash?: string
    positionAfterHash?: string
  }): Promise<void>
  onAnalysisUpdated(input: { positionKey: string }): Promise<void>
  failExpiredPendingEvaluations(now?: string): Promise<void>
}

const PENDING_TIMEOUT_MS = 30_000

export type PlayTrainingMonitorDeps = {
  attemptService: AttemptService
  analysisResultAdapter: AnalysisResultAdapter
  repository: TrainingRepository
  runtimeStore: TrainingRuntimeStore
  logger?: {
    info(channel: string, message: string, data?: Record<string, unknown>): void
  }
}

export function createPlayTrainingMonitor(
  deps: PlayTrainingMonitorDeps,
): PlayTrainingMonitor {
  const { attemptService, analysisResultAdapter, repository, runtimeStore, logger } =
    deps

  // Track which attempt is being monitored
  let activeMonitor: { attemptId: string; taskId: string } | null = null
  let unsubscribeAnalysis: (() => void) | null = null

  function startForAttempt(input: { attemptId: string; taskId: string }): void {
    activeMonitor = { attemptId: input.attemptId, taskId: input.taskId }

    // Subscribe to analysis updates
    unsubscribeAnalysis = analysisResultAdapter.subscribeToAnalysisUpdates(
      (positionKey) => {
        onAnalysisUpdated({ positionKey }).catch((err) => {
          logger?.info('monitor.analysisUpdate.error', 'Error handling analysis update', {
            positionKey,
            error: String(err),
          })
        })
      },
    )

    logger?.info('monitor.start', 'Monitor started for attempt', {
      attemptId: input.attemptId,
    })
  }

  function stopForAttempt(attemptId: string): void {
    if (activeMonitor?.attemptId !== attemptId) return

    if (unsubscribeAnalysis) {
      unsubscribeAnalysis()
      unsubscribeAnalysis = null
    }
    activeMonitor = null

    logger?.info('monitor.stop', 'Monitor stopped for attempt', { attemptId })
  }

  async function onUserMove(input: {
    attemptId: string
    moveIndex: number
    move: string
    positionBeforeHash?: string
    positionAfterHash?: string
  }): Promise<void> {
    const { attemptId, moveIndex, move, positionBeforeHash, positionAfterHash } =
      input

    const now = new Date().toISOString()
    const id = `eval_${Date.now()}_${moveIndex}_${Math.random().toString(36).slice(2, 7)}`

    // Try to get before eval immediately (may be null for first move)
    const beforeEval = analysisResultAdapter.getAnalysisForPosition(
      positionBeforeHash ?? '',
    )

    const evaluation: MoveEvaluation = {
      id,
      attemptId,
      moveIndex,
      move,
      positionBeforeHash,
      positionAfterHash,
      beforeScoreLead: beforeEval?.scoreLead,
      beforeWinrate: beforeEval?.winrate,
      status: 'pending',
      createdAt: now,
    }

    await attemptService.saveMoveEvaluation(evaluation)

    logger?.info('monitor.userMove', 'Pending MoveEvaluation created', {
      evaluationId: id,
      attemptId,
      moveIndex,
    })
  }

  async function onAnalysisUpdated(input: { positionKey: string }): Promise<void> {
    if (!activeMonitor) return

    const { attemptId, taskId } = activeMonitor
    const { positionKey } = input

    // Find pending evaluations for this attempt
    const pending = runtimeStore.getState().pendingMoveEvaluations
    const pendingForAttempt = Object.values(pending).filter(
      (e) =>
        e.attemptId === attemptId &&
        e.status === 'pending' &&
        e.positionAfterHash === positionKey,
    )

    if (pendingForAttempt.length === 0) return

    const afterEval = analysisResultAdapter.getAnalysisForPosition(positionKey)
    if (!afterEval) {
      logger?.info('monitor.analysisUpdate.skip', 'No afterEval for positionKey', {
        positionKey,
        pendingCount: pendingForAttempt.length,
      })
      return
    }

    for (const evalRecord of pendingForAttempt) {
      const beforeEval = analysisResultAdapter.getAnalysisForPosition(
        evalRecord.positionBeforeHash ?? '',
      )

      // Only process if we have a before eval to compare
      if (!beforeEval) {
        logger?.info('monitor.analysisUpdate.skip_no_before', 'No beforeEval for pending evaluation', {
          evaluationId: evalRecord.id,
          moveIndex: evalRecord.moveIndex,
        })
        continue
      }

      const evaluated = evaluateMove({
        beforeEval,
        afterEval,
        move: evalRecord.move,
        moveIndex: evalRecord.moveIndex,
      })

      // Preserve the original id and attemptId
      const updatedEval: MoveEvaluation = {
        ...evaluated,
        id: evalRecord.id,
        attemptId: evalRecord.attemptId,
        positionBeforeHash: evalRecord.positionBeforeHash,
        positionAfterHash: evalRecord.positionAfterHash,
        status: 'evaluated',
        evaluatedAt: new Date().toISOString(),
      }

      logger?.info('monitor.evaluated', 'MoveEvaluation updated', {
        evaluationId: evalRecord.id,
        moveIndex: evalRecord.moveIndex,
        move: evalRecord.move,
        scoreDrop: updatedEval.scoreDrop,
        winrateDrop: updatedEval.winrateDrop,
        engineSuggestedMove: updatedEval.engineSuggestedMove,
        beforeScoreLead: updatedEval.beforeScoreLead,
        afterScoreLead: updatedEval.afterScoreLead,
      })

      await repository.updateMoveEvaluation(evalRecord.id, {
        status: 'evaluated',
        scoreDrop: updatedEval.scoreDrop,
        winrateDrop: updatedEval.winrateDrop,
        beforeScoreLead: updatedEval.beforeScoreLead,
        afterScoreLead: updatedEval.afterScoreLead,
        beforeWinrate: updatedEval.beforeWinrate,
        afterWinrate: updatedEval.afterWinrate,
        engineSuggestedMove: updatedEval.engineSuggestedMove,
        engineSuggestedLine: updatedEval.engineSuggestedLine,
        evaluatedAt: updatedEval.evaluatedAt,
      })

      runtimeStore.removePendingMoveEvaluation(evalRecord.id)

      // Check severity and create BadMove if needed
      const severity = classifySeverity({
        scoreDrop: updatedEval.scoreDrop,
        winrateDrop: updatedEval.winrateDrop,
      })

      if (shouldCreateBadMove(severity)) {
        const badMove: BadMove = {
          id: `bm_${Date.now()}_${evalRecord.moveIndex}_${Math.random().toString(36).slice(2, 6)}`,
          moveEvaluationId: evalRecord.id,
          attemptId,
          taskId,
          moveIndex: evalRecord.moveIndex,
          severity,
          punishSide: 'black', // will be determined by position context
          createdAt: new Date().toISOString(),
        }

        await attemptService.saveBadMove(badMove)

        logger?.info('monitor.badMove', 'BadMove created', {
          badMoveId: badMove.id,
          moveIndex: evalRecord.moveIndex,
          severity,
          scoreDrop: updatedEval.scoreDrop,
          engineSuggestedMove: updatedEval.engineSuggestedMove,
        })

        // Update visible bad moves in runtime store
        const currentBadMoveIds = runtimeStore.getState().visibleBadMoveIds
        runtimeStore.setVisibleBadMoveIds([...currentBadMoveIds, badMove.id])
      }
    }
  }

  async function failExpiredPendingEvaluations(now?: string): Promise<void> {
    if (!activeMonitor) return

    const { attemptId } = activeMonitor
    const cutoff =
      now != null
        ? new Date(now).getTime()
        : Date.now()
    const cutoffStr = new Date(cutoff).toISOString()

    const pending = runtimeStore.getState().pendingMoveEvaluations
    const expired = Object.values(pending).filter((e) => {
      if (e.attemptId !== attemptId || e.status !== 'pending') return false
      const created = new Date(e.createdAt).getTime()
      return cutoff - created > PENDING_TIMEOUT_MS
    })

    for (const evalRecord of expired) {
      await repository.updateMoveEvaluation(evalRecord.id, {
        status: 'failed',
      })
      runtimeStore.removePendingMoveEvaluation(evalRecord.id)

      logger?.info('monitor.evalExpired', 'Pending evaluation expired', {
        evaluationId: evalRecord.id,
        attemptId,
        moveIndex: evalRecord.moveIndex,
      })
    }
  }

  return {
    startForAttempt,
    stopForAttempt,
    onUserMove,
    onAnalysisUpdated,
    failExpiredPendingEvaluations,
  }
}
