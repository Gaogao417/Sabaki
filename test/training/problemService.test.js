import assert from 'assert'

import { createProblemService } from '../../src/modules/training/problem/problemService.ts'

// --- Fake dependencies ---

function createFakeRepo(overrides = {}) {
  const problems = {}
  const badMoves = {}
  const moveEvals = {}
  const tasks = {}

  return {
    problems,
    badMoves,
    moveEvals,
    tasks,

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
    async listMoveEvaluationsByAttempt(attemptId) {
      return Object.values(moveEvals).filter(e => e.attemptId === attemptId)
    },
    async loadTask(id) {
      return tasks[id] ?? null
    },
    async updateBadMove(id, patch) {
      if (badMoves[id]) Object.assign(badMoves[id], patch)
    },

    ...overrides,
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
    userMarkedAsNotBad: undefined,
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
    status: 'evaluated',
    scoreDrop: 6.2,
    positionBeforeSgf: '(;SZ[9]AB[ee]PL[B])',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  repo.moveEvals[ev.id] = ev
  return ev
}

function seedTask(repo, overrides = {}) {
  const task = {
    id: 'task_1',
    kind: 'problem',
    source: { kind: 'problem', problemId: 'orig_prob' },
    rootPositionSgf: '(;SZ[9])',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  repo.tasks[task.id] = task
  return task
}

// --- Tests ---

describe('problemService', () => {
  let repo, service

  beforeEach(() => {
    repo = createFakeRepo()
    service = createProblemService({ repository: repo })
  })

  describe('createProblem', () => {
    it('creates a problem with defaults', async () => {
      const problem = await service.createProblem({
        positionSgf: '(;SZ[9]AB[dc]PL[B])',
        sideToMove: 'black',
      })

      assert.strictEqual(problem.type, 'best_move')
      assert.strictEqual(problem.status, 'inbox')
      assert.strictEqual(problem.positionSgf, '(;SZ[9]AB[dc]PL[B])')
      assert.strictEqual(problem.sideToMove, 'black')
      assert.ok(problem.id)
      assert.ok(problem.createdAt)
    })

    it('persists to repository', async () => {
      const problem = await service.createProblem({
        positionSgf: '(;SZ[9])',
        sideToMove: 'white',
        title: 'Test Problem',
      })

      assert.ok(repo.problems[problem.id])
      assert.strictEqual(repo.problems[problem.id].title, 'Test Problem')
    })

    it('passes source fields through', async () => {
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

    it('generates unique IDs', async () => {
      const p1 = await service.createProblem({ positionSgf: '(;SZ[9])', sideToMove: 'black' })
      const p2 = await service.createProblem({ positionSgf: '(;SZ[9])', sideToMove: 'black' })

      assert.notStrictEqual(p1.id, p2.id)
    })
  })

  describe('loadProblem', () => {
    it('returns problem if exists', async () => {
      const created = await service.createProblem({ positionSgf: '(;SZ[9])', sideToMove: 'black' })
      const loaded = await service.loadProblem(created.id)

      assert.strictEqual(loaded.id, created.id)
    })

    it('returns null if not found', async () => {
      const loaded = await service.loadProblem('nonexistent')
      assert.strictEqual(loaded, null)
    })
  })

  describe('updateProblem', () => {
    it('updates fields', async () => {
      const created = await service.createProblem({ positionSgf: '(;SZ[9])', sideToMove: 'black' })
      await service.updateProblem(created.id, { title: 'Updated' })

      assert.strictEqual(repo.problems[created.id].title, 'Updated')
    })
  })

  describe('archiveProblem', () => {
    it('sets status to archived', async () => {
      const created = await service.createProblem({ positionSgf: '(;SZ[9])', sideToMove: 'black' })
      await service.archiveProblem(created.id)

      assert.strictEqual(repo.problems[created.id].status, 'archived')
    })
  })

  describe('createPunishmentProblemFromBadMove', () => {
    it('creates punishment problem from bad move with evaluation SGF', async () => {
      seedBadMove(repo)
      seedEvaluation(repo)

      const problem = await service.createPunishmentProblemFromBadMove('bm_1')

      assert.strictEqual(problem.type, 'punishment')
      assert.strictEqual(problem.status, 'inbox')
      assert.strictEqual(problem.sideToMove, 'black')
      assert.strictEqual(problem.sourceTaskId, 'task_1')
      assert.strictEqual(problem.sourceAttemptId, 'att_1')
      assert.strictEqual(problem.sourceMoveIndex, 5)
      assert.strictEqual(problem.positionSgf, '(;SZ[9]AB[ee]PL[B])')
      assert.ok(problem.positionDescription.includes('major'))
    })

    it('falls back to task rootPositionSgf when evaluation has no SGF', async () => {
      seedBadMove(repo)
      seedEvaluation(repo, { positionBeforeSgf: undefined })
      seedTask(repo)

      const problem = await service.createPunishmentProblemFromBadMove('bm_1')

      assert.strictEqual(problem.positionSgf, '(;SZ[9])')
    })

    it('updates badMove.generatedProblemId', async () => {
      seedBadMove(repo)
      seedEvaluation(repo)

      const problem = await service.createPunishmentProblemFromBadMove('bm_1')

      assert.strictEqual(repo.badMoves['bm_1'].generatedProblemId, problem.id)
    })

    it('throws if bad move not found', async () => {
      await assert.rejects(
        () => service.createPunishmentProblemFromBadMove('missing'),
        /bad move not found/,
      )
    })

    it('works with severe bad moves', async () => {
      seedBadMove(repo, { severity: 'severe', moveIndex: 10 })
      seedEvaluation(repo, { scoreDrop: 12.5 })

      const problem = await service.createPunishmentProblemFromBadMove('bm_1')

      assert.strictEqual(problem.type, 'punishment')
      assert.ok(problem.positionDescription.includes('severe'))
    })
  })

  describe('logging', () => {
    it('logs problem creation', async () => {
      const logs = []
      const loggedService = createProblemService({
        repository: repo,
        logger: {
          info(channel, message, data) {
            logs.push({ channel, message, data })
          },
        },
      })

      await loggedService.createProblem({ positionSgf: '(;SZ[9])', sideToMove: 'black' })

      assert.ok(logs.some(l => l.channel === 'problem.create'))
    })

    it('logs punishment problem creation', async () => {
      const logs = []
      const loggedService = createProblemService({
        repository: repo,
        logger: {
          info(channel, message, data) {
            logs.push({ channel, message, data })
          },
        },
      })

      seedBadMove(repo)
      seedEvaluation(repo)

      await loggedService.createPunishmentProblemFromBadMove('bm_1')

      const log = logs.find(l => l.channel === 'problem.punishment')
      assert.ok(log)
      assert.strictEqual(log.data.badMoveId, 'bm_1')
    })
  })
})
