export type MoveEvaluationStatus = 'pending' | 'evaluated' | 'failed'

export type MoveEvaluation = {
  id: string
  attemptId: string

  moveIndex: number
  move: string

  positionBeforeHash?: string
  positionAfterHash?: string

  // Only for BadMove / Checkpoint / Snapshot key nodes
  positionBeforeSgf?: string
  positionAfterSgf?: string

  beforeScoreLead?: number
  afterScoreLead?: number
  scoreDrop?: number

  beforeWinrate?: number
  afterWinrate?: number
  winrateDrop?: number

  engineSuggestedMove?: string
  engineSuggestedLine?: string[]

  status: MoveEvaluationStatus

  createdAt: string
  evaluatedAt?: string
}
