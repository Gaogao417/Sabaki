import assert from 'assert'

import { createProblemService } from '../../src/modules/training/problem/problemService.ts'
import {createTestLogger} from '../helpers/createTestLogger.ts'

// --- Fake dependencies ---

function createFakeRepo(overrides = {}) {
  const problems = {}
  const badMoves = {}
  const evaluations = {}
  const tasks = {}
  const schedules = {}

  return {
    problems,
    badMoves,
    evaluations,
    tasks,
    schedules,

    async createProblem(problem) {
      problems[problem.id] = { ...problem }
      return { ...problem }
    },
    async loadProblem(id) {
      return problems[id] ?? null
    },
    async updateProblem(id, patch) {
      if (problems[id]) Object.assign(problems[id], patch)
    },
    async archiveProblem(id) {
      if (problems[id]) problems[id].status = 'archived'
    },
    async loadBadMove(id) {
      return badMoves[id] ?? null
    },
    async updateBadMove(id, patch) {
      if (badMoves[id]) Object.assign(badMoves[id], patch)
    },
    async listMoveEvaluationsByAttempt(attemptId) {
      return Object.values(evaluations).filter(e => e.attemptId === attemptId)
    },
    async loadTask(id) {
      return tasks[id] ?? null
    },
    async findReviewScheduleByItem(itemId, itemType) {
      return Object.values(schedules).find(s => s.itemId === itemId && s.itemType === itemType) ?? null
    },
    async createReviewSchedule(schedule) {
      schedules[schedule.id] = { ...schedule }
      return { ...schedule }
    },

    ...overrides,
  }
}

function createFakeReviewService() {
  const addedItems = []
  return {
    addedItems,
    async addToReviewQueue(input) {
      const schedule = {
        id: `rev_${Date.now()}`,
        itemId: input.itemId,
        itemType: input.itemType,
        dueAt: new Date().toISOString(),
        intervalDays: 1,
        consecutivePassCount: 0,
        totalFailCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      addedItems.push(schedule)
      return schedule
    },
  }
}

function seedBadMove(repo, overrides = {}) {
  const bm = {
    id: 'bm_1',
    moveEvaluationId: 'eval_1',
    attemptId: 'att_1',
    taskId: 'task_1',
    moveIndex: 5,
    severity: 'major',
    punishSide: 'black',
    positionBeforeSgf: undefined,
    positionAfterSgf: undefined,
    userMarkedAsNotBad: false,
    generatedProblemId: undefined,
    recallCheckpointId: undefined,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  repo.badMoves[bm.id] = bm
  return bm
}

function seedEvaluation(repo, overrides = {}) {
  const ev = {
    id: 'eval_1',
    attemptId: 'att_1',
    moveIndex: 5,
    move: 'D4',
    positionBeforeHash: 'hash_before',
    positionAfterHash: 'hash_after',
    positionBeforeSgf: '(;SZ[9]AB[dc]PL[B])',
    positionAfterSgf: '(;SZ[9]AB[dc]PL[B];B[ee])',
    beforeScoreLead: 3.0,
    afterScoreLead: -1.5,
    scoreDrop: 4.5,
    beforeWinrate: 0.6,
    afterWinrate: 0.4,
    winrateDrop: 0.2,
    engineSuggestedMove: 'E5',
    engineSuggestedLine: ['E5', 'F6'],
    status: 'evaluated',
    createdAt: '2026-01-01T00:00:00.000Z',
    evaluatedAt: '2026-01-01T00:00:01.000Z',
    ...overrides,
  }
  repo.evaluations[ev.id] = ev
  return ev
}

function seedTask(repo, overrides = {}) {
  const task = {
    id: 'task_1',
    kind: 'problem',
    source: { kind: 'problem', problemId: 'prob_orig' },
    rootPositionSgf: '(;SZ[9]PL[B])',
    sideToMove: 'black',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  repo.tasks[task.id] = task
  return task
}

// --- Tests ---

describe('problemService', () => {
  describe('createProblem', () => {
    it('creates a problem with defaults', async () => {
      const repo = createFakeRepo()
      const service = createProblemService({ repository: repo })

      const problem = await service.createProblem({
        positionSgf: '(;SZ[9]PL[B])',
        sideToMove: 'black',
      })

      assert.strictEqual(problem.type, 'best_move')
      assert.strictEqual(problem.status, 'inbox')
      assert.strictEqual(problem.sideToMove, 'black')
      assert.ok(problem.id)
      assert.ok(problem.createdAt)
    })

    it('persists to repository', async () => {
      const repo = createFakeRepo()
      const service = createProblemService({ repository: repo })

      const problem = await service.createProblem({
        positionSgf: '(;SZ[9]PL[W])',
        sideToMove: 'white',
      })

      assert.ok(repo.problems[problem.id])
      assert.strictEqual(repo.problems[problem.id].positionSgf, '(;SZ[9]PL[W])')
    })

    it('passes source fields through', async () => {
      const repo = createFakeRepo()
      const service = createProblemService({ repository: repo })

      const problem = await service.createProblem({
        positionSgf: '(;SZ[9])',
        sideToMove: 'black',
        sourceTaskId: 'task_1',
        sourceAttemptId: 'att_1',
        sourceMoveIndex: 7,
      })

      assert.strictEqual(problem.sourceTaskId, 'task_1')
      assert.strictEqual(problem.sourceAttemptId, 'att_1')
      assert.strictEqual(problem.sourceMoveIndex, 7)
    })

    it('generates unique IDs for each snapshot', async () => {
      const repo = createFakeRepo()
      const service = createProblemService({ repository: repo })

      const p1 = await service.createProblem({ positionSgf: '(;SZ[9])', sideToMove: 'black' })
      const p2 = await service.createProblem({ positionSgf: '(;SZ[9])', sideToMove: 'black' })

      assert.notStrictEqual(p1.id, p2.id)
    })
  })

  describe('loadProblem', () => {
    it('returns problem if exists', async () => {
      const repo = createFakeRepo()
      const service = createProblemService({ repository: repo })

      const created = await service.createProblem({ positionSgf: '(;SZ[9])', sideToMove: 'black' })
      const loaded = await service.loadProblem(created.id)

      assert.strictEqual(loaded.id, created.id)
    })

    it('returns null if not found', async () => {
      const repo = createFakeRepo()
      const service = createProblemService({ repository: repo })

      const loaded = await service.loadProblem('nonexistent')
      assert.strictEqual(loaded, null)
    })
  })

  describe('updateProblem', () => {
    it('updates fields', async () => {
      const repo = createFakeRepo()
      const service = createProblemService({ repository: repo })

      const problem = await service.createProblem({ positionSgf: '(;SZ[9])', sideToMove: 'black' })
      await service.updateProblem(problem.id, { title: 'Updated' })

      assert.strictEqual(repo.problems[problem.id].title, 'Updated')
    })
  })

  describe('archiveProblem', () => {
    it('sets status to archived', async () => {
      const repo = createFakeRepo()
      const service = createProblemService({ repository: repo })

      const problem = await service.createProblem({ positionSgf: '(;SZ[9])', sideToMove: 'black' })
      await service.archiveProblem(problem.id)

      assert.strictEqual(repo.problems[problem.id].status, 'archived')
    })
  })

  describe('createPunishmentProblemFromBadMove', () => {
    it('creates punishment problem from bad move with evaluation SGF', async () => {
      const repo = createFakeRepo()
      seedBadMove(repo)
      seedEvaluation(repo)

      const service = createProblemService({ repository: repo })
      const { problem } = await service.createPunishmentProblemFromBadMove('bm_1')

      assert.strictEqual(problem.type, 'punishment')
      assert.strictEqual(problem.status, 'inbox')
      assert.strictEqual(problem.sideToMove, 'black')
      assert.strictEqual(problem.positionSgf, '(;SZ[9]AB[dc]PL[B])')
      assert.strictEqual(problem.sourceTaskId, 'task_1')
      assert.strictEqual(problem.sourceAttemptId, 'att_1')
      assert.strictEqual(problem.sourceMoveIndex, 5)
    })

    it('falls back to task rootPositionSgf when evaluation has no SGF', async () => {
      const repo = createFakeRepo()
      seedBadMove(repo)
      seedEvaluation(repo, { positionBeforeSgf: undefined })
      seedTask(repo)

      const service = createProblemService({ repository: repo })
      const { problem } = await service.createPunishmentProblemFromBadMove('bm_1')

      assert.strictEqual(problem.positionSgf, '(;SZ[9]PL[B])')
    })

    it('updates badMove.generatedProblemId', async () => {
      const repo = createFakeRepo()
      seedBadMove(repo)
      seedEvaluation(repo)

      const service = createProblemService({ repository: repo })
      const { problem } = await service.createPunishmentProblemFromBadMove('bm_1')

      assert.strictEqual(repo.badMoves['bm_1'].generatedProblemId, problem.id)
    })

    it('throws if bad move not found', async () => {
      const repo = createFakeRepo()
      const service = createProblemService({ repository: repo })

      await assert.rejects(
        () => service.createPunishmentProblemFromBadMove('missing'),
        /bad move not found/,
      )
    })

    it('works with severe bad moves', async () => {
      const repo = createFakeRepo()
      seedBadMove(repo, { severity: 'severe' })
      seedEvaluation(repo, { scoreDrop: 12.5 })

      const service = createProblemService({ repository: repo })
      const { problem } = await service.createPunishmentProblemFromBadMove('bm_1')

      assert.strictEqual(problem.type, 'punishment')
      assert.ok(problem.positionDescription.includes('severe'))
    })
  })

  describe('createPunishmentProblemFromBadMove → ReviewSchedule integration', () => {
    it('adds punishment problem to review queue when reviewService is provided', async () => {
      const repo = createFakeRepo()
      seedBadMove(repo)
      seedEvaluation(repo)

      const fakeReview = createFakeReviewService()
      const service = createProblemService({ repository: repo, reviewService: fakeReview })

      const { problem, reviewScheduleId } = await service.createPunishmentProblemFromBadMove('bm_1')

      assert.ok(reviewScheduleId, 'should return a reviewScheduleId')
      assert.strictEqual(fakeReview.addedItems.length, 1)
      assert.strictEqual(fakeReview.addedItems[0].itemId, problem.id)
      assert.strictEqual(fakeReview.addedItems[0].itemType, 'problem')
    })

    it('skips review queue when no reviewService provided', async () => {
      const repo = createFakeRepo()
      seedBadMove(repo)
      seedEvaluation(repo)

      const service = createProblemService({ repository: repo })
      const { problem, reviewScheduleId } = await service.createPunishmentProblemFromBadMove('bm_1')

      assert.strictEqual(reviewScheduleId, undefined)
      assert.strictEqual(Object.keys(repo.schedules).length, 0)
    })

    it('punishment problem is discoverable in review queue after creation', async () => {
      const repo = createFakeRepo()
      seedBadMove(repo)
      seedEvaluation(repo)

      const fakeReview = createFakeReviewService()
      const service = createProblemService({ repository: repo, reviewService: fakeReview })

      const { problem } = await service.createPunishmentProblemFromBadMove('bm_1')

      const schedule = fakeReview.addedItems.find(s => s.itemId === problem.id)
      assert.ok(schedule, 'punishment problem should have a review schedule')
      assert.strictEqual(schedule.itemType, 'problem')
    })
  })

  describe('logging', () => {
    it('logs problem creation', async () => {
      const {logger, logs} = createTestLogger()
      const repo = createFakeRepo()
      const service = createProblemService({
        repository: repo,
        logger,
      })

      await service.createProblem({ positionSgf: '(;SZ[9])', sideToMove: 'black' })

      assert.ok(logs.some(l => l.channel === 'problem.create'))
    })

    it('logs punishment problem creation with reviewScheduleId', async () => {
      const {logger, logs} = createTestLogger()
      const repo = createFakeRepo()
      seedBadMove(repo)
      seedEvaluation(repo)

      const fakeReview = createFakeReviewService()
      const service = createProblemService({
        repository: repo,
        reviewService: fakeReview,
        logger,
      })

      const { reviewScheduleId } = await service.createPunishmentProblemFromBadMove('bm_1')

      const log = logs.find(l => l.channel === 'problem.punishment')
      assert.ok(log)
      assert.strictEqual(log.data.reviewScheduleId, reviewScheduleId)
    })
  })
})
