import type { MoveEvaluation } from '../types/index'

export type RecallView = {
  recallSessionId: string
  taskId: string
  tabId?: string
  moveIndex: number
  expectedMoves: { sign: number; vertex: string | null }[]
  userAttempts: { vertex: string; isCorrect: boolean }[]
  showHint: boolean
  completed: boolean
}

export type ProblemView = {
  taskId: string
  tabId?: string
  attemptId: string
  problemId?: string
  legacyProblemSession: Record<string, unknown> | null
  evalCache: MoveEvaluation[]
  badMoves: {
    moveIndex: number
    move: string
    severity: string
    scoreDrop?: number
  }[]
  submitted: boolean
  result: string | null
}

export type ReviewQueueView = {
  queue: string[]
  currentIndex: number
  totalDue: number
}

export type TrainingRuntimeState = {
  activeAttemptId?: string
  activeRecallSessionId?: string
  activeCheckpointId?: string

  pendingMoveEvaluations: Record<string, MoveEvaluation>

  correctionDraft?: {
    checkpointId: string
    moves: string[]
  }

  visibleBadMoveIds: string[]

  recallView: RecallView | null
  problemView: ProblemView | null
  reviewQueueView: ReviewQueueView | null
}

export type TrainingRuntimeStore = {
  getState(): TrainingRuntimeState
  subscribe(listener: () => void): () => void

  setActiveAttempt(id?: string): void
  setActiveRecallSession(id?: string): void
  setActiveCheckpoint(id?: string): void

  upsertPendingMoveEvaluation(evaluation: MoveEvaluation): void
  removePendingMoveEvaluation(evaluationId: string): void

  setCorrectionDraft(draft?: { checkpointId: string; moves: string[] }): void
  setVisibleBadMoveIds(ids: string[]): void

  setRecallView(view: RecallView | null): void
  setProblemView(view: ProblemView | null): void
  setReviewQueueView(view: ReviewQueueView | null): void
}

export function createTrainingRuntimeStore(): TrainingRuntimeStore {
  let state: TrainingRuntimeState = {
    pendingMoveEvaluations: {},
    visibleBadMoveIds: [],
    recallView: null,
    problemView: null,
    reviewQueueView: null,
  }

  const listeners = new Set<() => void>()

  function notify() {
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    getState() {
      return state
    },

    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    setActiveAttempt(id?: string) {
      state = { ...state, activeAttemptId: id }
      notify()
    },

    setActiveRecallSession(id?: string) {
      state = { ...state, activeRecallSessionId: id }
      notify()
    },

    setActiveCheckpoint(id?: string) {
      state = { ...state, activeCheckpointId: id }
      notify()
    },

    upsertPendingMoveEvaluation(evaluation: MoveEvaluation) {
      state = {
        ...state,
        pendingMoveEvaluations: {
          ...state.pendingMoveEvaluations,
          [evaluation.id]: evaluation,
        },
      }
      notify()
    },

    removePendingMoveEvaluation(evaluationId: string) {
      const { [evaluationId]: _, ...rest } = state.pendingMoveEvaluations
      state = { ...state, pendingMoveEvaluations: rest }
      notify()
    },

    setCorrectionDraft(draft?: { checkpointId: string; moves: string[] }) {
      state = { ...state, correctionDraft: draft }
      notify()
    },

    setVisibleBadMoveIds(ids: string[]) {
      state = { ...state, visibleBadMoveIds: ids }
      notify()
    },

    setRecallView(view: RecallView | null) {
      state = { ...state, recallView: view }
      notify()
    },

    setProblemView(view: ProblemView | null) {
      state = { ...state, problemView: view }
      notify()
    },

    setReviewQueueView(view: ReviewQueueView | null) {
      state = { ...state, reviewQueueView: view }
      notify()
    },
  }
}
