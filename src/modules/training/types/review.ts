import type { TrainingAttemptResult } from './attempt'

export type ReviewItemType = 'problem' | 'recall_segment'

export type ReviewSchedule = {
  id: string

  itemId: string
  itemType: ReviewItemType

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
  itemId: string
  itemType: ReviewItemType
  result: TrainingAttemptResult
}
