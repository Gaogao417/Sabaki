import type { ReferenceLine } from './recall'

export type TaskOrigin = {
  provider: 'fox' | '101' | 'local' | 'manual' | 'snapshot' | 'bad_move' | 'review' | 'inferred' | 'recall' | string
  externalId?: string
  parentTaskId?: string
  parentAttemptId?: string
  parentMoveIndex?: number
  raw?: Record<string, unknown>
}

/** @deprecated Use TaskOrigin instead */
export type TrainingTaskKind =
  | 'game'
  | 'problem'
  | 'snapshot_problem'
  | 'recall_segment'

/** @deprecated Use TaskOrigin instead */
export type TrainingTaskSource =
  | { kind: 'game'; gameId: string }
  | { kind: 'problem'; problemId: string }
  | {
      kind: 'snapshot_problem'
      problemId: string
      parentTaskId?: string
      parentAttemptId?: string
    }
  | {
      kind: 'recall_segment'
      segmentId: string
      sourceAttemptId?: string
      sourceGameId?: string
    }

export type ProblemArea = {
  x1: number
  y1: number
  x2: number
  y2: number
}

export type TaskPassRule = {
  allowed?: boolean
  description?: string
}

export type MoveActor = {
  moveIndex: number
  actor: 'human' | 'ai'
}

export type TrainingTask = {
  id: string

  rootPositionSgf: string
  sideToMove?: 'black' | 'white'

  title?: string

  // Problem-like fields (directly on task, no separate Problem entity needed)
  prompt?: string
  goal?: string
  passRule?: TaskPassRule
  referenceLines?: ReferenceLine[]
  problemArea?: ProblemArea

  // Metadata
  tags?: string[]
  difficulty?: number
  status?: string

  // Source tracking (replaces kind + source)
  origin?: TaskOrigin

  // Legacy fields kept for backward compatibility during transition
  kind?: TrainingTaskKind
  source?: TrainingTaskSource

  createdAt: string
  updatedAt: string
}
