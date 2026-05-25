import type { createTrainingRepository, TrainingRepository } from '../../src/modules/training/repository/trainingRepository'
import type { AiMoveServiceDeps } from '../../src/modules/training/ai/aiMoveService'
import type { AiMovePending } from '../../src/modules/training/store/trainingRuntimeStore'
import type { WorkbenchFlowServiceDeps } from '../../src/modules/training/workbench/workbenchFlowService'
import type {
  BadMove,
  MoveComment,
  MoveEvaluation,
  RecallAttempt,
  RecallCheckpoint,
  RecallSession,
  TrainingAttempt,
  TrainingAttemptResult,
  TrainingTask,
} from '../../src/modules/training/types'

type TrainingRepositoryDb = Parameters<typeof createTrainingRepository>[0]
type FrozenAttemptDb = Pick<
  TrainingRepositoryDb,
  'loadTrainingAttempt' | 'updateTrainingAttempt'
> & {
  calls: Array<{id: string; patch: Partial<TrainingAttempt>}>
}

type CallRecord = [string, ...unknown[]]

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function requireRecord<T>(map: Record<string, T>, id: string, name: string): T {
  const record = map[id]
  if (!record) throw new Error(`${name} not found: ${id}`)
  return record
}

export function createPhase3AiMovePending(overrides: Partial<AiMovePending> = {}): AiMovePending {
  return {
    requestId: 'ai_req_1',
    tabId: 'tab_1',
    attemptId: 'attempt_1',
    mode: 'play',
    positionHash: 'pos_1',
    color: 'white',
    startedAt: '2026-05-25T00:00:00.000Z',
    ...overrides,
  }
}

export function createPhase3FrozenAttemptDb(seed: TrainingAttempt): FrozenAttemptDb {
  let attempt = clone(seed)
  const calls: Array<{id: string; patch: Partial<TrainingAttempt>}> = []

  const db = {
    calls,
    async loadTrainingAttempt(id: string) {
      return attempt && attempt.id === id ? clone(attempt) : null
    },
    async updateTrainingAttempt(id: string, patch: Partial<TrainingAttempt>) {
      calls.push({id, patch: clone(patch)})
      attempt = {...attempt, ...clone(patch)}
    },
  } satisfies FrozenAttemptDb

  return db
}

export function createPhase3AttemptRepository(
  getAttempt: () => TrainingAttempt | null,
): Pick<TrainingRepository, 'loadAttempt'> {
  return {
    async loadAttempt() {
      return getAttempt()
    },
  }
}

export function createPhase3EngineService(
  requestMove: AiMoveServiceDeps['engineService']['requestMove'],
): AiMoveServiceDeps['engineService'] {
  return {
    requestMove,
  }
}

export function createPhase3MutableAttemptRepository(seed: TrainingAttempt | null = null): Pick<
  TrainingRepository,
  'createAttempt' | 'loadAttempt' | 'updateAttempt' | 'createMoveEvaluation' | 'createBadMove'
> & {
  created: TrainingAttempt[]
  updated: Array<{id: string; patch: Partial<TrainingAttempt>}>
  updates: Array<{id: string; patch: Partial<TrainingAttempt>}>
  evaluations: MoveEvaluation[]
  badMoves: BadMove[]
  getAttempt(): TrainingAttempt
} {
  let attempt = seed == null ? null : {...seed}
  const created: TrainingAttempt[] = []
  const updates: Array<{id: string; patch: Partial<TrainingAttempt>}> = []
  const evaluations: MoveEvaluation[] = []
  const badMoves: BadMove[] = []

  return {
    created,
    updated: updates,
    updates,
    evaluations,
    badMoves,
    getAttempt() {
      if (!attempt) throw new Error('attempt not found')
      return {...attempt}
    },
    async createAttempt(input) {
      created.push(clone(input))
      attempt = clone(input)
      return clone(input)
    },
    async loadAttempt() {
      return attempt ? {...attempt} : null
    },
    async updateAttempt(id, patch) {
      if (!attempt) throw new Error(`attempt not found: ${id}`)
      const protectedFields = (['userLine', 'moveActors', 'result', 'status'] as const)
        .filter(field => Object.prototype.hasOwnProperty.call(patch, field))
      if (attempt.status !== 'playing' && protectedFields.length > 0) {
        throw new Error(`frozen Attempt protected fields: ${protectedFields.join(', ')}`)
      }
      updates.push({id, patch})
      attempt = {...attempt, ...patch}
    },
    async createMoveEvaluation(evaluation) {
      evaluations.push(clone(evaluation))
      return clone(evaluation)
    },
    async createBadMove(badMove) {
      badMoves.push(clone(badMove))
      return clone(badMove)
    },
  }
}

export function createPhase3StrictRecallRepository(): Pick<
  TrainingRepository,
  | 'loadAttempt'
  | 'updateAttempt'
  | 'createRecallSession'
  | 'loadRecallSession'
  | 'updateRecallSession'
  | 'createRecallAttempt'
  | 'listRecallAttempts'
  | 'createRecallCheckpoint'
  | 'loadRecallCheckpoint'
  | 'updateRecallCheckpoint'
  | 'listCheckpointsByRecallSession'
  | 'listBadMovesByAttempt'
  | 'loadBadMove'
  | 'updateBadMove'
  | 'listMoveEvaluationsByAttempt'
  | 'createMoveComment'
  | 'getGame'
> & {
  store: {
    attempts: Record<string, TrainingAttempt>
    sessions: Record<string, RecallSession>
    recallAttempts: RecallAttempt[]
    badMoves: BadMove[]
    evaluations: MoveEvaluation[]
    comments: MoveComment[]
    checkpoints: Record<string, RecallCheckpoint>
    games: Record<string, Record<string, unknown>>
  }
  calls: CallRecord[]
} {
  const store = {
    attempts: {} as Record<string, TrainingAttempt>,
    sessions: {} as Record<string, RecallSession>,
    recallAttempts: [] as RecallAttempt[],
    badMoves: [] as BadMove[],
    evaluations: [] as MoveEvaluation[],
    comments: [] as MoveComment[],
    checkpoints: {} as Record<string, RecallCheckpoint>,
    games: {} as Record<string, Record<string, unknown>>,
  }
  const calls: CallRecord[] = []

  return {
    store,
    calls,
    async loadAttempt(id) {
      return clone(store.attempts[id]) || null
    },
    async updateAttempt(id, patch) {
      calls.push(['updateAttempt', id, clone(patch)])
      const current = requireRecord(store.attempts, id, 'attempt')
      store.attempts[id] = {...current, ...clone(patch)}
    },
    async createRecallSession(session) {
      calls.push(['createRecallSession', clone(session)])
      if (store.sessions[session.id]) throw new Error(`duplicate recall session: ${session.id}`)
      store.sessions[session.id] = clone(session)
      return clone(session)
    },
    async loadRecallSession(id) {
      return clone(store.sessions[id]) || null
    },
    async updateRecallSession(id, patch) {
      calls.push(['updateRecallSession', id, clone(patch)])
      const current = requireRecord(store.sessions, id, 'recall session')
      store.sessions[id] = {...current, ...clone(patch)}
    },
    async createRecallAttempt(attempt) {
      calls.push(['createRecallAttempt', clone(attempt)])
      store.recallAttempts.push(clone(attempt))
      return clone(attempt)
    },
    async listRecallAttempts(sessionId) {
      return store.recallAttempts.filter(a => a.recallSessionId === sessionId).map(clone)
    },
    async createRecallCheckpoint(checkpoint) {
      calls.push(['createRecallCheckpoint', clone(checkpoint)])
      if (store.checkpoints[checkpoint.id]) throw new Error(`duplicate checkpoint: ${checkpoint.id}`)
      store.checkpoints[checkpoint.id] = clone(checkpoint)
      return clone(checkpoint)
    },
    async loadRecallCheckpoint(id) {
      return clone(store.checkpoints[id]) || null
    },
    async updateRecallCheckpoint(id, patch) {
      calls.push(['updateRecallCheckpoint', id, clone(patch)])
      const current = requireRecord(store.checkpoints, id, 'recall checkpoint')
      store.checkpoints[id] = {...current, ...clone(patch)}
    },
    async listCheckpointsByRecallSession(sessionId) {
      return Object.values(store.checkpoints).filter(c => c.recallSessionId === sessionId).map(clone)
    },
    async listBadMovesByAttempt(attemptId) {
      return store.badMoves.filter(bm => bm.attemptId === attemptId).map(clone)
    },
    async loadBadMove(id) {
      return clone(store.badMoves.find(bm => bm.id === id)) || null
    },
    async updateBadMove(badMoveId, patch) {
      calls.push(['updateBadMove', badMoveId, clone(patch)])
      const bm = store.badMoves.find(b => b.id === badMoveId)
      if (!bm) throw new Error(`bad move not found: ${badMoveId}`)
      Object.assign(bm, clone(patch))
    },
    async listMoveEvaluationsByAttempt(attemptId) {
      return store.evaluations.filter(ev => ev.attemptId === attemptId).map(clone)
    },
    async createMoveComment(comment) {
      calls.push(['createMoveComment', clone(comment)])
      store.comments.push(clone(comment))
      return clone(comment)
    },
    async getGame(id) {
      return clone(store.games[id]) || null
    },
  }
}

export function seedPhase3RecallAttempt(
  repo: ReturnType<typeof createPhase3StrictRecallRepository>,
  overrides: Partial<TrainingAttempt> = {},
): TrainingAttempt {
  const attempt: TrainingAttempt = {
    id: 'attempt_1',
    taskId: 'task_1',
    tabId: 'tab_1',
    startedAt: '2026-01-01T00:00:00.000Z',
    rootPositionSgf: '(;SZ[9])',
    userLine: ['D4', 'Q16', 'C3'],
    status: 'submitted',
    result: 'pending',
    hintLevelUsed: 0,
    recallCompleted: false,
    analysisOpened: false,
    ...overrides,
  }
  repo.store.attempts[attempt.id] = clone(attempt)
  return attempt
}

export function seedPhase3RecallSession(
  repo: ReturnType<typeof createPhase3StrictRecallRepository>,
  overrides: Partial<RecallSession> = {},
): RecallSession {
  const session: RecallSession = {
    id: 'session_1',
    taskId: 'task_1',
    attemptId: 'attempt_1',
    type: 'line_recall',
    source: {kind: 'attempt', attemptId: 'attempt_1'},
    startMove: 0,
    expectedMoves: ['D4', 'Q16', 'C3'],
    currentMoveIndex: 0,
    completed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  repo.store.sessions[session.id] = clone(session)
  return session
}

export function seedPhase3BadMove(
  repo: ReturnType<typeof createPhase3StrictRecallRepository>,
  overrides: Partial<BadMove> = {},
): BadMove {
  const badMove: BadMove = {
    id: 'bm_1',
    moveEvaluationId: 'eval_1',
    attemptId: 'attempt_1',
    taskId: 'task_1',
    moveIndex: 1,
    severity: 'major',
    punishSide: 'black',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  repo.store.badMoves.push(clone(badMove))
  return badMove
}

export function seedPhase3Checkpoint(
  repo: ReturnType<typeof createPhase3StrictRecallRepository>,
  overrides: Partial<RecallCheckpoint> = {},
): RecallCheckpoint {
  const checkpoint: RecallCheckpoint = {
    id: 'cp_1',
    recallSessionId: 'session_1',
    badMoveId: 'bm_1',
    status: 'pending_correction',
    userCorrectionLine: [],
    aiCandidateLines: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  repo.store.checkpoints[checkpoint.id] = clone(checkpoint)
  return checkpoint
}

export function createPhase3SubmitOrderDeps(input: {
  makeDeps(overrides?: Record<string, unknown>): WorkbenchFlowServiceDeps & Record<string, unknown>
}): WorkbenchFlowServiceDeps & Record<string, unknown> {
  const order: string[] = []
  const repository = {
    async loadTask(id: string) {
      return {
        id,
        rootPositionSgf: '(;SZ[19])',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
    },
    async createTask(task: TrainingTask) {
      return task
    },
    async transaction<T>(fn: () => Promise<T>) {
      return fn()
    },
    async listMoveEvaluationsByAttempt(_attemptId: string) {
      return []
    },
    async listBadMovesByAttempt(_attemptId: string) {
      return []
    },
  } satisfies Pick<
    TrainingRepository,
    | 'loadTask'
    | 'createTask'
    | 'transaction'
    | 'listMoveEvaluationsByAttempt'
    | 'listBadMovesByAttempt'
  >
  const deps = input.makeDeps({
    repository,
    attemptService: {
      async createAttempt(attemptInput: {taskId: string; tabId: string; rootPositionSgf: string}) {
        return {id: 'attempt_1', ...attemptInput}
      },
      async finalizeAttemptResult(_attemptId: string, _result: TrainingAttemptResult) {
        order.push('finalize')
      },
      async freezeAttempt(_attemptId: string) {
        order.push('freeze')
      },
    },
    recallService: {
      async completeRecall() {},
      async createRecallSession(recallInput: Record<string, unknown>) {
        order.push('recall')
        return {id: 'rs_1', ...recallInput}
      },
    },
  })
  return Object.assign(deps, {phase3Order: order})
}
