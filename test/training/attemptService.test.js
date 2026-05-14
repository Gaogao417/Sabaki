import assert from 'assert'

import { createAttemptService } from '../../src/modules/training/attempt/attemptService.ts'
import { createTrainingRuntimeStore } from '../../src/modules/training/store/trainingRuntimeStore.ts'

function makeAttempt(overrides = {}) {
  return {
    id: 'attempt_1',
    taskId: 'task_1',
    startedAt: '2026-01-01T00:00:00.000Z',
    rootPositionSgf: '(;SZ[9])',
    userLine: [],
    status: 'playing',
    result: 'pending',
    hintLevelUsed: 0,
    recallCompleted: false,
    analysisOpened: false,
    ...overrides,
  }
}

function createMockDbs() {
  const store = { data: {} }

  const repository = {
    created: [],
    updated: [],
    evaluations: [],
    badMoves: [],

    async createAttempt(attempt) {
      this.created.push({ ...attempt })
      store.data.attempt = { ...attempt }
      return { ...attempt }
    },

    async loadAttempt(id) {
      return store.data.attempt || null
    },

    async updateAttempt(id, patch) {
      this.updated.push({ id, patch })
      if (store.data.attempt) {
        Object.assign(store.data.attempt, patch)
      }
    },

    async createMoveEvaluation(eval_) {
      this.evaluations.push({ ...eval_ })
    },

    async createBadMove(badMove) {
      this.badMoves.push({ ...badMove })
    },
  }

  return { store, repository }
}

describe('attemptService', () => {
  let service, runtimeStore, mockRepo

  beforeEach(() => {
    runtimeStore = createTrainingRuntimeStore()
    const { repository } = createMockDbs()
    mockRepo = repository
    service = createAttemptService({
      repository: mockRepo,
      runtimeStore,
    })
  })

  describe('createAttempt', () => {
    it('creates an attempt with status playing', async () => {
      const attempt = await service.createAttempt({
        taskId: 'task_1',
        rootPositionSgf: '(;SZ[9])',
      })
      assert.strictEqual(attempt.status, 'playing')
      assert.strictEqual(attempt.result, 'pending')
      assert.strictEqual(attempt.taskId, 'task_1')
      assert.strictEqual(attempt.userLine.length, 0)
    })

    it('sets active attempt in runtime store', async () => {
      await service.createAttempt({ taskId: 'task_1', rootPositionSgf: '(;SZ[9])' })
      assert.ok(runtimeStore.getState().activeAttemptId)
    })

    it('persists to repository', async () => {
      await service.createAttempt({ taskId: 'task_1', rootPositionSgf: '(;SZ[9])' })
      assert.strictEqual(mockRepo.created.length, 1)
    })
  })

  describe('appendMove', () => {
    it('appends a move to userLine', async () => {
      await service.createAttempt({ taskId: 'task_1', rootPositionSgf: '(;SZ[9])' })
      const attemptId = runtimeStore.getState().activeAttemptId

      await service.appendMove(attemptId, 'D4')
      const update = mockRepo.updated.find(u => u.patch.userLine)
      assert.deepStrictEqual(update.patch.userLine, ['D4'])
    })

    it('throws if attempt not found', async () => {
      await assert.rejects(
        () => service.appendMove('nonexistent', 'D4'),
        /attempt not found/,
      )
    })
  })

  describe('freezeAttempt', () => {
    it('changes status to submitted', async () => {
      await service.createAttempt({ taskId: 'task_1', rootPositionSgf: '(;SZ[9])' })
      const attemptId = runtimeStore.getState().activeAttemptId

      const frozen = await service.freezeAttempt(attemptId)
      assert.strictEqual(frozen.status, 'submitted')
      assert.ok(frozen.submittedAt)
    })
  })

  describe('saveMoveEvaluation', () => {
    it('persists evaluation and updates runtime store for pending', async () => {
      const evaluation = {
        id: 'eval_1',
        attemptId: 'attempt_1',
        moveIndex: 0,
        move: 'D4',
        status: 'pending',
        createdAt: '2026-01-01T00:00:00.000Z',
      }
      await service.saveMoveEvaluation(evaluation)

      assert.strictEqual(mockRepo.evaluations.length, 1)
      const pending = runtimeStore.getState().pendingMoveEvaluations
      assert.ok(pending['eval_1'])
    })

    it('does not add non-pending evaluation to runtime store', async () => {
      const evaluation = {
        id: 'eval_2',
        attemptId: 'attempt_1',
        moveIndex: 1,
        move: 'Q16',
        status: 'evaluated',
        createdAt: '2026-01-01T00:00:00.000Z',
      }
      await service.saveMoveEvaluation(evaluation)

      const pending = runtimeStore.getState().pendingMoveEvaluations
      assert.ok(!pending['eval_2'])
    })
  })

  describe('saveBadMove', () => {
    it('persists bad move', async () => {
      const badMove = {
        id: 'bm_1',
        moveEvaluationId: 'eval_1',
        attemptId: 'attempt_1',
        taskId: 'task_1',
        moveIndex: 0,
        severity: 'major',
        punishSide: 'black',
        createdAt: '2026-01-01T00:00:00.000Z',
      }
      await service.saveBadMove(badMove)
      assert.strictEqual(mockRepo.badMoves.length, 1)
    })
  })

  describe('finalizeAttemptResult', () => {
    it('updates result and status', async () => {
      await service.createAttempt({ taskId: 'task_1', rootPositionSgf: '(;SZ[9])' })
      const attemptId = runtimeStore.getState().activeAttemptId

      await service.finalizeAttemptResult(attemptId, 'pass')
      const update = mockRepo.updated.find(u => u.patch.result === 'pass')
      assert.ok(update)
      assert.strictEqual(update.patch.result, 'pass')
    })
  })
})
