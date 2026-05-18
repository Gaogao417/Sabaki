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

    // C58: onUserMove does NOT save positionBeforeSgf/positionAfterSgf in MoveEvaluation
    it('does NOT save positionBeforeSgf/positionAfterSgf in MoveEvaluation', async () => {
      monitor.startForAttempt({ attemptId: 'attempt_1', taskId: 'task_1' })

      await monitor.onUserMove({
        attemptId: 'attempt_1',
        moveIndex: 0,
        move: 'D4',
        positionBeforeHash: 'pos_before_0',
      })

      assert.strictEqual(mockRepo.state.evaluations.length, 1)
      const evaluation = mockRepo.state.evaluations[0]
      assert.strictEqual(evaluation.positionBeforeSgf, undefined)
      assert.strictEqual(evaluation.positionAfterSgf, undefined)
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

    // C42: Creates BadMove when severity is 'severe'
    it('creates BadMove when severity is severe', async () => {
      monitor.startForAttempt({ attemptId: 'attempt_1', taskId: 'task_1' })

      mockAdapter.setAnalysisForPosition('pos_before', {
        positionKey: 'pos_before',
        scoreLead: 15.0,
        winrate: 0.8,
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
        scoreLead: 5.0,
        winrate: 0.6,
        candidateMoves: [],
      })

      await monitor.onAnalysisUpdated({ positionKey: 'pos_after' })

      const badMoveIds = runtimeStore.getState().visibleBadMoveIds
      assert.strictEqual(badMoveIds.length, 1)
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

    // C43: Does NOT create BadMove when severity is 'minor' (scoreDrop 2.0-4.9)
    it('does not create BadMove when severity is minor (scoreDrop at threshold)', async () => {
      monitor.startForAttempt({ attemptId: 'attempt_1', taskId: 'task_1' })

      mockAdapter.setAnalysisForPosition('pos_before', {
        positionKey: 'pos_before',
        scoreLead: 5.0,
        winrate: 0.6,
        candidateMoves: [],
      })

      await monitor.onUserMove({
        attemptId: 'attempt_1',
        moveIndex: 0,
        move: 'D4',
        positionBeforeHash: 'pos_before',
      })

      // scoreDrop = 3.0, which is in the minor range (2.0 - 4.9)
      mockAdapter.setAnalysisForPosition('pos_after', {
        positionKey: 'pos_after',
        scoreLead: 2.0,
        winrate: 0.55,
        candidateMoves: [],
      })

      await monitor.onAnalysisUpdated({ positionKey: 'pos_after' })

      const badMoveIds = runtimeStore.getState().visibleBadMoveIds
      assert.strictEqual(badMoveIds.length, 0)
    })

    // C43 variant: exactly at minor threshold (scoreDrop = 2.0)
    it('does not create BadMove when scoreDrop is exactly 2.0 (minor boundary)', async () => {
      monitor.startForAttempt({ attemptId: 'attempt_1', taskId: 'task_1' })

      mockAdapter.setAnalysisForPosition('pos_before', {
        positionKey: 'pos_before',
        scoreLead: 7.0,
        winrate: 0.6,
        candidateMoves: [],
      })

      await monitor.onUserMove({
        attemptId: 'attempt_1',
        moveIndex: 0,
        move: 'D4',
        positionBeforeHash: 'pos_before',
      })

      // scoreDrop = exactly 2.0
      mockAdapter.setAnalysisForPosition('pos_after', {
        positionKey: 'pos_after',
        scoreLead: 5.0,
        winrate: 0.58,
        candidateMoves: [],
      })

      await monitor.onAnalysisUpdated({ positionKey: 'pos_after' })

      const badMoveIds = runtimeStore.getState().visibleBadMoveIds
      assert.strictEqual(badMoveIds.length, 0)
    })

    // C47: Does nothing when no active monitor
    it('does nothing when no active monitor (onAnalysisUpdated)', async () => {
      // Do NOT call startForAttempt — no active monitor
      await monitor.onAnalysisUpdated({ positionKey: 'any_position' })

      assert.strictEqual(mockRepo.state.evaluationUpdates.length, 0)
      assert.strictEqual(runtimeStore.getState().visibleBadMoveIds.length, 0)
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

    // C51: Does NOT create BadMove for failed evaluations
    it('does not create BadMove for expired/failed evaluations', async () => {
      monitor.startForAttempt({ attemptId: 'attempt_1', taskId: 'task_1' })

      const oldTime = new Date(Date.now() - 60_000).toISOString()
      runtimeStore.upsertPendingMoveEvaluation({
        id: 'eval_old_fail',
        attemptId: 'attempt_1',
        moveIndex: 0,
        move: 'D4',
        status: 'pending',
        createdAt: oldTime,
        positionBeforeHash: 'pos_before',
      })

      // Set up analysis that would normally cause a severe BadMove
      mockAdapter.setAnalysisForPosition('pos_before', {
        positionKey: 'pos_before',
        scoreLead: 15.0,
        winrate: 0.8,
        candidateMoves: [],
      })

      await monitor.failExpiredPendingEvaluations()

      // The evaluation should be failed
      const updates = mockRepo.state.evaluationUpdates
      const failedUpdate = updates.find(u => u.status === 'failed')
      assert.ok(failedUpdate)

      // But NO BadMove should be created
      const badMoveIds = runtimeStore.getState().visibleBadMoveIds
      assert.strictEqual(badMoveIds.length, 0)
    })

    // C53: Does nothing when no active monitor (failExpiredPendingEvaluations)
    it('does nothing when no active monitor (failExpiredPendingEvaluations)', async () => {
      // Do NOT call startForAttempt — no active monitor

      const oldTime = new Date(Date.now() - 60_000).toISOString()
      runtimeStore.upsertPendingMoveEvaluation({
        id: 'eval_orphaned',
        attemptId: 'attempt_1',
        moveIndex: 0,
        move: 'D4',
        status: 'pending',
        createdAt: oldTime,
      })

      await monitor.failExpiredPendingEvaluations()

      // Should NOT have failed the evaluation — monitor not active
      const updates = mockRepo.state.evaluationUpdates
      assert.strictEqual(updates.length, 0)

      // The evaluation should still be in pending
      const pending = runtimeStore.getState().pendingMoveEvaluations
      assert.ok(pending['eval_orphaned'])
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
