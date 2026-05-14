import type { MoveEvaluation } from '../types/index'

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
}

export function createTrainingRuntimeStore(): TrainingRuntimeStore {
  let state: TrainingRuntimeState = {
    pendingMoveEvaluations: {},
    visibleBadMoveIds: [],
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
  }
}
