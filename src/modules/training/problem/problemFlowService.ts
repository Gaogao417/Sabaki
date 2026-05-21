import type {
  BadMove,
  BadMoveSeverity,
  TrainingAttempt,
  TrainingAttemptResult,
} from '../types/index'
import type { AttemptService } from '../attempt/attemptService'
import type { PlayTrainingMonitor } from '../attempt/playTrainingMonitor'
import type { ProblemService } from './problemService'
import type { ReviewService } from '../review/reviewService'
import type { TrainingRepository } from '../repository/trainingRepository'
import type { TrainingRuntimeStore } from '../store/trainingRuntimeStore'

export type SubmitProblemResult = {
  attempt: TrainingAttempt
  result: TrainingAttemptResult
  generatedPunishmentProblemIds: string[]
}

export type InlineMoveEval = {
  moveIndex: number
  move: string
  isBadMove: boolean
  severity: string
  beforeScoreLead?: number
  afterScoreLead?: number
  scoreDrop?: number
}

export type PreMoveAnalysis = {
  sign: number
  variations: Array<{
    vertex: number[]
    scoreLead?: number
  }>
}

export type AppendMoveInput = {
  move: string
  vertex: number[]
  playerSign: number
  positionBeforeHash?: string
  positionAfterHash?: string
  preMoveAnalysis: PreMoveAnalysis | null
}

export type AppendMoveResult = {
  moveIndex: number
  evalCache: InlineMoveEval[]
  badMoves: RuntimeBadMove[]
}

export type UndoMoveResult = {
  evalCache: InlineMoveEval[]
  badMoves: RuntimeBadMove[]
  userLine: string[]
}

export type ProblemFlowService = {
  appendProblemMove(input: AppendMoveInput): Promise<AppendMoveResult | null>
  undoProblemMove(): UndoMoveResult | null
  submitActiveProblem(): Promise<SubmitProblemResult | null>
}

export type ProblemFlowServiceDeps = {
  runtimeStore: TrainingRuntimeStore
  repository: TrainingRepository
  attemptService: AttemptService
  monitor: PlayTrainingMonitor
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

function vertexEquals(a: number[], b: number[]): boolean {
  return a[0] === b[0] && a[1] === b[1]
}

function evaluateInline(input: {
  move: string
  vertex: number[]
  playerSign: number
  moveIndex: number
  preMoveAnalysis: PreMoveAnalysis | null
}): InlineMoveEval {
  const { move, vertex, playerSign, moveIndex, preMoveAnalysis } = input

  const result: InlineMoveEval = {
    moveIndex,
    move,
    isBadMove: false,
    severity: 'none',
  }

  if (!preMoveAnalysis) return result

  const analysis = preMoveAnalysis
  const isSolverMove =
    (analysis.sign > 0 && playerSign > 0) || (analysis.sign < 0 && playerSign < 0)

  const variation = analysis.variations.find(v =>
    vertexEquals(v.vertex, vertex),
  )
  if (!variation) return result

  if (
    analysis.variations[0]?.scoreLead != null &&
    variation.scoreLead != null
  ) {
    let scoreDrop = isSolverMove
      ? analysis.variations[0].scoreLead - variation.scoreLead
      : variation.scoreLead - analysis.variations[0].scoreLead

    if (playerSign < 0) scoreDrop = -scoreDrop

    result.beforeScoreLead = analysis.variations[0].scoreLead
    result.afterScoreLead = variation.scoreLead
    result.scoreDrop = Math.abs(scoreDrop)

    if (Math.abs(scoreDrop) > 8) {
      result.isBadMove = true
      result.severity = 'severe'
    } else if (Math.abs(scoreDrop) > 5) {
      result.isBadMove = true
      result.severity = 'major'
    } else if (Math.abs(scoreDrop) > 2) {
      result.isBadMove = true
      result.severity = 'minor'
    }
  }

  return result
}

export function createProblemFlowService(
  deps: ProblemFlowServiceDeps,
): ProblemFlowService {
  const {
    runtimeStore,
    repository,
    attemptService,
    monitor,
    problemService,
    reviewService,
    logger,
  } = deps

  async function appendProblemMove(input: AppendMoveInput): Promise<AppendMoveResult | null> {
    const view = runtimeStore.getState().problemView
    if (!view || view.submitted) return null

    const {
      move,
      vertex,
      playerSign,
      positionBeforeHash,
      positionAfterHash,
      preMoveAnalysis,
    } = input
    const moveIndex = view.evalCache.length

    // Inline evaluation
    const moveEval = evaluateInline({ move, vertex, playerSign, moveIndex, preMoveAnalysis })

    await attemptService.appendMove(view.attemptId, move)

    try {
      await monitor.onUserMove({
        attemptId: view.attemptId,
        moveIndex,
        move,
        positionBeforeHash,
        positionAfterHash,
      })
    } catch (e) {
      logger?.info('problemFlow.monitorMove.error', 'Monitor onUserMove failed', {
        attemptId: view.attemptId,
        moveIndex,
        positionBeforeHash,
        positionAfterHash,
        error: String(e),
      })
    }

    const newEvalCache = [...view.evalCache, moveEval]
    const newBadMoves = [...view.badMoves]
    if (moveEval.isBadMove) {
      newBadMoves.push({
        moveIndex: moveEval.moveIndex,
        move,
        severity: moveEval.severity,
        scoreDrop: moveEval.scoreDrop,
      })
    }

    // Update runtime store
    runtimeStore.setProblemView({
      ...view,
      evalCache: newEvalCache,
      badMoves: newBadMoves,
    })

    logger?.info('problem.move', 'Problem move', { move, moveIndex })

    return { moveIndex, evalCache: newEvalCache, badMoves: newBadMoves }
  }

  function undoProblemMove(): UndoMoveResult | null {
    const view = runtimeStore.getState().problemView
    if (!view || view.evalCache.length === 0) return null

    const lastEval = view.evalCache[view.evalCache.length - 1]
    const newEvalCache = view.evalCache.slice(0, -1)
    const newBadMoves = lastEval.isBadMove
      ? view.badMoves.filter(m => m.moveIndex !== lastEval.moveIndex)
      : view.badMoves

    const userLine = newEvalCache.map(e => e.move)

    runtimeStore.setProblemView({
      ...view,
      evalCache: newEvalCache,
      badMoves: newBadMoves,
    })

    return { evalCache: newEvalCache, badMoves: newBadMoves, userLine }
  }

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
      taskId: problemId,
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
    appendProblemMove,
    undoProblemMove,
    submitActiveProblem,
  }
}
