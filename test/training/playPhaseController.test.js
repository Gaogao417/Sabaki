import assert from 'assert'

import { createPlayPhaseController } from '../../src/modules/training/controller/playPhaseController.ts'
import { createTrainingRuntimeStore } from '../../src/modules/training/store/trainingRuntimeStore.ts'
import { createWorkbenchStore } from '../../src/modules/training/store/workbenchStore.ts'
import { createAttemptService } from '../../src/modules/training/attempt/attemptService.ts'
import { createPlayTrainingMonitor } from '../../src/modules/training/attempt/playTrainingMonitor.ts'

// --- Mock factories ---

function createMockRepository() {
  const state = {
    attempts: {},
    evaluations: [],
    evaluationUpdates: [],
    badMoves: [],
    recallSessions: [],
  }

  return {
    async createAttempt(attempt) {
      state.attempts[attempt.id] = { ...attempt }
      return { ...attempt }
    },
    async loadAttempt(id) {
      return state.attempts[id] || null
    },
    async updateAttempt(id, patch) {
      if (state.attempts[id]) Object.assign(state.attempts[id], patch)
    },
    async createMoveEvaluation(eval_) {
      state.evaluations.push({ ...eval_ })
    },
    async updateMoveEvaluation(id, patch) {
      state.evaluationUpdates.push({ id, ...patch })
    },
    async createBadMove(bm) {
      state.badMoves.push({ ...bm })
      return bm
    },
    async listBadMovesByAttempt(attemptId) {
      return state.badMoves.filter(bm => bm.attemptId === attemptId)
    },
    async listMoveEvaluationsByAttempt(attemptId) {
      return state.evaluations.filter(e => e.attemptId === attemptId)
    },
    async createRecallSession(session) {
      state.recallSessions.push({ ...session })
      return { ...session }
    },
    state,
  }
}

function createMockAnalysisAdapter() {
  return {
    getAnalysisForPosition: () => null,
    subscribeToAnalysisUpdates: () => () => {},
  }
}

function createMockPlayServices() {
  return {
    documentStore: {
      playMove: async (vertex, opts) => ({
        valid: true,
        changed: true,
        treePosition: 'node_after',
        pass: false,
        capturing: false,
        suicide: false,
        ko: false,
        doublePass: false,
      }),
    },
    engineService: { generateReply: () => {} },
    analysisService: { scheduleLiveAnalysis: () => {} },
  }
}

function createMockBoard(overrides = {}) {
  return {
    width: 9,
    height: 9,
    markers: Array.from({ length: 9 }, () => Array(9).fill(null)),
    get: () => 0, // empty point
    stringifyVertex: (v) => String.fromCharCode(97 + v[0]) + String.fromCharCode(97 + v[1]),
    ...overrides,
  }
}

function createMockRecallService() {
  const calls = []
  return {
    createRecallFromAttempt: async (attemptId) => {
      calls.push({ method: 'createRecallFromAttempt', attemptId })
      return { id: 'recall_1', attemptId, expectedMoves: [], currentMoveIndex: 0 }
    },
    calls,
  }
}

function createMockDeps(overrides = {}) {
  const runtimeStore = createTrainingRuntimeStore()
  const workbenchStore = createWorkbenchStore()

  const mockRepo = createMockRepository()
  const mockAdapter = createMockAnalysisAdapter()

  const attemptService = createAttemptService({
    repository: mockRepo,
    runtimeStore,
  })

  const monitor = createPlayTrainingMonitor({
    attemptService,
    analysisResultAdapter: mockAdapter,
    repository: mockRepo,
    runtimeStore,
  })

  const recallService = createMockRecallService()

  const phaseTransitions = []
  const navigations = []

  const deps = {
    getPlayServices: () => createMockPlayServices(),
    getPlayer: () => 1,
    navigateToParent: () => {
      navigations.push('parent')
      return 'node_parent'
    },
    attemptService,
    playTrainingMonitor: monitor,
    recallService,
    phaseTransition: (tabId, transition) => {
      phaseTransitions.push({ tabId, transition })
    },
    runtimeStore,
    workbenchStore,
    ...overrides,
  }

  const controller = createPlayPhaseController(deps)

  return {
    controller,
    deps,
    mockRepo,
    phaseTransitions,
    navigations,
  }
}

function createPlayState(overrides = {}) {
  return {
    mode: 'play',
    selectedTool: 'stone_1',
    treePosition: 'root',
    editWorkspace: null,
    ...overrides,
  }
}

// --- Tests ---

describe('PlayPhaseController', () => {
  describe('startPlay', () => {
    it('creates attempt and sets active attempt in runtime store', async () => {
      let { controller, deps } = createMockDeps()
      let { workbenchStore } = deps

      workbenchStore.addTab({
        id: 'tab_1',
        taskId: 'task_1',
        phase: 'play',
        childTabIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      workbenchStore.setActiveTab('tab_1')

      await controller.startPlay({
        taskId: 'task_1',
        tabId: 'tab_1',
        rootPositionSgf: '(;SZ[9])',
      })

      let attemptId = deps.runtimeStore.getState().activeAttemptId
      assert.ok(attemptId, 'activeAttemptId should be set')
    })

    it('starts monitor for the attempt', async () => {
      let { controller, deps, mockRepo } = createMockDeps()

      await controller.startPlay({
        taskId: 'task_1',
        rootPositionSgf: '(;SZ[9])',
      })

      let attemptId = deps.runtimeStore.getState().activeAttemptId

      // Monitor should accept moves for this attempt
      await deps.playTrainingMonitor.onUserMove({
        attemptId,
        moveIndex: 0,
        move: 'dd',
      })

      let pending = deps.runtimeStore.getState().pendingMoveEvaluations
      assert.strictEqual(Object.keys(pending).length, 1)
    })
  })

  describe('handleMove', () => {
    it('rejects move when no active attempt', async () => {
      let { controller } = createMockDeps()

      let result = await controller.handleMove({
        vertex: [3, 3],
        state: createPlayState(),
        board: createMockBoard(),
        event: { button: 0, ctrlKey: false, metaKey: false },
      })

      assert.strictEqual(result.handled, false)
      assert.strictEqual(result.reason, 'no active attempt')
    })

    it('rejects move when attempt is not playing', async () => {
      let { controller, deps, mockRepo } = createMockDeps()

      await controller.startPlay({
        taskId: 'task_1',
        rootPositionSgf: '(;SZ[9])',
      })

      let attemptId = deps.runtimeStore.getState().activeAttemptId

      // Freeze attempt to make it non-playing
      mockRepo.state.attempts[attemptId].status = 'submitted'

      let result = await controller.handleMove({
        vertex: [3, 3],
        state: createPlayState(),
        board: createMockBoard(),
        event: { button: 0, ctrlKey: false, metaKey: false },
      })

      assert.strictEqual(result.handled, false)
      assert.ok(result.reason.includes('not playing'))
    })

    it('executes play-stone and tracks move', async () => {
      let { controller, deps, mockRepo } = createMockDeps()

      await controller.startPlay({
        taskId: 'task_1',
        rootPositionSgf: '(;SZ[9])',
      })

      let result = await controller.handleMove({
        vertex: [3, 3],
        state: createPlayState(),
        board: createMockBoard(),
        event: { button: 0, ctrlKey: false, metaKey: false },
      })

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.changed, true)

      // Attempt should have one move in userLine
      let attemptId = deps.runtimeStore.getState().activeAttemptId
      let attempt = mockRepo.state.attempts[attemptId]
      assert.strictEqual(attempt.userLine.length, 1)

      // Pending evaluation created
      let pending = deps.runtimeStore.getState().pendingMoveEvaluations
      assert.strictEqual(Object.keys(pending).length, 1)
    })

    it('derives moveIndex from userLine length, not internal counter', async () => {
      let { controller, deps, mockRepo } = createMockDeps()

      await controller.startPlay({
        taskId: 'task_1',
        rootPositionSgf: '(;SZ[9])',
      })

      // Play first move
      await controller.handleMove({
        vertex: [3, 3],
        state: createPlayState(),
        board: createMockBoard(),
        event: { button: 0, ctrlKey: false, metaKey: false },
      })

      // Play second move — moveIndex should be 1
      await controller.handleMove({
        vertex: [4, 4],
        state: createPlayState({ treePosition: 'node_after' }),
        board: createMockBoard(),
        event: { button: 0, ctrlKey: false, metaKey: false },
      })

      let pending = deps.runtimeStore.getState().pendingMoveEvaluations
      let evals = Object.values(pending)
      let secondEval = evals.find(e => e.moveIndex === 1)
      assert.ok(secondEval, 'should have evaluation with moveIndex=1')
    })

    it('returns unhandled for non-play-stone intents', async () => {
      let { controller, deps } = createMockDeps()

      await controller.startPlay({
        taskId: 'task_1',
        rootPositionSgf: '(;SZ[9])',
      })

      // Click occupied point — resolveBoardInteraction rejects
      let result = await controller.handleMove({
        vertex: [3, 3],
        state: createPlayState(),
        board: createMockBoard({ get: () => 1 }), // occupied
        event: { button: 0, ctrlKey: false, metaKey: false },
      })

      assert.strictEqual(result.handled, false)
    })
  })

  describe('undo', () => {
    it('no-ops without active attempt', async () => {
      let { controller, navigations } = createMockDeps()

      await controller.undo()

      assert.strictEqual(navigations.length, 0)
    })

    it('no-ops when attempt has no moves', async () => {
      let { controller, deps, navigations } = createMockDeps()

      await controller.startPlay({
        taskId: 'task_1',
        rootPositionSgf: '(;SZ[9])',
      })

      await controller.undo()

      assert.strictEqual(navigations.length, 0)
    })

    it('navigates back, pops userLine, and delegates to monitor', async () => {
      let { controller, deps, mockRepo, navigations } = createMockDeps()

      await controller.startPlay({
        taskId: 'task_1',
        rootPositionSgf: '(;SZ[9])',
      })

      await controller.handleMove({
        vertex: [3, 3],
        state: createPlayState(),
        board: createMockBoard(),
        event: { button: 0, ctrlKey: false, metaKey: false },
      })

      let attemptId = deps.runtimeStore.getState().activeAttemptId
      assert.strictEqual(mockRepo.state.attempts[attemptId].userLine.length, 1)

      await controller.undo()

      // Tree navigation happened
      assert.strictEqual(navigations.length, 1)

      // userLine popped
      assert.strictEqual(mockRepo.state.attempts[attemptId].userLine.length, 0)

      // Pending evaluation removed
      let pending = deps.runtimeStore.getState().pendingMoveEvaluations
      assert.strictEqual(Object.keys(pending).length, 0)
    })
  })

  describe('submitPlay', () => {
    it('finalizes attempt, creates recall, and transitions phase', async () => {
      let { controller, deps, phaseTransitions } = createMockDeps()
      let { workbenchStore } = deps

      workbenchStore.addTab({
        id: 'tab_1',
        taskId: 'task_1',
        phase: 'play',
        childTabIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      workbenchStore.setActiveTab('tab_1')

      await controller.startPlay({
        taskId: 'task_1',
        tabId: 'tab_1',
        rootPositionSgf: '(;SZ[9])',
      })

      await controller.handleMove({
        vertex: [3, 3],
        state: createPlayState(),
        board: createMockBoard(),
        event: { button: 0, ctrlKey: false, metaKey: false },
      })

      await controller.submitPlay()

      // Phase transition called
      assert.strictEqual(phaseTransitions.length, 1)
      assert.strictEqual(phaseTransitions[0].tabId, 'tab_1')
      assert.strictEqual(phaseTransitions[0].transition, 'submit')

      // Recall session created
      let attemptId = deps.runtimeStore.getState().activeAttemptId
      assert.strictEqual(deps.recallService.calls.length, 1)
      assert.strictEqual(deps.recallService.calls[0].attemptId, attemptId)
    })

    it('no-ops without active attempt', async () => {
      let { controller, phaseTransitions } = createMockDeps()

      await controller.submitPlay()

      assert.strictEqual(phaseTransitions.length, 0)
    })
  })

  describe('exit', () => {
    it('stops monitor and clears only current attempt state', async () => {
      let { controller, deps } = createMockDeps()

      await controller.startPlay({
        taskId: 'task_1',
        rootPositionSgf: '(;SZ[9])',
      })

      await controller.handleMove({
        vertex: [3, 3],
        state: createPlayState(),
        board: createMockBoard(),
        event: { button: 0, ctrlKey: false, metaKey: false },
      })

      let attemptId = deps.runtimeStore.getState().activeAttemptId
      assert.ok(attemptId)

      controller.exit()

      // Active attempt cleared
      assert.strictEqual(deps.runtimeStore.getState().activeAttemptId, undefined)

      // Pending evaluations for this attempt cleared
      let pending = deps.runtimeStore.getState().pendingMoveEvaluations
      assert.strictEqual(Object.keys(pending).length, 0)

      // Bad move ids cleared
      assert.strictEqual(deps.runtimeStore.getState().visibleBadMoveIds.length, 0)
    })

    it('does not clear another attempt pending evaluations', async () => {
      let { controller, deps } = createMockDeps()

      // Simulate another attempt's pending eval
      deps.runtimeStore.upsertPendingMoveEvaluation({
        id: 'other_eval',
        attemptId: 'other_attempt',
        moveIndex: 0,
        move: 'D4',
        status: 'pending',
        createdAt: new Date().toISOString(),
      })

      await controller.startPlay({
        taskId: 'task_1',
        rootPositionSgf: '(;SZ[9])',
      })

      controller.exit()

      // Other attempt's eval should survive
      let pending = deps.runtimeStore.getState().pendingMoveEvaluations
      assert.ok(pending['other_eval'], 'other attempt eval should not be cleared')
    })
  })
})
