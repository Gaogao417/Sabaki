export type BadMoveSeverity = 'minor' | 'major' | 'severe'

export type BadMove = {
  id: string
  moveEvaluationId: string
  attemptId: string
  taskId: string

  moveIndex: number
  severity: BadMoveSeverity

  punishSide: 'black' | 'white'

  positionBeforeSgf?: string
  positionAfterSgf?: string

  userMarkedAsNotBad?: boolean

  generatedProblemId?: string
  recallCheckpointId?: string

  createdAt: string
}
