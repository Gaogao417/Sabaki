import type { BadMoveSeverity } from './badMove'

export type RecallSource =
  | { kind: 'attempt'; attemptId: string }
  | { kind: 'game'; gameId: string; startMove?: number; endMove?: number }
  | { kind: 'segment'; segmentId: string }

export type RecallSession = {
  id: string
  taskId: string
  tabId?: string

  // v0.5: direct attempt binding
  attemptId?: string

  // v0.4 legacy fields (deprecated, kept for compatibility)
  type?: 'line_recall'
  source?: RecallSource
  startMove?: number
  endMove?: number

  expectedMoves: string[]
  currentMoveIndex: number

  completed: boolean

  createdAt: string
  completedAt?: string
}

export type RecallAttempt = {
  id: string
  recallSessionId: string

  moveNumber: number
  expectedMove: string
  userMove: string

  isCorrect: boolean
  hintLevelUsed: number

  createdAt: string
}

export type RecallCheckpointStatus =
  | 'pending_correction'
  | 'ai_revealed'
  | 'commented'
  | 'skipped'

export type ReferenceLine = {
  id?: string
  label: string
  moves: string[]
  source: 'engine' | 'user' | 'game' | 'manual'
  scoreLead?: number
  winrate?: number
}

export type RecallCheckpoint = {
  id: string
  recallSessionId: string
  badMoveId: string

  status: RecallCheckpointStatus

  userCorrectionLine: string[]
  aiCandidateLines: ReferenceLine[]

  userCommentId?: string

  createdAt: string
  completedAt?: string
}
