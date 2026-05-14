export type TrainingTaskKind =
  | 'game'
  | 'problem'
  | 'snapshot_problem'
  | 'recall_segment'

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

export type TrainingTask = {
  id: string
  kind: TrainingTaskKind
  source: TrainingTaskSource

  rootPositionSgf: string
  sideToMove?: 'black' | 'white'

  title?: string

  createdAt: string
  updatedAt: string
}
