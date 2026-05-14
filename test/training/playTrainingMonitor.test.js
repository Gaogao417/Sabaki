import assert from 'assert'

import { createPlayTrainingMonitor } from '../../src/modules/training/attempt/playTrainingMonitor.ts'
import { createAttemptService } from '../../src/modules/training/attempt/attemptService.ts'
import { createTrainingRuntimeStore } from '../../src/modules/training/store/trainingRuntimeStore.ts'

function createMockAnalysisAdapter() {
  const analysisData = {}
  let updateCallback = null

  return {
    getAnalysisForPosition(positionKey) {
      return analysisData[positionKey] || null
    },
    setAnalysisForPosition(positionKey, result) {
      analysisData[positionKey] = result
    },
    emitAnalysisUpdate(positionKey) {
      if (updateCallback) updateCallback(positionKey)
    },
    subscribeToAnalysisUpdates(callback) {
      updateCallback = callback
      return () => { updateCallback = null }
    },
  }
}

function createMockRepository() {
  const state = {
    attempts: {},
    evaluations: [],
    evaluationUpdates: [],
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
    async createBadMove(badMove) {
      return badMove
    },
    state,
  }
}

describe('playTrainingMonitor', () => {
  let monitor, runtimeStore, attemptService, mockRepo, mockAdapter

  beforeEach(() => {
    runtimeStore = createTrainingRuntimeStore()
    mockRepo = createMockRepository()
    mockAdapter = createMockAnalysisAdapter()

    attemptService = createAttemptService({
      repository: mockRepo,
      runtimeStore,
    })

    monitor = createPlayTrainingMonitor({
      attemptService,
      analysisResultAdapter: mockAdapter,
      repository: mockRepo,
      runtimeStore,
    })
  })

  describe('onUserMove', () => {
    it('creates a pending MoveEvaluation', async () => {
      monitor.startForAttempt({ attemptId: 'attempt_1', taskId: 'task_1' })

      await monitor.onUserMove({
        attemptId: 'attempt_1',
        moveIndex: 0,
        move: 'D4',
        positionBeforeHash: 'pos_before_0',
      })

      const pending = runtimeStore.getState().pendingMoveEvaluations
      const keys = Object.keys(pending)
      assert.strictEqual(keys.length, 1)
      assert.strictEqual(pending[keys[0]].status, 'pending')
      assert.strictEqual(pending[keys[0]].move, 'D4')
      assert.strictEqual(pending[keys[0]].moveIndex, 0)
    })

    it('persists evaluation to repository', async () => {
      monitor.startForAttempt({ attemptId: 'attempt_1', taskId: 'task_1' })

      await monitor.onUserMove({
        attemptId: 'attempt_1',
        moveIndex: 0,
        move: 'D4',
      })

      assert.strictEqual(mockRepo.state.evaluations.length, 1)
      assert.strictEqual(mockRepo.state.evaluations[0].status, 'pending')
    })
  })

  describe('onAnalysisUpdated', () => {
    it('evaluates pending move when analysis arrives', async () => {
      monitor.startForAttempt({ attemptId: 'attempt_1', taskId: 'task_1' })

      // Set up before position analysis
      mockAdapter.setAnalysisForPosition('pos_before_0', {
        positionKey: 'pos_before_0',
        scoreLead: 5.0,
        winrate: 0.6,
        candidateMoves: [],
      })

      await monitor.onUserMove({
        attemptId: 'attempt_1',
        moveIndex: 0,
        move: 'D4',
        positionBeforeHash: 'pos_before_0',
      })

      // Set after position analysis
      mockAdapter.setAnalysisForPosition('pos_after_0', {
        positionKey: 'pos_after_0',
        scoreLead: 1.0,
        winrate: 0.5,
        candidateMoves: [],
      })

      await monitor.onAnalysisUpdated({ positionKey: 'pos_after_0' })

      // Pending should be removed
      const pending = runtimeStore.getState().pendingMoveEvaluations
      assert.strictEqual(Object.keys(pending).length, 0)

      // Evaluation should be updated in repo
      assert.strictEqual(mockRepo.state.evaluationUpdates.length, 1)
      assert.strictEqual(mockRepo.state.evaluationUpdates[0].status, 'evaluated')
      assert.strictEqual(mockRepo.state.evaluationUpdates[0].scoreDrop, 4.0)
    })

    it('creates BadMove when severity is major', async () => {
      monitor.startForAttempt({ attemptId: 'attempt_1', taskId: 'task_1' })

      mockAdapter.setAnalysisForPosition('pos_before', {
        positionKey: 'pos_before',
        scoreLead: 10.0,
        winrate: 0.7,
        candidateMoves: [],
      })

      await monitor.onUserMove({
        attemptId: 'attempt_1',
        moveIndex: 0,
        move: 'D4',
        positionBeforeHash: 'pos_before',
      })

      mockAdapter.setAnalysisForPosition('pos_after', {
        positionKey: 'pos_after',
        scoreLead: 4.0,
        winrate: 0.6,
        candidateMoves: [],
      })

      await monitor.onAnalysisUpdated({ positionKey: 'pos_after' })

      const badMoveIds = runtimeStore.getState().visibleBadMoveIds
      assert.strictEqual(badMoveIds.length, 1)
    })

    it('does not create BadMove when drop is minor', async () => {
      monitor.startForAttempt({ attemptId: 'attempt_1', taskId: 'task_1' })

      mockAdapter.setAnalysisForPosition('pos_before', {
        positionKey: 'pos_before',
        scoreLead: 5.0,
        candidateMoves: [],
      })

      await monitor.onUserMove({
        attemptId: 'attempt_1',
        moveIndex: 0,
        move: 'D4',
        positionBeforeHash: 'pos_before',
      })

      mockAdapter.setAnalysisForPosition('pos_after', {
        positionKey: 'pos_after',
        scoreLead: 4.0,
        candidateMoves: [],
      })

      await monitor.onAnalysisUpdated({ positionKey: 'pos_after' })

      const badMoveIds = runtimeStore.getState().visibleBadMoveIds
      assert.strictEqual(badMoveIds.length, 0)
    })
  })

  describe('failExpiredPendingEvaluations', () => {
    it('marks old pending evaluations as failed', async () => {
      monitor.startForAttempt({ attemptId: 'attempt_1', taskId: 'task_1' })

      // Create a pending evaluation with an old timestamp
      const oldTime = new Date(Date.now() - 60_000).toISOString()
      runtimeStore.upsertPendingMoveEvaluation({
        id: 'eval_old',
        attemptId: 'attempt_1',
        moveIndex: 0,
        move: 'D4',
        status: 'pending',
        createdAt: oldTime,
      })

      await monitor.failExpiredPendingEvaluations()

      const pending = runtimeStore.getState().pendingMoveEvaluations
      assert.strictEqual(Object.keys(pending).length, 0)

      const updates = mockRepo.state.evaluationUpdates
      const failedUpdate = updates.find(u => u.status === 'failed')
      assert.ok(failedUpdate)
      assert.strictEqual(failedUpdate.id, 'eval_old')
    })

    it('does not fail recent pending evaluations', async () => {
      monitor.startForAttempt({ attemptId: 'attempt_1', taskId: 'task_1' })

      runtimeStore.upsertPendingMoveEvaluation({
        id: 'eval_recent',
        attemptId: 'attempt_1',
        moveIndex: 0,
        move: 'D4',
        status: 'pending',
        createdAt: new Date().toISOString(),
      })

      await monitor.failExpiredPendingEvaluations()

      const pending = runtimeStore.getState().pendingMoveEvaluations
      assert.ok(pending['eval_recent'])
    })
  })

  describe('startForAttempt / stopForAttempt', () => {
    it('start sets active monitor', async () => {
      monitor.startForAttempt({ attemptId: 'attempt_1', taskId: 'task_1' })
      // Verify it works by creating a move
      await monitor.onUserMove({
        attemptId: 'attempt_1',
        moveIndex: 0,
        move: 'D4',
      })
      const pending = runtimeStore.getState().pendingMoveEvaluations
      assert.strictEqual(Object.keys(pending).length, 1)
    })

    it('stop deactivates monitor', async () => {
      monitor.startForAttempt({ attemptId: 'attempt_1', taskId: 'task_1' })
      monitor.stopForAttempt('attempt_1')

      // Analysis updates should be ignored after stop
      await monitor.onAnalysisUpdated({ positionKey: 'any' })
      assert.strictEqual(mockRepo.state.evaluationUpdates.length, 0)
    })
  })
})
