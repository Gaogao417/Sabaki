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

export type AiMovePending = {
  requestId: string
  tabId: string
  attemptId: string
  positionHash: string
  treePosition?: string
  mode: 'play' | 'problem'
  color: 'black' | 'white'
  startedAt: string
}

export type TrainingRuntimeState = {
  activeAttemptId?: string
  activeRecallSessionId?: string
  activeCheckpointId?: string
  pendingAiMove?: AiMovePending
  supersededAiMoveRequestIds: string[]

  pendingMoveEvaluations: Record<string, MoveEvaluation>

  correctionDraft?: {
    checkpointId: string
    moves: string[]
    source?: {
      kind: 'recall-checkpoint'
      recallSessionId?: string
      badMoveId?: string
      moveIndex?: number
    }
  }

  visibleBadMoveIds: string[]

  recallView: RecallView | null
  problemView: ProblemView | null
  reviewQueueView: ReviewQueueView | null
}

export type TrainingRuntimeStoreDeps = {
  logger?: {
    info(channel: string, message: string, data?: Record<string, unknown>): void
    warn?(channel: string, message: string, data?: Record<string, unknown>): void
  }
}

export type TrainingRuntimeStore = {
  getState(): TrainingRuntimeState
  subscribe(listener: () => void): () => void

  setActiveAttempt(id?: string): void
  setActiveRecallSession(id?: string): void
  setActiveCheckpoint(id?: string): void
  setAiMovePending(pending: AiMovePending): void
  clearAiMovePending(requestId?: string): void
  hasSupersededAiMoveRequest(requestId: string): boolean

  upsertPendingMoveEvaluation(evaluation: MoveEvaluation): void
  removePendingMoveEvaluation(evaluationId: string): void

  setCorrectionDraft(draft?: TrainingRuntimeState['correctionDraft']): void
  appendCorrectionDraftMove(input: {
    checkpointId: string
    move: string
    source?: NonNullable<TrainingRuntimeState['correctionDraft']>['source']
  }): void
  clearCorrectionDraft(checkpointId?: string): void
  setVisibleBadMoveIds(ids: string[]): void

  setRecallView(view: RecallView | null): void
  setProblemView(view: ProblemView | null): void
  setReviewQueueView(view: ReviewQueueView | null): void
}

export function createTrainingRuntimeStore(deps?: TrainingRuntimeStoreDeps): TrainingRuntimeStore {
  const { logger } = deps ?? {}
  let state: TrainingRuntimeState = {
      pendingMoveEvaluations: {},
      supersededAiMoveRequestIds: [],
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
      if (id) {
        logger?.info('runtime.attempt_activated', 'Active attempt changed', { attemptId: id })
      }
      state = { ...state, activeAttemptId: id }
      notify()
    },

    setActiveRecallSession(id?: string) {
      if (id) {
        logger?.info('runtime.recall_session_activated', 'Active recall session changed', { sessionId: id })
      }
      const clearingOrChangingSession =
        id == null || (state.activeRecallSessionId != null && state.activeRecallSessionId !== id)
      state = {
        ...state,
        activeRecallSessionId: id,
        ...(clearingOrChangingSession
          ? {activeCheckpointId: undefined, correctionDraft: undefined}
          : {}),
      }
      notify()
    },

    setActiveCheckpoint(id?: string) {
      if (id) {
        logger?.info('runtime.checkpoint_activated', 'Active checkpoint changed', { checkpointId: id })
      }
      const shouldClearDraft =
        id == null ||
        (state.correctionDraft != null && state.correctionDraft.checkpointId !== id)
      state = {
        ...state,
        activeCheckpointId: id,
        ...(shouldClearDraft ? {correctionDraft: undefined} : {}),
      }
      notify()
    },

    setAiMovePending(pending: AiMovePending) {
      logger?.info('runtime.ai_move_pending', 'AI move request pending', {
        requestId: pending.requestId,
        tabId: pending.tabId,
        attemptId: pending.attemptId,
        treePosition: pending.treePosition,
        mode: pending.mode,
      })
      const supersededAiMoveRequestIds = state.pendingAiMove
        && state.pendingAiMove.requestId !== pending.requestId
        ? [...state.supersededAiMoveRequestIds, state.pendingAiMove.requestId]
        : state.supersededAiMoveRequestIds
      state = { ...state, pendingAiMove: pending, supersededAiMoveRequestIds }
      notify()
    },

    clearAiMovePending(requestId?: string) {
      if (!state.pendingAiMove) return
      if (requestId != null && state.pendingAiMove.requestId !== requestId) return
      state = { ...state, pendingAiMove: undefined }
      notify()
    },

    hasSupersededAiMoveRequest(requestId: string) {
      return state.supersededAiMoveRequestIds.includes(requestId)
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

    setCorrectionDraft(draft?: TrainingRuntimeState['correctionDraft']) {
      state = {
        ...state,
        correctionDraft: draft == null
          ? undefined
          : {...draft, moves: [...draft.moves]},
      }
      notify()
    },

    appendCorrectionDraftMove(input: {
      checkpointId: string
      move: string
      source?: NonNullable<TrainingRuntimeState['correctionDraft']>['source']
    }) {
      const current = state.correctionDraft?.checkpointId === input.checkpointId
        ? state.correctionDraft
        : undefined
      state = {
        ...state,
        correctionDraft: {
          checkpointId: input.checkpointId,
          moves: [...(current?.moves ?? []), input.move],
          source: input.source ?? current?.source,
        },
      }
      notify()
    },

    clearCorrectionDraft(checkpointId?: string) {
      if (
        checkpointId != null &&
        state.correctionDraft != null &&
        state.correctionDraft.checkpointId !== checkpointId
      ) {
        return
      }
      if (state.correctionDraft == null) return
      state = { ...state, correctionDraft: undefined }
      notify()
    },

    setVisibleBadMoveIds(ids: string[]) {
      state = { ...state, visibleBadMoveIds: ids }
      notify()
    },

    setRecallView(view: RecallView | null) {
      if (view) {
        logger?.info('runtime.recall_view_activated', 'Recall view activated', {
          sessionId: view.recallSessionId,
          taskId: view.taskId,
          moveIndex: view.moveIndex,
        })
      }
      state = { ...state, recallView: view }
      notify()
    },

    setProblemView(view: ProblemView | null) {
      if (view) {
        logger?.info('runtime.problem_view_activated', 'Problem view activated', {
          taskId: view.taskId,
          attemptId: view.attemptId,
        })
      }
      state = { ...state, problemView: view }
      notify()
    },

    setReviewQueueView(view: ReviewQueueView | null) {
      if (view) {
        logger?.info('runtime.review_queue_view_activated', 'Review queue view activated', {
          totalDue: view.totalDue,
          queueLength: view.queue.length,
        })
      }
      state = { ...state, reviewQueueView: view }
      notify()
    },
  }
}
