export type MoveCommentTarget =
  | { kind: 'bad_move'; badMoveId: string }
  | { kind: 'checkpoint'; checkpointId: string }
  | { kind: 'move_evaluation'; moveEvaluationId: string }
  | { kind: 'position'; positionHash: string; positionSgf?: string }

export type MoveComment = {
  id: string
  target: MoveCommentTarget

  content: string

  templateAnswers?: {
    originalBadBecause?: string
    correctionBetterBecause?: string
    diffWithAi?: string
    keyConflict?: string
    futureRule?: string
  }

  createdAt: string
  updatedAt: string
}
