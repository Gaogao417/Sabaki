export type TrainingAttemptStatus =
  | 'playing'
  | 'submitted'
  | 'recalling'
  | 'analyzing'
  | 'completed'
  | 'abandoned'

export type TrainingAttemptResult =
  | 'pending'
  | 'pass'
  | 'soft_pass'
  | 'fail'
  | 'abandoned'

export type TrainingAttempt = {
  id: string
  taskId: string
  tabId?: string

  startedAt: string
  submittedAt?: string
  completedAt?: string

  rootPositionSgf: string
  userLine: string[]

  status: TrainingAttemptStatus
  result: TrainingAttemptResult

  hintLevelUsed: number
  recallCompleted: boolean
  analysisOpened: boolean
}
