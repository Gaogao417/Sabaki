import type {
  MoveEvaluation,
  MoveEvaluationStatus,
  BadMove,
  BadMoveSeverity,
  TrainingAttempt,
  TrainingAttemptResult,
  NormalizedAnalysisResult,
  PassRule,
  Problem,
} from '../types/index'

export type Severity = 'none' | BadMoveSeverity

const DEFAULT_MINOR_THRESHOLD = 2.0
const DEFAULT_MAJOR_THRESHOLD = 5.0
const DEFAULT_SEVERE_THRESHOLD = 8.0
const DEFAULT_WINRATE_THRESHOLD = 0.05

export function classifySeverity(input: {
  scoreDrop?: number
  winrateDrop?: number
  passRule?: PassRule
}): Severity {
  const { scoreDrop, winrateDrop, passRule } = input

  const minor =
    passRule?.scoreDropThreshold ?? DEFAULT_MINOR_THRESHOLD
  const major =
    passRule?.severeDropThreshold ?? DEFAULT_MAJOR_THRESHOLD
  // severe uses a fixed threshold; passRule only overrides minor/major
  const severe = DEFAULT_SEVERE_THRESHOLD
  const winrateThresh =
    passRule?.winrateDropThreshold ?? DEFAULT_WINRATE_THRESHOLD

  if (scoreDrop == null && winrateDrop == null) return 'none'

  if (scoreDrop != null) {
    if (scoreDrop >= severe) return 'severe'
    if (scoreDrop >= major) return 'major'
    if (scoreDrop >= minor) return 'minor'
  }

  if (winrateDrop != null && winrateDrop >= winrateThresh) {
    // winrate alone only reaches minor
    return 'minor'
  }

  return 'none'
}

export function evaluateMove(input: {
  beforeEval?: NormalizedAnalysisResult
  afterEval?: NormalizedAnalysisResult
  move: string
  moveIndex: number
  passRule?: PassRule
}): MoveEvaluation {
  const { beforeEval, afterEval, move, moveIndex, passRule } = input

  const id = `eval_${Date.now()}_${moveIndex}_${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()

  const beforeScoreLead = beforeEval?.scoreLead
  const afterScoreLead = afterEval?.scoreLead
  const beforeWinrate = beforeEval?.winrate
  const afterWinrate = afterEval?.winrate

  const scoreDrop =
    beforeScoreLead != null && afterScoreLead != null
      ? Math.abs(beforeScoreLead - afterScoreLead)
      : undefined
  const winrateDrop =
    beforeWinrate != null && afterWinrate != null
      ? Math.abs(beforeWinrate - afterWinrate)
      : undefined

  const engineSuggestedMove = beforeEval?.candidateMoves?.[0]?.move
  const engineSuggestedLine = beforeEval?.candidateMoves?.[0]?.pv

  const hasResult = beforeEval != null || afterEval != null
  const status: MoveEvaluationStatus = hasResult ? 'evaluated' : 'pending'

  return {
    id,
    attemptId: '',
    moveIndex,
    move,
    beforeScoreLead,
    afterScoreLead,
    scoreDrop,
    beforeWinrate,
    afterWinrate,
    winrateDrop,
    engineSuggestedMove,
    engineSuggestedLine,
    status,
    createdAt: now,
    evaluatedAt: hasResult ? now : undefined,
  }
}

export function evaluateAttempt(input: {
  attempt: TrainingAttempt
  moveEvaluations: MoveEvaluation[]
  badMoves: BadMove[]
  problem?: Problem
}): TrainingAttemptResult {
  const { attempt, moveEvaluations, badMoves, problem } = input

  if (attempt.status === 'abandoned') return 'abandoned'

  const passRule = problem?.passRule

  // If any evaluations are still pending, result is pending
  const hasPending = moveEvaluations.some(e => e.status === 'pending')
  if (hasPending) return 'pending'

  const severeBadMoves = badMoves.filter(b => b.severity === 'severe')
  const majorBadMoves = badMoves.filter(b => b.severity === 'major')

  // If passRule requires no severe and we have severe → fail
  if (passRule?.requireNoSevereBadMove && severeBadMoves.length > 0) {
    return 'fail'
  }

  // If maxBadMoveCount is set and exceeded → fail
  if (
    passRule?.maxBadMoveCount != null &&
    badMoves.length > passRule.maxBadMoveCount
  ) {
    return 'fail'
  }

  // If we have severe bad moves and no passRule override → fail
  if (!passRule && severeBadMoves.length > 0) {
    return 'fail'
  }

  // If we have major bad moves → soft_pass
  if (majorBadMoves.length > 0) {
    return 'soft_pass'
  }

  // Minor or no bad moves → pass
  if (badMoves.length > 0) {
    return badMoves.some(b => b.severity === 'minor') ? 'soft_pass' : 'pass'
  }

  return 'pass'
}

export function shouldCreateBadMove(severity: Severity): severity is BadMoveSeverity {
  return severity !== 'none'
}
