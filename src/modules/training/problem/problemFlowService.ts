import type {
  BadMove,
  BadMoveSeverity,
  TrainingAttempt,
  TrainingAttemptResult,
} from '../types/index'
import type { AttemptService } from '../attempt/attemptService'
import type { ProblemService } from './problemService'
import type { ReviewService } from '../review/reviewService'
import type { TrainingRepository } from '../repository/trainingRepository'
import type { TrainingRuntimeStore } from '../store/trainingRuntimeStore'

export type SubmitProblemResult = {
  attempt: TrainingAttempt
  result: TrainingAttemptResult
  generatedPunishmentProblemIds: string[]
}

export type ProblemFlowService = {
  submitActiveProblem(): Promise<SubmitProblemResult | null>
}

export type ProblemFlowServiceDeps = {
  runtimeStore: TrainingRuntimeStore
  repository: TrainingRepository
  attemptService: AttemptService
  problemService: ProblemService
  reviewService: ReviewService
  logger?: {
    info(channel: string, message: string, data?: Record<string, unknown>): void
  }
}

type RuntimeBadMove = {
  moveIndex: number
  move?: string
  severity: string
  scoreDrop?: number
}

function isBadMoveSeverity(severity: string): severity is BadMoveSeverity {
  return severity === 'minor' || severity === 'major' || severity === 'severe'
}

function determineResult(
  badMoves: Array<{ severity: string }>,
): TrainingAttemptResult {
  if (badMoves.some(move => move.severity === 'severe')) return 'fail'
  if (badMoves.some(move => move.severity === 'major')) return 'soft_pass'
  return 'pass'
}

function oppositeSide(side: unknown): 'black' | 'white' {
  return side === 'black' ? 'white' : 'black'
}

function generateBadMoveId(moveIndex: number): string {
  return `bm_${Date.now()}_${moveIndex}_${Math.random().toString(36).slice(2, 6)}`
}

export function createProblemFlowService(
  deps: ProblemFlowServiceDeps,
): ProblemFlowService {
  const {
    runtimeStore,
    repository,
    attemptService,
    problemService,
    reviewService,
    logger,
  } = deps

  async function persistRuntimeBadMoves(input: {
    attemptId: string
    taskId: string
    punishSide: 'black' | 'white'
    runtimeBadMoves: RuntimeBadMove[]
  }): Promise<BadMove[]> {
    const { attemptId, taskId, punishSide, runtimeBadMoves } = input
    if (runtimeBadMoves.length === 0) return []

    const existingBadMoves = await repository.listBadMovesByAttempt(attemptId)
    if (existingBadMoves.length > 0) return existingBadMoves

    const evaluations = await repository.listMoveEvaluationsByAttempt(attemptId)
    const saved: BadMove[] = []

    for (const runtimeBadMove of runtimeBadMoves) {
      if (!isBadMoveSeverity(runtimeBadMove.severity)) continue

      const evaluation = evaluations.find(
        item => item.moveIndex === runtimeBadMove.moveIndex,
      )
      if (!evaluation) {
        logger?.info(
          'problem.submit.badMoveSkipped',
          'Runtime bad move has no MoveEvaluation; skipping new bad_move persistence',
          {
            attemptId,
            moveIndex: runtimeBadMove.moveIndex,
            severity: runtimeBadMove.severity,
          },
        )
        continue
      }

      const badMove: BadMove = {
        id: generateBadMoveId(runtimeBadMove.moveIndex),
        moveEvaluationId: evaluation.id,
        attemptId,
        taskId,
        moveIndex: runtimeBadMove.moveIndex,
        severity: runtimeBadMove.severity,
        punishSide,
        positionBeforeSgf: evaluation.positionBeforeSgf,
        positionAfterSgf: evaluation.positionAfterSgf,
        createdAt: new Date().toISOString(),
      }

      await attemptService.saveBadMove(badMove)
      saved.push(badMove)
    }

    return saved
  }

  async function createPunishments(badMoves: BadMove[]): Promise<string[]> {
    const punishmentProblemIds: string[] = []

    for (const badMove of badMoves) {
      if (badMove.severity !== 'major' && badMove.severity !== 'severe') {
        continue
      }

      const { problem } =
        await problemService.createPunishmentProblemFromBadMove(badMove.id)
      punishmentProblemIds.push(problem.id)
    }

    return punishmentProblemIds
  }

  async function submitActiveProblem(): Promise<SubmitProblemResult | null> {
    const view = runtimeStore.getState().problemView
    if (!view || view.submitted) return null

    const problemId = view.problemId ?? String(view.legacyProblemSession?.id ?? '')
    if (!problemId) {
      throw new Error('problemFlowService.submitActiveProblem: active problem has no problemId')
    }

    const runtimeBadMoves = view.badMoves as RuntimeBadMove[]
    const persistedBadMoves = await repository.listBadMovesByAttempt(view.attemptId)
    const badMovesForResult =
      persistedBadMoves.length > 0 ? persistedBadMoves : runtimeBadMoves
    const result = determineResult(badMovesForResult)

    logger?.info('problem.submit', 'Problem attempt submitted', {
      problemId,
      attemptId: view.attemptId,
      badMoveCount: badMovesForResult.length,
      result,
    })

    const frozenAttempt = await attemptService.freezeAttempt(view.attemptId)
    await attemptService.finalizeAttemptResult(view.attemptId, result)
    const finalizedAttempt: TrainingAttempt = {
      ...frozenAttempt,
      result,
      status: 'submitted',
    }

    const punishSide = oppositeSide(view.legacyProblemSession?.sideToMove)
    const savedBadMoves =
      persistedBadMoves.length > 0
        ? persistedBadMoves
        : await persistRuntimeBadMoves({
          attemptId: view.attemptId,
          taskId: view.taskId,
          punishSide,
          runtimeBadMoves,
        })

    const generatedPunishmentProblemIds = await createPunishments(savedBadMoves)

    await reviewService.updateScheduleAfterResult({
      itemId: problemId,
      itemType: 'problem',
      result,
    })

    runtimeStore.setProblemView({
      ...view,
      submitted: true,
      result,
    })

    return {
      attempt: finalizedAttempt,
      result,
      generatedPunishmentProblemIds,
    }
  }

  return {
    submitActiveProblem,
  }
}
