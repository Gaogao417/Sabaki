import assert from 'assert'

import {createAttemptService} from '../../src/modules/training/attempt/attemptService.ts'
import {createProblemFlowService} from '../../src/modules/training/problem/problemFlowService.ts'
import {createRecallCheckpointService} from '../../src/modules/training/recall/recallCheckpointService.ts'
import {createRecallService} from '../../src/modules/training/recall/recallService.ts'
import {createReviewService} from '../../src/modules/training/review/reviewService.ts'
import {createTrainingRuntimeStore} from '../../src/modules/training/store/trainingRuntimeStore.ts'
import {createWorkbenchStore} from '../../src/modules/training/store/workbenchStore.ts'
import {createBoardInteractionController} from '../../src/modules/training/workbench/boardInteractionController.ts'
import {createWorkbenchFlowService} from '../../src/modules/training/workbench/workbenchFlowService.ts'
import {createWorkbenchTabService} from '../../src/modules/training/workbench/workbenchTabService.ts'

const NOW = '2026-05-26T00:00:00.000Z'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function makeTask(overrides = {}) {
  return {
    id: 'task_1',
    rootPositionSgf: '(;GM[1]FF[4]SZ[19])',
    sideToMove: 'black',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeTab(overrides = {}) {
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

function createBoard() {
  return {
    width: 19,
    height: 19,
    get: () => 0,
    markers: Array.from({length: 19}, () => Array(19).fill(null)),
  }
}

function createSmokeRepository(seed = {}) {
  const store = {
    tasks: {
      task_free: makeTask({id: 'task_free'}),
      task_problem: makeTask({
        id: 'task_problem',
        prompt: 'Find the best continuation.',
        goal: 'Keep sente.',
        passRule: {kind: 'manual'},
        referenceLines: [{label: 'main', moves: ['dd']}],
      }),
      ...(seed.tasks ?? {}),
    },
    attempts: {...(seed.attempts ?? {})},
    sessions: {...(seed.sessions ?? {})},
    recallAttempts: [...(seed.recallAttempts ?? [])],
    checkpoints: {...(seed.checkpoints ?? {})},
    badMoves: [...(seed.badMoves ?? [])],
    evaluations: [...(seed.evaluations ?? [])],
    comments: [...(seed.comments ?? [])],
    schedules: {...(seed.schedules ?? {})},
    games: {...(seed.games ?? {})},
  }
  const calls = []

  return {
    store,
    calls,

    async loadTask(taskId) {
      return clone(store.tasks[taskId]) ?? null
    },
    async createTask(task) {
      calls.push(['createTask', task.id])
      store.tasks[task.id] = clone(task)
      return clone(task)
    },
    async transaction(fn) {
      return fn()
    },

    async createAttempt(attempt) {
      calls.push(['createAttempt', attempt.id])
      store.attempts[attempt.id] = clone(attempt)
      return clone(attempt)
    },
    async loadAttempt(attemptId) {
      return clone(store.attempts[attemptId]) ?? null
    },
    async updateAttempt(attemptId, patch) {
      calls.push(['updateAttempt', attemptId, clone(patch)])
      const attempt = store.attempts[attemptId]
      if (!attempt) throw new Error(`attempt not found: ${attemptId}`)
      const protectedFields = ['userLine', 'moveActors', 'result', 'status']
        .filter(field => Object.prototype.hasOwnProperty.call(patch, field))
      if (attempt.status !== 'playing' && protectedFields.length > 0) {
        throw new Error(`frozen Attempt protected fields: ${protectedFields.join(', ')}`)
      }
      store.attempts[attemptId] = {...attempt, ...clone(patch)}
    },

    async createMoveEvaluation(evaluation) {
      calls.push(['createMoveEvaluation', evaluation.id])
      store.evaluations.push(clone(evaluation))
      return clone(evaluation)
    },
    async listMoveEvaluationsByAttempt(attemptId) {
      return store.evaluations
        .filter(evaluation => evaluation.attemptId === attemptId)
        .map(clone)
    },
    async createBadMove(badMove) {
      calls.push(['createBadMove', badMove.id])
      store.badMoves.push(clone(badMove))
      return clone(badMove)
    },
    async listBadMovesByAttempt(attemptId) {
      return store.badMoves
        .filter(badMove => badMove.attemptId === attemptId)
        .map(clone)
    },
    async loadBadMove(badMoveId) {
      return clone(store.badMoves.find(badMove => badMove.id === badMoveId)) ?? null
    },
    async updateBadMove(badMoveId, patch) {
      calls.push(['updateBadMove', badMoveId, clone(patch)])
      const badMove = store.badMoves.find(item => item.id === badMoveId)
      if (!badMove) throw new Error(`bad move not found: ${badMoveId}`)
      Object.assign(badMove, clone(patch))
    },

    async createRecallSession(session) {
      calls.push(['createRecallSession', session.id])
      store.sessions[session.id] = clone(session)
      return clone(session)
    },
    async loadRecallSession(sessionId) {
      return clone(store.sessions[sessionId]) ?? null
    },
    async updateRecallSession(sessionId, patch) {
      calls.push(['updateRecallSession', sessionId, clone(patch)])
      const session = store.sessions[sessionId]
      if (!session) throw new Error(`recall session not found: ${sessionId}`)
      store.sessions[sessionId] = {...session, ...clone(patch)}
    },
    async createRecallAttempt(attempt) {
      calls.push(['createRecallAttempt', attempt.id])
      store.recallAttempts.push(clone(attempt))
      return clone(attempt)
    },
    async listRecallAttempts(sessionId) {
      return store.recallAttempts
        .filter(attempt => attempt.recallSessionId === sessionId)
        .map(clone)
    },
    async createRecallCheckpoint(checkpoint) {
      calls.push(['createRecallCheckpoint', checkpoint.id])
      store.checkpoints[checkpoint.id] = clone(checkpoint)
      return clone(checkpoint)
    },
    async loadRecallCheckpoint(checkpointId) {
      return clone(store.checkpoints[checkpointId]) ?? null
    },
    async updateRecallCheckpoint(checkpointId, patch) {
      calls.push(['updateRecallCheckpoint', checkpointId, clone(patch)])
      const checkpoint = store.checkpoints[checkpointId]
      if (!checkpoint) throw new Error(`checkpoint not found: ${checkpointId}`)
      store.checkpoints[checkpointId] = {...checkpoint, ...clone(patch)}
    },
    async listCheckpointsByRecallSession(sessionId) {
      return Object.values(store.checkpoints)
        .filter(checkpoint => checkpoint.recallSessionId === sessionId)
        .map(clone)
    },
    async createMoveComment(comment) {
      calls.push(['createMoveComment', comment.id])
      store.comments.push(clone(comment))
      return clone(comment)
    },
    async getGame(gameId) {
      return clone(store.games[gameId]) ?? null
    },

    async listDueReviewItems(now) {
      return Object.values(store.schedules)
        .filter(schedule => new Date(schedule.dueAt) <= new Date(now))
        .map(clone)
    },
    async findReviewScheduleByTask(taskId) {
      return clone(Object.values(store.schedules).find(schedule => schedule.taskId === taskId)) ?? null
    },
    async createReviewSchedule(schedule) {
      calls.push(['createReviewSchedule', schedule.id])
      store.schedules[schedule.id] = clone(schedule)
      return clone(schedule)
    },
    async updateReviewSchedule(scheduleId, patch) {
      calls.push(['updateReviewSchedule', scheduleId, clone(patch)])
      const schedule = store.schedules[scheduleId]
      if (!schedule) throw new Error(`review schedule not found: ${scheduleId}`)
      store.schedules[scheduleId] = {...schedule, ...clone(patch), updatedAt: NOW}
    },
    async listTasksByStatus(status) {
      return Object.values(store.tasks)
        .filter(task => task.status === status)
        .map(clone)
    },
    async listIncompleteAttempts() {
      return Object.values(store.attempts)
        .filter(attempt => attempt.status === 'playing')
        .map(clone)
    },
    async listIncompleteRecallSessions() {
      return Object.values(store.sessions)
        .filter(session => !session.completed)
        .map(clone)
    },
    async listTasksByOriginProvider(provider) {
      return Object.values(store.tasks)
        .filter(task => task.origin?.provider === provider)
        .map(clone)
    },
  }
}

function createLegacyAdapter() {
  return {
    async loadGameTrees() {},
    setCurrentTreePosition() {},
    getSabaki() {
      return {setMode() {}}
    },
    startAnalysisIfEngineReady() {},
  }
}

function createHarness(seed = {}) {
  const repository = createSmokeRepository(seed)
  const workbenchStore = createWorkbenchStore()
  const runtimeStore = createTrainingRuntimeStore()
  const attemptService = createAttemptService({repository, runtimeStore})
  const checkpointService = createRecallCheckpointService({repository, runtimeStore})
  const recallService = createRecallService({
    repository,
    runtimeStore,
    checkpointService,
  })
  const tabService = createWorkbenchTabService({
    workbenchStore,
    repository,
    runtimeStore,
    attemptService,
    monitor: {startForAttempt() {}},
    legacyAdapter: createLegacyAdapter(),
    sgfParser: {parse: () => [{root: {id: 'node_root'}}]},
  })
  const reviewService = createReviewService({
    repository,
    workbenchTabService: tabService,
    runtimeStore,
  })
  const snapshotService = {
    async captureSnapshotInput(input) {
      return {
        sourceTaskId: input?.sourceTaskId,
        sourceAttemptId: input?.sourceAttemptId,
        positionSgf: '(;GM[1]FF[4]SZ[19]AB[dd])',
        sideToMove: 'black',
      }
    },
  }
  const flowService = createWorkbenchFlowService({
    workbenchStore,
    repository,
    attemptService,
    recallService,
    recallCheckpointService: checkpointService,
    snapshotService,
    tabService,
    runtimeStore,
    evaluationRules: {
      evaluateAttempt({badMoves}) {
        if (badMoves.some(move => move.severity === 'severe')) return 'fail'
        if (badMoves.some(move => move.severity === 'major')) return 'soft_pass'
        return 'pass'
      },
    },
  })

  return {
    repository,
    workbenchStore,
    runtimeStore,
    attemptService,
    checkpointService,
    recallService,
    tabService,
    reviewService,
    flowService,
  }
}

async function createTabWithAttempt(harness, input = {}) {
  const taskId = input.taskId ?? 'task_free'
  const tab = makeTab({
    id: input.tabId ?? 'tab_attempt',
    taskId,
    mode: input.mode ?? 'play',
  })
  harness.workbenchStore.addTab(tab)
  harness.workbenchStore.setActiveTab(tab.id)

  const attempt = await harness.attemptService.createAttempt({
    taskId,
    tabId: tab.id,
    rootPositionSgf: harness.repository.store.tasks[taskId].rootPositionSgf,
  })

  for (const move of input.moves ?? []) {
    await harness.attemptService.appendMove(attempt.id, move)
  }

  harness.workbenchStore.updateTab(tab.id, {
    activeAttemptId: attempt.id,
  })

  return {tab, attempt}
}

describe('PRD training smoke tests (service/controller/store)', () => {
  it('opens free tasks in play mode and problem-like tasks in problem mode', async () => {
    const harness = createHarness()

    const freeTab = await harness.tabService.openPlayTab({taskId: 'task_free'})
    const problemTab = await harness.tabService.openProblemTab({taskId: 'task_problem'})

    assert.strictEqual(freeTab.mode, 'play')
    assert.strictEqual(problemTab.mode, 'problem')
    assert.deepStrictEqual(
      harness.workbenchStore.getState().tabs.map(tab => [tab.taskId, tab.mode]),
      [['task_free', 'play'], ['task_problem', 'problem']],
    )
    assert.strictEqual(harness.workbenchStore.getState().activeTabId, problemTab.id)
  })

  it('runs source golden paths for saved games, Fox games, and 101 problems', async () => {
    const tenMoveLine = ['dd', 'qq', 'pd', 'dp', 'cf', 'fc', 'pq', 'qp', 'jj', 'kk']
    const harness = createHarness({
      tasks: {
        task_saved_game: makeTask({
          id: 'task_saved_game',
          title: 'Saved game golden path',
          origin: {provider: 'local', externalId: 'saved-game'},
        }),
        task_fox_yiwoo: makeTask({
          id: 'task_fox_yiwoo',
          title: 'YiWoo Fox golden path',
          origin: {provider: 'fox', externalId: 'YiWoo'},
        }),
        task_101_problem: makeTask({
          id: 'task_101_problem',
          prompt: '101 golden problem',
          sideToMove: 'black',
          origin: {provider: '101', externalId: 'golden-101'},
        }),
      },
    })

    for (const taskId of ['task_saved_game', 'task_fox_yiwoo']) {
      const tab = await harness.tabService.openPlayTab({taskId})
      await harness.flowService.startAttempt(tab.id)
      const activeTab = harness.workbenchStore.getState().tabs.find(item => item.id === tab.id)
      const attemptId = activeTab.activeAttemptId

      for (const move of tenMoveLine) {
        await harness.attemptService.appendMove(attemptId, move)
      }

      await harness.flowService.submit(tab.id)

      const submittedAttempt = harness.repository.store.attempts[attemptId]
      const updatedTab = harness.workbenchStore.getState().tabs.find(item => item.id === tab.id)
      const session = Object.values(harness.repository.store.sessions)
        .find(item => item.attemptId === attemptId)

      assert.strictEqual(submittedAttempt.status, 'submitted')
      assert.strictEqual(updatedTab.mode, 'recall')
      assert.deepStrictEqual(session.expectedMoves, tenMoveLine)
    }

    const problemTab = await harness.tabService.openProblemTab({taskId: 'task_101_problem'})
    assert.strictEqual(problemTab.mode, 'problem')
    const problemAttempt = await harness.attemptService.createAttempt({
      taskId: problemTab.taskId,
      tabId: problemTab.id,
      rootPositionSgf: harness.repository.store.tasks.task_101_problem.rootPositionSgf,
    })
    harness.workbenchStore.updateTab(problemTab.id, {
      activeAttemptId: problemAttempt.id,
    })
    await harness.attemptService.appendMove(problemAttempt.id, 'dd')
    await harness.flowService.submit(problemTab.id)

    const submittedProblemTab = harness.workbenchStore.getState().tabs.find(item => item.id === problemTab.id)
    assert.strictEqual(
      harness.repository.store.attempts[problemAttempt.id].status,
      'submitted',
    )
    assert.strictEqual(submittedProblemTab.mode, 'recall')
  })

  it('submits a play attempt through flowService and writes recall state to stores', async () => {
    const harness = createHarness()
    const {tab, attempt} = await createTabWithAttempt(harness, {
      tabId: 'tab_play',
      taskId: 'task_free',
      mode: 'play',
      moves: ['dd', 'qq'],
    })

    await harness.flowService.submit(tab.id)

    const submittedAttempt = harness.repository.store.attempts[attempt.id]
    const updatedTab = harness.workbenchStore.getState().tabs.find(item => item.id === tab.id)
    const session = Object.values(harness.repository.store.sessions)[0]

    assert.strictEqual(submittedAttempt.status, 'submitted')
    assert.strictEqual(submittedAttempt.result, 'pass')
    assert.deepStrictEqual(session.expectedMoves, ['dd', 'qq'])
    assert.strictEqual(updatedTab.mode, 'recall')
    assert.strictEqual(updatedTab.activeRecallSessionId, session.id)
    assert.strictEqual(harness.runtimeStore.getState().activeRecallSessionId, session.id)
  })

  it('submits a problem attempt through the same flow path and enters recall', async () => {
    const harness = createHarness()
    const {tab, attempt} = await createTabWithAttempt(harness, {
      tabId: 'tab_problem',
      taskId: 'task_problem',
      mode: 'problem',
      moves: ['dd'],
    })

    await harness.flowService.submit(tab.id)

    const updatedTab = harness.workbenchStore.getState().tabs.find(item => item.id === tab.id)
    const session = Object.values(harness.repository.store.sessions)[0]

    assert.strictEqual(harness.repository.store.attempts[attempt.id].status, 'submitted')
    assert.strictEqual(updatedTab.mode, 'recall')
    assert.strictEqual(updatedTab.recallSubstate, 'normal')
    assert.strictEqual(session.attemptId, attempt.id)
    assert.strictEqual(harness.runtimeStore.getState().problemView, null)
  })

  it('checks recall answers and completes recall into analysis mode', async () => {
    const harness = createHarness()
    const {attempt} = await createTabWithAttempt(harness, {
      tabId: 'tab_recall_source',
      taskId: 'task_free',
      mode: 'play',
      moves: ['dd', 'qq'],
    })
    const session = await harness.recallService.createRecallFromAttempt(attempt.id)
    harness.workbenchStore.addTab(makeTab({
      id: 'tab_recall',
      taskId: 'task_free',
      mode: 'recall',
      activeAttemptId: attempt.id,
      activeRecallSessionId: session.id,
    }))

    const wrong = await harness.recallService.submitRecallMove({
      recallSessionId: session.id,
      userMove: 'dp',
    })
    const correct = await harness.recallService.submitRecallMove({
      recallSessionId: session.id,
      userMove: 'dd',
    })
    harness.flowService.completeRecall('tab_recall')
    await new Promise(resolve => setImmediate(resolve))

    const updatedSession = harness.repository.store.sessions[session.id]
    const updatedTab = harness.workbenchStore.getState().tabs.find(tab => tab.id === 'tab_recall')

    assert.strictEqual(wrong.isCorrect, false)
    assert.strictEqual(correct.isCorrect, true)
    assert.strictEqual(updatedSession.currentMoveIndex, 1)
    assert.strictEqual(updatedSession.completed, true)
    assert.strictEqual(updatedTab.mode, 'analysis')
    assert.strictEqual(harness.runtimeStore.getState().activeRecallSessionId, undefined)
  })

  it('runs checkpoint correction, AI reveal, comment, and resume through stores', async () => {
    const harness = createHarness()
    const {attempt} = await createTabWithAttempt(harness, {
      tabId: 'tab_checkpoint_source',
      taskId: 'task_free',
      mode: 'play',
      moves: ['dd', 'qq'],
    })
    const session = await harness.recallService.createRecallFromAttempt(attempt.id)
    harness.workbenchStore.addTab(makeTab({
      id: 'tab_checkpoint',
      taskId: 'task_free',
      mode: 'recall',
      recallSubstate: 'normal',
      activeAttemptId: attempt.id,
      activeRecallSessionId: session.id,
    }))
    harness.repository.store.evaluations.push({
      id: 'eval_checkpoint',
      attemptId: attempt.id,
      taskId: 'task_free',
      moveIndex: 0,
      status: 'completed',
      move: 'dd',
      engineSuggestedLine: ['pq'],
      createdAt: NOW,
    })
    harness.repository.store.badMoves.push({
      id: 'bm_checkpoint',
      moveEvaluationId: 'eval_checkpoint',
      attemptId: attempt.id,
      taskId: 'task_free',
      moveIndex: 0,
      severity: 'major',
      punishSide: 'black',
      createdAt: NOW,
    })

    await harness.recallService.submitRecallMove({
      recallSessionId: session.id,
      userMove: 'dd',
    })
    const checkpointId = harness.runtimeStore.getState().activeCheckpointId
    harness.runtimeStore.setCorrectionDraft({checkpointId, moves: ['pq']})

    await harness.flowService.submitCheckpointCorrection('tab_checkpoint')
    const lines = await harness.flowService.revealCheckpointAi('tab_checkpoint')
    await harness.flowService.saveCheckpointComment({
      tabId: 'tab_checkpoint',
      content: 'Missed the key forcing move.',
    })

    const updatedTab = harness.workbenchStore.getState().tabs.find(tab => tab.id === 'tab_checkpoint')
    const checkpoint = harness.repository.store.checkpoints[checkpointId]

    assert.deepStrictEqual(lines.map(line => line.moves), [['pq']])
    assert.strictEqual(checkpoint.status, 'commented')
    assert.ok(checkpoint.completedAt)
    assert.strictEqual(harness.repository.store.sessions[session.id].currentMoveIndex, 1)
    assert.strictEqual(updatedTab.recallSubstate, 'normal')
    assert.strictEqual(harness.runtimeStore.getState().activeCheckpointId, undefined)
    assert.strictEqual(harness.repository.store.comments.length, 1)
  })

  it('enters analysis, snapshots a new problem task, and returns to the saved mode target', async () => {
    const harness = createHarness()
    harness.repository.store.sessions.rs_existing = {
      id: 'rs_existing',
      taskId: 'task_free',
      type: 'line_recall',
      source: {kind: 'attempt', attemptId: 'attempt_existing'},
      startMove: 0,
      expectedMoves: ['dd'],
      currentMoveIndex: 0,
      completed: false,
      createdAt: NOW,
    }
    harness.workbenchStore.addTab(makeTab({
      id: 'tab_analysis',
      taskId: 'task_free',
      mode: 'recall',
      recallSubstate: 'checkpoint_commenting',
      activeRecallSessionId: 'rs_existing',
      currentTreePosition: 'node_42',
    }))

    harness.flowService.enterAnalysis('tab_analysis')
    const newTab = await harness.flowService.snapshotFromCurrentContext('tab_analysis')
    harness.flowService.returnFromAnalysis({tabId: 'tab_analysis'})

    const parent = harness.workbenchStore.getState().tabs.find(tab => tab.id === 'tab_analysis')

    assert.strictEqual(newTab.mode, 'problem')
    assert.strictEqual(newTab.parentTabId, 'tab_analysis')
    assert.ok(harness.repository.store.tasks[newTab.taskId])
    assert.ok(parent.childTabIds.includes(newTab.id))
    assert.strictEqual(parent.mode, 'recall')
    assert.strictEqual(parent.recallSubstate, 'checkpoint_commenting')
    assert.strictEqual(parent.currentTreePosition, 'node_42')
  })

  it('submits an evaluated problem, creates punishment work, and enrolls review', async () => {
    const harness = createHarness()
    const attempt = await harness.attemptService.createAttempt({
      taskId: 'task_problem',
      tabId: 'tab_problem_flow',
      rootPositionSgf: harness.repository.store.tasks.task_problem.rootPositionSgf,
    })
    harness.runtimeStore.setProblemView({
      taskId: 'task_problem',
      tabId: 'tab_problem_flow',
      attemptId: attempt.id,
      problemId: 'task_problem',
      legacyProblemSession: {id: 'task_problem', sideToMove: 'black'},
      evalCache: [],
      badMoves: [],
      submitted: false,
      result: null,
    })
    const monitor = {
      async onUserMove(input) {
        await harness.repository.createMoveEvaluation({
          id: `eval_problem_${input.moveIndex}`,
          attemptId: input.attemptId,
          taskId: 'task_problem',
          moveIndex: input.moveIndex,
          status: 'completed',
          move: input.move,
          positionBeforeSgf: '(;SZ[19])',
          positionAfterSgf: '(;SZ[19];B[dd])',
          engineSuggestedLine: ['qq'],
          createdAt: NOW,
        })
      },
    }
    const punishmentIds = []
    const problemService = {
      async createPunishmentProblemFromBadMove(badMoveId) {
        const problem = {
          id: `punishment_${badMoveId}`,
          title: 'Punishment problem',
        }
        punishmentIds.push(problem.id)
        return {problem}
      },
    }
    const problemFlowService = createProblemFlowService({
      runtimeStore: harness.runtimeStore,
      repository: harness.repository,
      attemptService: harness.attemptService,
      monitor,
      problemService,
      reviewService: harness.reviewService,
    })

    await problemFlowService.appendProblemMove({
      move: 'dd',
      vertex: [3, 3],
      playerSign: 1,
      positionBeforeHash: 'pos_before',
      positionAfterHash: 'pos_after',
      preMoveAnalysis: {
        sign: 1,
        variations: [
          {vertex: [16, 16], scoreLead: 10},
          {vertex: [3, 3], scoreLead: 0},
        ],
      },
    })
    const result = await problemFlowService.submitActiveProblem()

    const submittedAttempt = harness.repository.store.attempts[attempt.id]
    const schedule = Object.values(harness.repository.store.schedules)[0]
    const view = harness.runtimeStore.getState().problemView

    assert.strictEqual(result.result, 'fail')
    assert.strictEqual(submittedAttempt.status, 'submitted')
    assert.strictEqual(submittedAttempt.result, 'fail')
    assert.strictEqual(harness.repository.store.badMoves.length, 1)
    assert.deepStrictEqual(result.generatedPunishmentProblemIds, punishmentIds)
    assert.strictEqual(schedule.taskId, 'task_problem')
    assert.strictEqual(schedule.lastResult, 'fail')
    assert.strictEqual(view.submitted, true)
    assert.strictEqual(view.result, 'fail')
  })

  it('starts review by opening due tasks through semantic tab entrypoints and runtime queue state', async () => {
    const harness = createHarness({
      schedules: {
        rev_due: {
          id: 'rev_due',
          taskId: 'task_problem',
          dueAt: '2000-01-01T00:00:00.000Z',
          intervalDays: 1,
          consecutivePassCount: 0,
          totalFailCount: 0,
          createdAt: NOW,
          updatedAt: NOW,
        },
      },
    })

    await harness.reviewService.startSession()

    const reviewView = harness.runtimeStore.getState().reviewQueueView
    const activeTab = harness.workbenchStore.getState().tabs
      .find(tab => tab.id === harness.workbenchStore.getState().activeTabId)

    assert.deepStrictEqual(reviewView.queue, ['rev_due'])
    assert.strictEqual(reviewView.currentIndex, 0)
    assert.strictEqual(activeTab.taskId, 'task_problem')
    assert.strictEqual(activeTab.mode, 'problem')
  })

  it('routes a problem board click through controller to problem attempt flow', async () => {
    const harness = createHarness({
      tasks: {
        task_ai: makeTask({
          id: 'task_ai',
          problemArea: [[3, 3], [16, 16]],
          sideToMove: 'white',
        }),
      },
    })
    const attempt = await harness.attemptService.createAttempt({
      taskId: 'task_ai',
      tabId: 'tab_ai',
      rootPositionSgf: harness.repository.store.tasks.task_ai.rootPositionSgf,
    })
    const calls = {
      documentMoves: [],
      monitorMoves: [],
      aiInputs: [],
    }
    harness.runtimeStore.setProblemView({
      taskId: 'task_ai',
      tabId: 'tab_ai',
      attemptId: attempt.id,
      problemId: 'task_ai',
      legacyProblemSession: {id: 'task_ai', sideToMove: 'white'},
      evalCache: [],
      badMoves: [],
      submitted: false,
      result: null,
    })
    const problemFlowService = createProblemFlowService({
      runtimeStore: harness.runtimeStore,
      repository: harness.repository,
      attemptService: harness.attemptService,
      monitor: {
        async onUserMove(input) {
          calls.monitorMoves.push(clone(input))
        },
      },
      problemService: {
        async createPunishmentProblemFromBadMove() {
          return {problem: {id: 'punishment_1'}}
        },
      },
      reviewService: harness.reviewService,
    })
    const controller = createBoardInteractionController({
      getPlayServices: () => ({
        documentStore: {
          async playMove(vertex) {
            calls.documentMoves.push(vertex)
            return {valid: true, changed: true, treePosition: `node_${calls.documentMoves.length}`}
          },
        },
        problemFlowService,
        repository: harness.repository,
        attemptService: harness.attemptService,
        aiMoveService: {
          async maybePlayAiMove(input) {
            calls.aiInputs.push(clone(input))
            return 'qq'
          },
        },
      }),
      getRecallAdapter: () => ({async submitBoardClick() {}}),
      getEditWorkspaceContext: () => null,
      getEditWorkspaceDeps: () => ({}),
      getLegacySabaki: () => ({clickVertex() {}}),
      getIsMac: () => false,
    })

    await controller.handleBoardClick({
      vertex: [3, 3],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: {
        id: 'tab_ai',
        taskId: 'task_ai',
        mode: 'problem',
        activeAttemptId: attempt.id,
        playerConfig: {black: 'human', white: 'ai', ai: {autoPlay: true}},
      },
      settings: {selectedTool: 'stone_1'},
      board: createBoard(),
      editWorkspacePresent: false,
      task: {problemArea: {vertices: [[3, 3], [16, 16]]}},
      runtimeState: {},
    })

    const updatedAttempt = harness.repository.store.attempts[attempt.id]

    assert.deepStrictEqual(calls.documentMoves, [])
    assert.deepStrictEqual(updatedAttempt.userLine, ['dd'])
    assert.deepStrictEqual(updatedAttempt.moveActors.map(actor => actor.actor), ['human'])
    assert.deepStrictEqual(calls.monitorMoves.map(call => call.move), ['dd'])
    assert.deepStrictEqual(calls.aiInputs, [])
  })
})
