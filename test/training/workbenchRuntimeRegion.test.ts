import assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

import {createRecallCheckpointService} from '../../src/modules/training/recall/recallCheckpointService.ts'
import {createRecallService} from '../../src/modules/training/recall/recallService.ts'
import type {TrainingRepository} from '../../src/modules/training/repository/trainingRepository'
import {createTrainingRuntimeStore} from '../../src/modules/training/store/trainingRuntimeStore.ts'
import type {
  ProblemView,
  RecallView,
  TrainingRuntimeStore,
} from '../../src/modules/training/store/trainingRuntimeStore'
import {createWorkbenchStore} from '../../src/modules/training/store/workbenchStore.ts'
import type {
  BadMove,
  MoveComment,
  MoveEvaluation,
  Problem,
  RecallAttempt,
  RecallCheckpoint,
  RecallSession,
  ReviewSchedule,
  TrainingAttempt,
  TrainingTask,
  WorkbenchTab,
} from '../../src/modules/training/types'
import type {ProblemFlowService} from '../../src/modules/training/problem/problemFlowService'
import type {
  WorkbenchFlowServiceDeps,
  WorkbenchModeEffects,
} from '../../src/modules/training/workbench/workbenchFlowService'
import {createTestLogger} from '../helpers/createTestLogger.ts'

const {
  createWorkbenchFlowService,
} = require('../../src/modules/training/workbench/workbenchFlowService.ts')

const NOW = '2026-05-27T00:00:00.000Z'

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function makeTask(overrides: Partial<TrainingTask> = {}): TrainingTask {
  return {
    id: 'task_1',
    rootPositionSgf: '(;SZ[19])',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeAttempt(overrides: Partial<TrainingAttempt> = {}): TrainingAttempt {
  return {
    id: 'attempt_1',
    taskId: 'task_1',
    tabId: 'tab_1',
    startedAt: NOW,
    rootPositionSgf: '(;SZ[19])',
    userLine: ['dd', 'qq'],
    status: 'playing',
    result: 'pending',
    hintLevelUsed: 0,
    recallCompleted: false,
    analysisOpened: false,
    ...overrides,
  }
}

function makeSession(overrides: Partial<RecallSession> = {}): RecallSession {
  return {
    id: 'rs_1',
    taskId: 'task_1',
    tabId: 'tab_1',
    attemptId: 'attempt_1',
    type: 'line_recall',
    source: {kind: 'attempt', attemptId: 'attempt_1'},
    expectedMoves: ['dd', 'qq'],
    currentMoveIndex: 0,
    completed: false,
    createdAt: NOW,
    ...overrides,
  }
}

function makeCheckpoint(overrides: Partial<RecallCheckpoint> = {}): RecallCheckpoint {
  return {
    id: 'cp_1',
    recallSessionId: 'rs_1',
    badMoveId: 'bm_1',
    status: 'pending_correction',
    userCorrectionLine: [],
    aiCandidateLines: [],
    createdAt: NOW,
    ...overrides,
  }
}

function makeProblemView(overrides: Partial<ProblemView> = {}): ProblemView {
  return {
    taskId: 'task_1',
    tabId: 'tab_1',
    attemptId: 'attempt_1',
    legacyProblemSession: null,
    evalCache: [],
    badMoves: [],
    submitted: false,
    result: null,
    ...overrides,
  }
}

function makeRecallView(overrides: Partial<RecallView> = {}): RecallView {
  return {
    recallSessionId: 'rs_1',
    taskId: 'task_1',
    tabId: 'tab_1',
    moveIndex: 0,
    expectedMoves: [
      {sign: 1, vertex: 'dd'},
      {sign: -1, vertex: 'qq'},
    ],
    userAttempts: [],
    showHint: false,
    completed: false,
    ...overrides,
  }
}

function makeTab(overrides: Partial<WorkbenchTab> = {}): WorkbenchTab {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'play',
    childTabIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

type RuntimeRegionRepository = TrainingRepository & {
  calls: {
    updateAttempt: Array<{attemptId: string; patch: Partial<TrainingAttempt>}>
    updateRecallCheckpoint: Array<{checkpointId: string; patch: Partial<RecallCheckpoint>}>
    createMoveComment: MoveComment[]
  }
  data: {
    attempts: Map<string, TrainingAttempt>
    sessions: Map<string, RecallSession>
    checkpoints: Map<string, RecallCheckpoint>
  }
}

function createRuntimeRegionRepository(seed?: {
  tasks?: TrainingTask[]
  attempts?: TrainingAttempt[]
  sessions?: RecallSession[]
  checkpoints?: RecallCheckpoint[]
}): RuntimeRegionRepository {
  const tasks = new Map((seed?.tasks ?? [makeTask()]).map(task => [task.id, clone(task)]))
  const attempts = new Map((seed?.attempts ?? [makeAttempt()]).map(attempt => [attempt.id, clone(attempt)]))
  const sessions = new Map((seed?.sessions ?? []).map(session => [session.id, clone(session)]))
  const checkpoints = new Map((seed?.checkpoints ?? []).map(checkpoint => [checkpoint.id, clone(checkpoint)]))
  const recallAttempts = new Map<string, RecallAttempt[]>()
  const badMoves = new Map<string, BadMove>()
  const comments = new Map<string, MoveComment>()
  const calls = {
    updateAttempt: [] as Array<{attemptId: string; patch: Partial<TrainingAttempt>}>,
    updateRecallCheckpoint: [] as Array<{checkpointId: string; patch: Partial<RecallCheckpoint>}>,
    createMoveComment: [] as MoveComment[],
  }

  const repository: RuntimeRegionRepository = {
    calls,
    data: {attempts, sessions, checkpoints},
    async saveGame(game) { return game },
    async getGame() { return null },
    async getRecentGames() { return [] },
    async saveRecallSession(session) { return session },
    async saveRecallAttempts() {},
    async saveProblem(problem) { return problem },
    async getProblem() { return null },
    async getProblemsByStatus() { return [] },
    async saveProblemAttempt(attempt) { return attempt },
    async saveBadMove(badMove) { return badMove },
    async updateBadMoveGeneratedProblem() {},
    async getDueReviews() { return [] },
    async upsertReviewSchedule() {},
    async getDashboardSummary() { return {} },
    async createTask(task) {
      tasks.set(task.id, clone(task))
      return clone(task)
    },
    async loadTask(taskId) {
      return clone(tasks.get(taskId) ?? null)
    },
    async findTaskBySource() { return null },
    async listTasksByStatus() { return Array.from(tasks.values()).map(clone) },
    async listTasksByOriginProvider() { return [] },
    async updateTask(taskId, patch) {
      const task = tasks.get(taskId)
      if (task) tasks.set(taskId, {...task, ...clone(patch)})
    },
    async createAttempt(attempt) {
      attempts.set(attempt.id, clone(attempt))
      return clone(attempt)
    },
    async loadAttempt(attemptId) {
      return clone(attempts.get(attemptId) ?? null)
    },
    async listAttemptsByTask(taskId) {
      return Array.from(attempts.values())
        .filter(attempt => attempt.taskId === taskId)
        .map(clone)
    },
    async updateAttempt(attemptId, patch) {
      calls.updateAttempt.push({attemptId, patch: clone(patch)})
      const attempt = attempts.get(attemptId)
      if (attempt) attempts.set(attemptId, {...attempt, ...clone(patch)})
    },
    async createMoveEvaluation(evaluation) { return evaluation },
    async updateMoveEvaluation() {},
    async listMoveEvaluationsByAttempt() { return [] },
    async createBadMove(badMove) {
      badMoves.set(badMove.id, clone(badMove))
      return clone(badMove)
    },
    async loadBadMove(badMoveId) {
      return clone(badMoves.get(badMoveId) ?? null)
    },
    async listBadMovesByAttempt(attemptId) {
      return Array.from(badMoves.values())
        .filter(badMove => badMove.attemptId === attemptId)
        .map(clone)
    },
    async listBadMovesByTask() { return [] },
    async markBadMoveAsNotBad() {},
    async updateBadMove(badMoveId, patch) {
      const badMove = badMoves.get(badMoveId)
      if (badMove) badMoves.set(badMoveId, {...badMove, ...clone(patch)})
    },
    async createRecallSession(session) {
      const saved = {
        ...session,
        id: session.id || `rs_${sessions.size + 1}`,
      }
      sessions.set(saved.id, clone(saved))
      return clone(saved)
    },
    async loadRecallSession(sessionId) {
      return clone(sessions.get(sessionId) ?? null)
    },
    async updateRecallSession(sessionId, patch) {
      const session = sessions.get(sessionId)
      if (session) sessions.set(sessionId, {...session, ...clone(patch)})
    },
    async createRecallAttempt(attempt) {
      const list = recallAttempts.get(attempt.recallSessionId) ?? []
      recallAttempts.set(attempt.recallSessionId, [...list, clone(attempt)])
      return clone(attempt)
    },
    async listRecallAttempts(sessionId) {
      return (recallAttempts.get(sessionId) ?? []).map(clone)
    },
    async createRecallCheckpoint(checkpoint) {
      checkpoints.set(checkpoint.id, clone(checkpoint))
      return clone(checkpoint)
    },
    async loadRecallCheckpoint(checkpointId) {
      return clone(checkpoints.get(checkpointId) ?? null)
    },
    async updateRecallCheckpoint(checkpointId, patch) {
      calls.updateRecallCheckpoint.push({checkpointId, patch: clone(patch)})
      const checkpoint = checkpoints.get(checkpointId)
      if (checkpoint) checkpoints.set(checkpointId, {...checkpoint, ...clone(patch)})
    },
    async listCheckpointsByRecallSession(sessionId) {
      return Array.from(checkpoints.values())
        .filter(checkpoint => checkpoint.recallSessionId === sessionId)
        .map(clone)
    },
    async createProblem(problem) { return problem },
    async loadProblem() { return null },
    async updateProblem() {},
    async archiveProblem() {},
    async createMoveComment(comment) {
      comments.set(comment.id, clone(comment))
      calls.createMoveComment.push(clone(comment))
      return clone(comment)
    },
    async loadMoveComment(commentId) {
      return clone(comments.get(commentId) ?? null)
    },
    async updateMoveComment(commentId, patch) {
      const comment = comments.get(commentId)
      if (comment) comments.set(commentId, {...comment, ...clone(patch)})
    },
    async createReviewSchedule(schedule) { return schedule },
    async findReviewScheduleByItem() { return null },
    async findReviewScheduleByTask() { return null },
    async listDueReviewItems() { return [] },
    async updateReviewSchedule() {},
    async listIncompleteAttempts() { return [] },
    async listIncompleteRecallSessions() { return [] },
    async listExpiredPendingMoveEvaluations() { return [] },
    async transaction(fn) { return fn() },
  }

  return repository
}

function createNoopModeEffects(): WorkbenchModeEffects {
  return {
    enterAnalysis() {},
    exitAnalysis() {},
  }
}

function createHarness(options: {
  runtimeStore?: TrainingRuntimeStore
  repository?: RuntimeRegionRepository
  recallService?: WorkbenchFlowServiceDeps['recallService']
  problemFlowService?: ProblemFlowService
} = {}) {
  const workbenchStore = createWorkbenchStore()
  const runtimeStore = options.runtimeStore ?? createTrainingRuntimeStore()
  const repository = options.repository ?? createRuntimeRegionRepository()
  const checkpointService = createRecallCheckpointService({
    repository,
    runtimeStore,
  })
  const recallService = options.recallService ?? createRecallService({
    repository,
    runtimeStore,
    checkpointService,
  })
  const {logger} = createTestLogger()
  const service = createWorkbenchFlowService({
    workbenchStore,
    repository,
    runtimeStore,
    recallCheckpointService: checkpointService,
    recallService,
    problemFlowService: options.problemFlowService,
    attemptService: {
      async createAttempt(input) {
        const attempt = makeAttempt({
          id: `attempt_${repository.data.attempts.size + 1}`,
          taskId: input.taskId,
          tabId: input.tabId,
          rootPositionSgf: input.rootPositionSgf,
        })
        repository.data.attempts.set(attempt.id, clone(attempt))
        return {id: attempt.id}
      },
      async freezeAttempt(attemptId) {
        const attempt = repository.data.attempts.get(attemptId)
        if (attempt) repository.data.attempts.set(attemptId, {...attempt, status: 'submitted'})
      },
      async finalizeAttemptResult(attemptId, result) {
        const attempt = repository.data.attempts.get(attemptId)
        if (attempt) repository.data.attempts.set(attemptId, {...attempt, result})
      },
    },
    snapshotService: {
      async captureSnapshotInput() {
        return {
          sourceTaskId: 'task_1',
          positionSgf: '(;SZ[19])',
          sideToMove: 'black',
        }
      },
    },
    tabService: {
      async openTask() {
        return makeTab({id: 'tab_snapshot', mode: 'problem'})
      },
    },
    modeEffects: createNoopModeEffects(),
    logger,
  })

  return {service, workbenchStore, runtimeStore, repository}
}

function seedStaleCheckpoint(runtimeStore: TrainingRuntimeStore, checkpointId = 'cp_stale') {
  runtimeStore.setActiveCheckpoint(checkpointId)
  runtimeStore.setCorrectionDraft({
    checkpointId,
    moves: ['pd'],
    source: {
      kind: 'recall-checkpoint',
      recallSessionId: 'rs_old',
      badMoveId: 'bm_old',
      moveIndex: 1,
    },
  })
}

function replaceFunctionBody(source: string, functionName: string): string {
  const match = new RegExp(`(?:async\\s+)?function\\s+${functionName}\\s*\\(`).exec(source)
  if (!match) return source
  const start = match.index

  const paramsStart = source.indexOf('(', start)
  if (paramsStart === -1) return source

  let parenDepth = 0
  let paramsEnd = -1
  for (let index = paramsStart; index < source.length; index++) {
    const char = source[index]
    if (char === '(') parenDepth++
    if (char === ')') parenDepth--
    if (parenDepth === 0) {
      paramsEnd = index
      break
    }
  }
  if (paramsEnd === -1) return source

  const bodyStart = source.indexOf('{', paramsEnd)
  if (bodyStart === -1) return source

  let depth = 0
  for (let index = bodyStart; index < source.length; index++) {
    const char = source[index]
    if (char === '{') depth++
    if (char === '}') depth--
    if (depth === 0) {
      return `${source.slice(0, bodyStart + 1)}/* removed ${functionName} */${source.slice(index)}`
    }
  }

  return source
}

function replaceFunctionBodies(source: string, functionNames: string[]): string {
  return functionNames.reduce(
    (nextSource, functionName) => replaceFunctionBody(nextSource, functionName),
    source,
  )
}

function assertNoDirectRuntimeSetterCalls(
  label: string,
  source: string,
  setters: string[],
) {
  for (const setter of setters) {
    assert.strictEqual(
      source.includes(setter),
      false,
      `${label} must not reference ${setter}; route cleanup through runtime region port`,
    )
    assert.doesNotMatch(
      source,
      new RegExp(`(?:runtimeStore|deps\\.runtimeStore)\\s*\\??\\.\\s*${setter}\\s*\\(`),
      `${label} must not call ${setter} directly through runtimeStore`,
    )
    assert.doesNotMatch(
      source,
      new RegExp(`(?:runtimeStore|deps\\.runtimeStore)\\s*(?:\\?\\.\\s*)?\\[\\s*['"]${setter}['"]\\s*\\]\\s*\\(`),
      `${label} must not call ${setter} through bracket runtimeStore access`,
    )
    assert.doesNotMatch(
      source,
      new RegExp(`(?:const|let|var)\\s*\\{[^}]*\\b${setter}\\b(?:\\s*:\\s*\\w+)?[^}]*\\}\\s*=\\s*(?:deps\\.)?runtimeStore\\b`),
      `${label} must not destructure ${setter} from runtimeStore`,
    )
    assert.doesNotMatch(
      source,
      new RegExp(`(?:const|let|var)?\\s*\\w+\\s*=\\s*(?:deps\\.)?runtimeStore\\s*(?:\\?\\.\\s*)?(?:\\.\\s*${setter}|\\[\\s*['"]${setter}['"]\\s*\\])(?:\\.bind\\s*\\()?`),
      `${label} must not alias ${setter} from runtimeStore`,
    )
  }
}

function assertNoCheckpointCleanupSetterCalls(label: string, source: string) {
  assert.doesNotMatch(
    source,
    /(?:runtimeStore|deps\.runtimeStore)\s*\??\.\s*setActiveCheckpoint\s*\(\s*(?:undefined|void\s+0|null)?\s*\)/,
    `${label} must not clear active checkpoint directly`,
  )
  assert.doesNotMatch(
    source,
    /(?:runtimeStore|deps\.runtimeStore)\s*(?:\?\.\s*)?\[\s*['"]setActiveCheckpoint['"]\s*\]\s*\(\s*(?:undefined|void\s+0|null)?\s*\)/,
    `${label} must not clear active checkpoint through bracket access`,
  )
  assert.doesNotMatch(
    source,
    /\bsetActiveCheckpoint\s*\(\s*(?:undefined|void\s+0|null)?\s*\)/,
    `${label} must not clear active checkpoint through destructured setter`,
  )
  assertNoDirectRuntimeSetterCalls(label, source, [
    'setCorrectionDraft',
    'clearCorrectionDraft',
  ])
}

describe('workbench runtime region transition contract', () => {
  it('RTM-T01 play submit activates recall runtime and clears stale problem/checkpoint runtime after success', async () => {
    const runtimeStore = createTrainingRuntimeStore()
    runtimeStore.setProblemView(makeProblemView({attemptId: 'old_problem_attempt'}))
    seedStaleCheckpoint(runtimeStore)
    const {service, workbenchStore} = createHarness({runtimeStore})
    workbenchStore.addTab(makeTab({
      mode: 'play',
      activeAttemptId: 'attempt_1',
    }))

    await service.submit('tab_1')

    const tab = workbenchStore.getState().tabs[0]
    const runtime = runtimeStore.getState()
    assert.strictEqual(tab.mode, 'recall')
    assert.strictEqual(runtime.activeRecallSessionId, tab.activeRecallSessionId)
    assert.ok(runtime.recallView)
    assert.strictEqual(runtime.recallView.recallSessionId, tab.activeRecallSessionId)
    assert.strictEqual(runtime.problemView, null)
    assert.strictEqual(runtime.activeCheckpointId, undefined)
    assert.strictEqual(runtime.correctionDraft, undefined)
  })

  it('RTM-T02 problem submit clears problem runtime and checkpoint transients only after successful recall creation', async () => {
    const runtimeStore = createTrainingRuntimeStore()
    const attempt = makeAttempt({id: 'attempt_problem', userLine: ['dp', 'pp']})
    const repository = createRuntimeRegionRepository({attempts: [attempt]})
    runtimeStore.setProblemView(makeProblemView({attemptId: attempt.id}))
    seedStaleCheckpoint(runtimeStore)
    const problemFlowService: ProblemFlowService = {
      async appendProblemMove() { return null },
      async undoProblemMove() { return null },
      async abandonActiveProblem() { return null },
      async submitActiveProblem() {
        return {
          attempt,
          result: 'pass',
          generatedPunishmentProblemIds: [],
        }
      },
    }
    const {service, workbenchStore} = createHarness({
      runtimeStore,
      repository,
      problemFlowService,
    })
    workbenchStore.addTab(makeTab({
      mode: 'problem',
      activeAttemptId: attempt.id,
    }))

    await service.submit('tab_1')

    const tab = workbenchStore.getState().tabs[0]
    const runtime = runtimeStore.getState()
    assert.strictEqual(tab.mode, 'recall')
    assert.strictEqual(runtime.problemView, null)
    assert.strictEqual(runtime.activeRecallSessionId, tab.activeRecallSessionId)
    assert.ok(runtime.recallView)
    assert.strictEqual(runtime.activeCheckpointId, undefined)
    assert.strictEqual(runtime.correctionDraft, undefined)
  })

  it('RTM-T03 enterRecall activates recall runtime and removes stale problem/checkpoint state', async () => {
    const runtimeStore = createTrainingRuntimeStore()
    runtimeStore.setProblemView(makeProblemView())
    seedStaleCheckpoint(runtimeStore)
    const {service, workbenchStore} = createHarness({runtimeStore})
    workbenchStore.addTab(makeTab({mode: 'play'}))

    const session = await service.enterRecall({
      tabId: 'tab_1',
      attemptId: 'attempt_1',
    })

    const runtime = runtimeStore.getState()
    assert.strictEqual(workbenchStore.getState().tabs[0].mode, 'recall')
    assert.strictEqual(runtime.activeRecallSessionId, session.id)
    assert.ok(runtime.recallView)
    assert.strictEqual(runtime.problemView, null)
    assert.strictEqual(runtime.activeCheckpointId, undefined)
    assert.strictEqual(runtime.correctionDraft, undefined)
  })

  it('RTM-T04 completeRecall clears completed recall runtime while transitioning to analysis', () => {
    const runtimeStore = createTrainingRuntimeStore()
    runtimeStore.setActiveRecallSession('rs_1')
    runtimeStore.setRecallView(makeRecallView())
    seedStaleCheckpoint(runtimeStore, 'cp_1')
    const {service, workbenchStore} = createHarness({
      runtimeStore,
      recallService: {
        async completeRecall() {},
      },
    })
    workbenchStore.addTab(makeTab({
      mode: 'recall',
      recallSubstate: 'normal',
      activeRecallSessionId: 'rs_1',
    }))

    service.completeRecall('tab_1')

    const runtime = runtimeStore.getState()
    assert.strictEqual(workbenchStore.getState().tabs[0].mode, 'analysis')
    assert.strictEqual(runtime.recallView, null)
    assert.strictEqual(runtime.activeRecallSessionId, undefined)
    assert.strictEqual(runtime.activeCheckpointId, undefined)
    assert.strictEqual(runtime.correctionDraft, undefined)
  })

  it('RTM-T05 skipCheckpoint clears checkpoint runtime, keeps recall active, and does not write protected attempt fields', async () => {
    const runtimeStore = createTrainingRuntimeStore()
    runtimeStore.setActiveRecallSession('rs_1')
    runtimeStore.setRecallView(makeRecallView())
    runtimeStore.setActiveCheckpoint('cp_1')
    runtimeStore.setCorrectionDraft({
      checkpointId: 'cp_1',
      moves: ['qq'],
      source: {kind: 'recall-checkpoint', recallSessionId: 'rs_1', badMoveId: 'bm_1'},
    })
    const session = makeSession({id: 'rs_1', currentMoveIndex: 0})
    const repository = createRuntimeRegionRepository({
      attempts: [makeAttempt({id: 'attempt_1'})],
      sessions: [session],
      checkpoints: [makeCheckpoint({id: 'cp_1', recallSessionId: session.id})],
    })
    const {service, workbenchStore} = createHarness({runtimeStore, repository})
    workbenchStore.addTab(makeTab({
      mode: 'recall',
      recallSubstate: 'checkpoint',
      activeRecallSessionId: session.id,
    }))

    await service.skipCheckpoint('tab_1')

    const runtime = runtimeStore.getState()
    assert.strictEqual(workbenchStore.getState().tabs[0].mode, 'recall')
    assert.strictEqual(workbenchStore.getState().tabs[0].recallSubstate, 'normal')
    assert.strictEqual(runtime.activeRecallSessionId, session.id)
    assert.ok(runtime.recallView)
    assert.strictEqual(runtime.activeCheckpointId, undefined)
    assert.strictEqual(runtime.correctionDraft, undefined)
    assert.strictEqual(repository.calls.updateAttempt.length, 0)
    assert.strictEqual(
      repository.calls.updateRecallCheckpoint[0].patch.status,
      'skipped',
    )
  })

  it('RTM-T06 temporary analysis preserves problem and recall source runtime fields', () => {
    const problemRuntimeStore = createTrainingRuntimeStore()
    const problemView = makeProblemView()
    problemRuntimeStore.setProblemView(problemView)
    const problemHarness = createHarness({runtimeStore: problemRuntimeStore})
    problemHarness.workbenchStore.addTab(makeTab({mode: 'problem', activeAttemptId: 'attempt_1'}))

    problemHarness.service.enterAnalysis('tab_1', {reason: 'manual'})
    problemHarness.service.returnFromAnalysis({tabId: 'tab_1', reason: 'return'})

    assert.deepStrictEqual(problemRuntimeStore.getState().problemView, problemView)

    const recallRuntimeStore = createTrainingRuntimeStore()
    const recallView = makeRecallView({recallSessionId: 'rs_active'})
    recallRuntimeStore.setActiveRecallSession('rs_active')
    recallRuntimeStore.setRecallView(recallView)
    const recallHarness = createHarness({runtimeStore: recallRuntimeStore})
    recallHarness.workbenchStore.addTab(makeTab({
      mode: 'recall',
      recallSubstate: 'normal',
      activeRecallSessionId: 'rs_active',
    }))

    recallHarness.service.enterAnalysis('tab_1', {reason: 'manual'})
    recallHarness.service.returnFromAnalysis({tabId: 'tab_1', reason: 'return'})

    assert.deepStrictEqual(recallRuntimeStore.getState().recallView, recallView)
    assert.strictEqual(recallRuntimeStore.getState().activeRecallSessionId, 'rs_active')
  })

  it('RTM-T07 invalid transitions reject without changing tab or runtime snapshots', () => {
    const runtimeStore = createTrainingRuntimeStore()
    runtimeStore.setProblemView(makeProblemView())
    seedStaleCheckpoint(runtimeStore)
    const {service, workbenchStore} = createHarness({runtimeStore})
    workbenchStore.addTab(makeTab({mode: 'play', activeAttemptId: 'attempt_1'}))
    const tabBefore = clone(workbenchStore.getState().tabs[0])
    const runtimeBefore = clone(runtimeStore.getState())

    assert.throws(
      () => service.completeRecall('tab_1'),
      /Invalid mode transition/,
    )

    assert.deepStrictEqual(workbenchStore.getState().tabs[0], tabBefore)
    assert.deepStrictEqual(runtimeStore.getState(), runtimeBefore)
  })

  it('RTM-T08 submit failure before transition commit preserves source tab and runtime snapshots', async () => {
    const runtimeStore = createTrainingRuntimeStore()
    runtimeStore.setProblemView(makeProblemView())
    seedStaleCheckpoint(runtimeStore)
    const {service, workbenchStore} = createHarness({
      runtimeStore,
      recallService: {
        async completeRecall() {},
        async createRecallFromAttempt() {
          throw new Error('recall creation failed')
        },
      },
    })
    workbenchStore.addTab(makeTab({
      mode: 'play',
      activeAttemptId: 'attempt_1',
    }))
    const tabBefore = clone(workbenchStore.getState().tabs[0])
    const runtimeBefore = clone(runtimeStore.getState())

    await assert.rejects(
      () => service.submit('tab_1'),
      /recall creation failed/,
    )

    assert.deepStrictEqual(workbenchStore.getState().tabs[0], tabBefore)
    assert.deepStrictEqual(runtimeStore.getState(), runtimeBefore)
  })

  it('RTM-T09 runtimeStore subscribers observe the owner-driven cleaned recall runtime snapshot', async () => {
    const runtimeStore = createTrainingRuntimeStore()
    runtimeStore.setProblemView(makeProblemView())
    seedStaleCheckpoint(runtimeStore)
    const observed: Array<ReturnType<TrainingRuntimeStore['getState']>> = []
    const unsubscribe = runtimeStore.subscribe(() => {
      observed.push(clone(runtimeStore.getState()))
    })
    const {service, workbenchStore} = createHarness({runtimeStore})
    workbenchStore.addTab(makeTab({
      mode: 'play',
      activeAttemptId: 'attempt_1',
    }))

    await service.submit('tab_1')
    unsubscribe()

    const tab = workbenchStore.getState().tabs[0]
    assert.ok(observed.some(snapshot =>
      snapshot.activeRecallSessionId === tab.activeRecallSessionId &&
      snapshot.recallView?.recallSessionId === tab.activeRecallSessionId &&
      snapshot.problemView === null &&
      snapshot.activeCheckpointId === undefined &&
      snapshot.correctionDraft === undefined,
    ))
  })

  it('RTM-T10 runtime region owns transition cleanup without importing parent writers or forbidden side effects', () => {
    const flowSource = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/training/workbench/workbenchFlowService.ts'),
      'utf8',
    )
    const flowCleanupSource = replaceFunctionBodies(flowSource, [
      'showRecallHint',
      'skipRecallMove',
    ])
    assert.match(flowSource, /runtimeRegion\.onPlayActivated\s*\(/)
    assert.match(flowSource, /runtimeRegion\.onProblemActivated\s*\(/)
    assert.match(flowSource, /runtimeRegion\.onRecallActivated\s*\(/)
    assert.match(flowSource, /runtimeRegion\.onRecallCompleted\s*\(/)
    assert.match(flowSource, /runtimeRegion\.onCheckpointResumed\s*\(/)
    assertNoDirectRuntimeSetterCalls(
      'workbenchFlowService transition cleanup paths',
      flowCleanupSource,
      [
        'setProblemView',
        'setActiveRecallSession',
        'setRecallView',
        'setActiveCheckpoint',
        'setCorrectionDraft',
        'clearCorrectionDraft',
      ],
    )

    const checkpointSource = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/training/recall/recallCheckpointService.ts'),
      'utf8',
    )
    const checkpointCleanupSource = replaceFunctionBodies(checkpointSource, [
      'refreshRecallView',
      'startCheckpoint',
      'submitUserCorrectionLine',
      'shouldTriggerCheckpoint',
      'revealAiCandidateLines',
      'saveComment',
    ])
    assertNoCheckpointCleanupSetterCalls(
      'recallCheckpointService resume/skip cleanup paths',
      checkpointCleanupSource,
    )

    const runtimeRegionPath = path.join(
      process.cwd(),
      'src/modules/training/workbench/workbenchRuntimeRegion.ts',
    )
    assert.ok(
      fs.existsSync(runtimeRegionPath),
      'runtime region owner module must exist',
    )
    const ownerSource = fs.readFileSync(runtimeRegionPath, 'utf8')
    const runtimeRegionModule = require('../../src/modules/training/workbench/workbenchRuntimeRegion.ts')
    assert.strictEqual(
      typeof runtimeRegionModule.createWorkbenchRuntimeRegion,
      'function',
      'runtime region module must export createWorkbenchRuntimeRegion factory',
    )
    assert.match(ownerSource, /WorkbenchRuntimeRegion/)
    assert.match(ownerSource, /onPlayActivated/)
    assert.match(ownerSource, /onProblemActivated/)
    assert.match(ownerSource, /onRecallActivated/)
    assert.match(ownerSource, /onRecallCompleted/)
    assert.match(ownerSource, /onCheckpointResumed/)
    assert.doesNotMatch(ownerSource, /workbenchStore|workbenchFlowService|window\.sabaki/)
    assert.doesNotMatch(ownerSource, /repository|snapshotService|tabService/)
    assert.doesNotMatch(ownerSource, /components|overlays|engine|scratch/)
  })
})
