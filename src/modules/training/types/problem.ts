import type { ReferenceLine } from './recall'

export type ProblemType =
  | 'best_move'
  | 'direction_judgement'
  | 'local_fight'
  | 'life_and_death'
  | 'tesuji'
  | 'endgame'
  | 'shape'
  | 'punishment'
  | 'review_memory'

export type PassRule = {
  scoreDropThreshold?: number
  severeDropThreshold?: number
  winrateDropThreshold?: number

  maxBadMoveCount?: number
  requireNoSevereBadMove: boolean

  compareWithReference: boolean
  referenceScoreDropThreshold?: number

  targetDescription?: string
}

export type Problem = {
  id: string

  type: ProblemType

  positionSgf: string
  sideToMove: 'black' | 'white'

  title?: string
  positionDescription: string
  taskGoal: string

  referenceLines: ReferenceLine[]
  passRule: PassRule

  tags: string[]
  difficulty?: 1 | 2 | 3 | 4 | 5

  status: 'inbox' | 'active' | 'archived'

  sourceGameId?: string
  sourceProblemId?: string
  sourceTaskId?: string
  sourceAttemptId?: string
  sourceMoveIndex?: number

  parentProblemId?: string
  parentSnapshotReason?: string

  createdAt: string
  updatedAt: string
}
