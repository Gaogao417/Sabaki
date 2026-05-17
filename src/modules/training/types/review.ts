import type { TrainingAttemptResult } from './attempt'

/** @deprecated */
export type ReviewItemType = 'problem' | 'recall_segment'

export type ReviewSchedule = {
  id: string

  // v0.5: direct task reference
  taskId: string

  // v0.4 legacy fields (deprecated)
  /** @deprecated Use taskId */
  itemId?: string
  /** @deprecated Use taskId */
  itemType?: ReviewItemType

  dueAt: string
  intervalDays: number

  easeFactor?: number
  lastResult?: 'pass' | 'soft_pass' | 'fail' | 'abandoned'

  consecutivePassCount: number
  totalFailCount: number

  lastReviewedAt?: string
  createdAt: string
  updatedAt: string
}

export type ReviewUpdateInput = {
  taskId?: string
  /** @deprecated */
  itemId?: string
  /** @deprecated */
  itemType?: ReviewItemType
  result: TrainingAttemptResult
}
