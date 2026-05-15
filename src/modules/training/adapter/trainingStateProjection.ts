import type { WorkbenchStoreState } from '../store/workbenchStore'
import type { TrainingRuntimeState } from '../store/trainingRuntimeStore'

export type LegacyTrainingState = {
  recallSession: Record<string, unknown> | null
  recallMoveIndex: number
  recallExpectedMoves: { sign: number; vertex: string | null }[]
  recallUserAttempts: { vertex: string; isCorrect: boolean }[]
  recallShowHint: boolean
  recallCompleted: boolean

  problemSession: Record<string, unknown> | null
  problemAttempt: Record<string, unknown> | null
  problemEvalCache: Record<string, unknown>[]
  problemBadMoves: Record<string, unknown>[]
  problemSubmitted: boolean
  problemResult: string | null

  reviewQueue: string[]
  reviewCurrentIndex: number
  reviewTotalDue: number
}

const EMPTY_RECALL = {
  recallSession: null,
  recallMoveIndex: 0,
  recallExpectedMoves: [],
  recallUserAttempts: [],
  recallShowHint: false,
  recallCompleted: false,
}

const EMPTY_PROBLEM = {
  problemSession: null,
  problemAttempt: null,
  problemEvalCache: [],
  problemBadMoves: [],
  problemSubmitted: false,
  problemResult: null,
}

const EMPTY_REVIEW = {
  reviewQueue: [],
  reviewCurrentIndex: 0,
  reviewTotalDue: 0,
}

export function projectTrainingState(deps: {
  legacyTrainingState: Record<string, unknown>
  workbenchState: WorkbenchStoreState
  trainingRuntimeState: TrainingRuntimeState
}): Partial<LegacyTrainingState> {
  const { legacyTrainingState, trainingRuntimeState } = deps
  const { recallView, problemView, reviewQueueView } = trainingRuntimeState

  const result: Partial<LegacyTrainingState> = {}

  // Recall: if recallView is populated, use it; otherwise fall back to legacy
  if (recallView) {
    result.recallSession = { active: true }
    result.recallMoveIndex = recallView.moveIndex
    result.recallExpectedMoves = recallView.expectedMoves
    result.recallUserAttempts = recallView.userAttempts
    result.recallShowHint = recallView.showHint
    result.recallCompleted = recallView.completed
  } else {
    const ls = legacyTrainingState
    result.recallSession = (ls.recallSession as LegacyTrainingState['recallSession']) ?? EMPTY_RECALL.recallSession
    result.recallMoveIndex = (ls.recallMoveIndex as number) ?? EMPTY_RECALL.recallMoveIndex
    result.recallExpectedMoves = (ls.recallExpectedMoves as LegacyTrainingState['recallExpectedMoves']) ?? EMPTY_RECALL.recallExpectedMoves
    result.recallUserAttempts = (ls.recallUserAttempts as LegacyTrainingState['recallUserAttempts']) ?? EMPTY_RECALL.recallUserAttempts
    result.recallShowHint = (ls.recallShowHint as boolean) ?? EMPTY_RECALL.recallShowHint
    result.recallCompleted = (ls.recallCompleted as boolean) ?? EMPTY_RECALL.recallCompleted
  }

  // Problem: projected from runtime store only
  if (problemView) {
    result.problemSession = problemView.legacyProblemSession
    result.problemAttempt = {
      userLine: problemView.evalCache.map((e) => e.move),
      moveEvaluations: problemView.evalCache,
    }
    result.problemEvalCache = problemView.evalCache as unknown as Record<string, unknown>[]
    result.problemBadMoves = problemView.badMoves as unknown as Record<string, unknown>[]
    result.problemSubmitted = problemView.submitted
    result.problemResult = problemView.result
  } else {
    result.problemSession = EMPTY_PROBLEM.problemSession
    result.problemAttempt = EMPTY_PROBLEM.problemAttempt
    result.problemEvalCache = EMPTY_PROBLEM.problemEvalCache
    result.problemBadMoves = EMPTY_PROBLEM.problemBadMoves
    result.problemSubmitted = EMPTY_PROBLEM.problemSubmitted
    result.problemResult = EMPTY_PROBLEM.problemResult
  }

  // Review queue: projected from runtime store only
  if (reviewQueueView) {
    result.reviewQueue = reviewQueueView.queue
    result.reviewCurrentIndex = reviewQueueView.currentIndex
    result.reviewTotalDue = reviewQueueView.totalDue
  } else {
    result.reviewQueue = EMPTY_REVIEW.reviewQueue
    result.reviewCurrentIndex = EMPTY_REVIEW.reviewCurrentIndex
    result.reviewTotalDue = EMPTY_REVIEW.reviewTotalDue
  }

  return result
}
