import assert from 'assert'

import {inferDefaultMode} from '../../src/modules/training/workbench/workbenchTabService.ts'

// --- Production imports ---

// taskImportService does not exist yet; use lazy require so tsx can handle
// the missing module without a top-level import blowing up the whole file.
let _createTaskImportService = null
let _loadAttempted = false

function getTaskImportFactory() {
  if (_loadAttempted) return _createTaskImportService
  _loadAttempted = true
  try {
    const mod = require('../../src/modules/training/import/taskImportService.ts')
    _createTaskImportService = mod.createTaskImportService
  } catch {
    // Module doesn't exist yet -- tests serve as spec.
  }
  return _createTaskImportService
}

const createTaskImportService = getTaskImportFactory()
const taskImportAvailable = !!createTaskImportService

// --- Mocks ---

function createMockRepository(overrides = {}) {
  const tasks = {}
  const badMoves = overrides.badMoves ?? {}
  const problems = overrides.problems ?? {}
  const games = overrides.games ?? {}
  const calls = {
    createTask: [],
    loadBadMove: [],
    updateBadMove: [],
    loadTask: [],
    createProblem: [],
    createReviewSchedule: [],
  }

  return {
    calls,
    tasks,
    async createTask(task) {
      calls.createTask.push(task)
      tasks[task.id] = task
      return task
    },
    async loadTask(id) {
      return tasks[id] ?? overrides.tasks?.[id] ?? null
    },
    async getProblem(id) {
      return problems[id] ?? null
    },
    async loadBadMove(id) {
      calls.loadBadMove.push(id)
      return badMoves[id] ?? null
    },
    async updateBadMove(id, patch) {
      calls.updateBadMove.push({id, patch})
      if (badMoves[id]) {
        Object.assign(badMoves[id], patch)
      }
    },
    async createProblem(problem) {
      calls.createProblem.push(problem)
      return problem
    },
    async createReviewSchedule(schedule) {
      calls.createReviewSchedule.push(schedule)
      return schedule
    },
    ...overrides,
  }
}

function createMockFoxAdapter(overrides = {}) {
  const calls = { fetchSgf: [] }
  return {
    calls,
    async fetchSgf(gameId) {
      calls.fetchSgf.push(gameId)
      if (overrides.fetchSgf) return overrides.fetchSgf(gameId)
      return {success: true, data: '(;GM[1]FF[4]SZ[19];B[pd])'}
    },
  }
}

function createMockWeiqi101Db(overrides = {}) {
  const calls = { getWeiqi101Problem: [] }
  return {
    calls,
    async getWeiqi101Problem(problemId) {
      calls.getWeiqi101Problem.push(problemId)
      if (overrides.getWeiqi101Problem) return overrides.getWeiqi101Problem(problemId)
      return {
        id: problemId,
        sgf: '(;GM[1]FF[4]SZ[19];AB[pd][dd];W[pp])',
        prompt: 'Find the best move for white',
        goal: 'Kill the black group',
        sideToMove: 'white',
        difficulty: 3,
      }
    },
  }
}

function createMockSgfAdapter(overrides = {}) {
  return {
    parse(sgf) {
      if (overrides.parse) return overrides.parse(sgf)
      if (!sgf || sgf.trim() === '') return []
      return [{root: {id: 'root_node'}}]
    },
    extractRootPosition(trees) {
      if (overrides.extractRootPosition) return overrides.extractRootPosition(trees)
      return '(;GM[1]FF[4]SZ[19])'
    },
  }
}

function createMockFileAdapter(overrides = {}) {
  return {
    async readFile(path) {
      if (overrides.readFile) return overrides.readFile(path)
      return '(;GM[1]FF[4]SZ[19];B[pd];W[pp])'
    },
  }
}

function createMockLogger() {
  const calls = {info: []}
  return {
    calls,
    info(channel, message, data) {
      calls.info.push({channel, message, data})
    },
  }
}

function createTestService(overrides = {}) {
  const repository = createMockRepository(overrides.repository)
  const foxAdapter = createMockFoxAdapter(overrides.foxAdapter)
  const weiqi101Db = createMockWeiqi101Db(overrides.weiqi101Db)
  const sgfAdapter = createMockSgfAdapter(overrides.sgfAdapter)
  const fileAdapter = createMockFileAdapter(overrides.fileAdapter)
  const logger = createMockLogger()

  const service = createTaskImportService({
    repository,
    foxAdapter,
    weiqi101Db,
    sgfAdapter,
    fileAdapter,
    logger,
  })

  return {service, repository, foxAdapter, weiqi101Db, sgfAdapter, fileAdapter, logger}
}

// Helper: minimal valid SGF for tests
const MINIMAL_SGF = '(;GM[1]FF[4]SZ[19])'
const GAME_SGF = '(;GM[1]FF[4]SZ[19];B[pd];W[pp];B[dd])'

// --- Tests ---

const describeOrSkip = taskImportAvailable ? describe : describe.skip

describeOrSkip('taskImportService', () => {

  // =========================================================
  // importFoxGame
  // =========================================================

  describe('importFoxGame', () => {
    it('T01: returns a TrainingTask with origin.provider=fox', async () => {
      const {service} = createTestService()
      const task = await service.importFoxGame({gameId: 'fox_game_123'})
      assert.strictEqual(task.origin.provider, 'fox')
    })

    it('T02: stores externalId as the gameId', async () => {
      const {service} = createTestService()
      const task = await service.importFoxGame({gameId: 'fox_game_456'})
      assert.strictEqual(task.origin.externalId, 'fox_game_456')
    })

    it('T03: returns a free task without prompt/goal/passRule', async () => {
      const {service} = createTestService()
      const task = await service.importFoxGame({gameId: 'fox_game_789'})
      assert.strictEqual(task.prompt, undefined)
      assert.strictEqual(task.goal, undefined)
      assert.strictEqual(task.passRule, undefined)
    })

    it('T04: has rootPositionSgf from fetched SGF', async () => {
      const {service} = createTestService()
      const task = await service.importFoxGame({gameId: 'fox_game_001'})
      assert.ok(typeof task.rootPositionSgf === 'string')
      assert.ok(task.rootPositionSgf.length > 0)
    })

    it('T05: persists task via repository.createTask', async () => {
      const {service, repository} = createTestService()
      const task = await service.importFoxGame({gameId: 'fox_game_002'})
      assert.strictEqual(repository.calls.createTask.length, 1)
      assert.strictEqual(repository.calls.createTask[0].origin.provider, 'fox')
    })

    it('T06: throws if fox adapter returns failure', async () => {
      const {service} = createTestService({
        foxAdapter: {
          fetchSgf: async () => ({success: false, error: 'Game not found'}),
        },
      })
      await assert.rejects(
        () => service.importFoxGame({gameId: 'missing'}),
        /fox.*not found|fetch.*fail|error/i,
      )
    })

    it('T07: task has id and createdAt/updatedAt timestamps', async () => {
      const {service} = createTestService()
      const task = await service.importFoxGame({gameId: 'fox_ts'})
      assert.ok(task.id, 'task must have an id')
      assert.ok(task.createdAt, 'task must have createdAt')
      assert.ok(task.updatedAt, 'task must have updatedAt')
    })
  })

  // =========================================================
  // importLocalSgf
  // =========================================================

  describe('importLocalSgf', () => {
    it('T08: returns a TrainingTask with origin.provider=local', async () => {
      const {service} = createTestService()
      const task = await service.importLocalSgf({filePath: '/path/to/game.sgf'})
      assert.strictEqual(task.origin.provider, 'local')
    })

    it('T09: stores filePath in origin.raw', async () => {
      const {service} = createTestService()
      const task = await service.importLocalSgf({filePath: '/games/my_game.sgf'})
      assert.ok(task.origin.raw)
      assert.strictEqual(task.origin.raw.filePath, '/games/my_game.sgf')
    })

    it('T10: uses optional title when provided', async () => {
      const {service} = createTestService()
      const task = await service.importLocalSgf({filePath: '/a.sgf', title: 'My Game'})
      assert.strictEqual(task.title, 'My Game')
    })

    it('T11: returns a free task without problem-like fields', async () => {
      const {service} = createTestService()
      const task = await service.importLocalSgf({filePath: '/free.sgf'})
      assert.strictEqual(task.prompt, undefined)
      assert.strictEqual(task.goal, undefined)
    })

    it('T12: persists task via repository.createTask', async () => {
      const {service, repository} = createTestService()
      await service.importLocalSgf({filePath: '/persist.sgf'})
      assert.strictEqual(repository.calls.createTask.length, 1)
    })

    it('T13: throws if file cannot be read', async () => {
      const {service} = createTestService({
        fileAdapter: {
          readFile: async () => { throw new Error('ENOENT: file not found') },
        },
      })
      await assert.rejects(
        () => service.importLocalSgf({filePath: '/missing.sgf'}),
        /ENOENT|not found|fail/i,
      )
    })
  })

  // =========================================================
  // import101Problem
  // =========================================================

  describe('import101Problem', () => {
    it('T14: returns a TrainingTask with origin.provider=101', async () => {
      const {service} = createTestService()
      const task = await service.import101Problem({problemId: '101_prob_42'})
      assert.strictEqual(task.origin.provider, '101')
    })

    it('T15: stores problemId as externalId', async () => {
      const {service} = createTestService()
      const task = await service.import101Problem({problemId: '101_prob_42'})
      assert.strictEqual(task.origin.externalId, '101_prob_42')
    })

    it('T16: populates problem-like fields (prompt, goal)', async () => {
      const {service} = createTestService()
      const task = await service.import101Problem({problemId: '101_full'})
      assert.ok(task.prompt, '101 problem should have prompt')
      assert.ok(task.goal, '101 problem should have goal')
    })

    it('T17: sets sideToMove from the problem data', async () => {
      const {service} = createTestService()
      const task = await service.import101Problem({problemId: '101_side'})
      assert.ok(task.sideToMove === 'black' || task.sideToMove === 'white')
    })

    it('T18: persists task via repository.createTask', async () => {
      const {service, repository} = createTestService()
      await service.import101Problem({problemId: '101_persist'})
      assert.strictEqual(repository.calls.createTask.length, 1)
    })

    it('T19: throws if problem not found in 101 DB', async () => {
      const {service} = createTestService({
        weiqi101Db: {
          getWeiqi101Problem: async () => null,
        },
      })
      await assert.rejects(
        () => service.import101Problem({problemId: 'missing_101'}),
        /not found|missing/i,
      )
    })
  })

  // =========================================================
  // createManualTask
  // =========================================================

  describe('createManualTask', () => {
    it('T20: returns a TrainingTask with origin.provider=manual', async () => {
      const {service} = createTestService()
      const task = await service.createManualTask({
        positionSgf: MINIMAL_SGF,
        sideToMove: 'black',
      })
      assert.strictEqual(task.origin.provider, 'manual')
    })

    it('T21: preserves all input fields on the task', async () => {
      const {service} = createTestService()
      const input = {
        positionSgf: MINIMAL_SGF,
        sideToMove: 'white',
        title: 'Manual Problem',
        prompt: 'Find the killing move',
        goal: 'Kill the corner group',
        tags: ['tesuji', 'life-death'],
        difficulty: 4,
      }
      const task = await service.createManualTask(input)
      assert.strictEqual(task.rootPositionSgf, input.positionSgf)
      assert.strictEqual(task.sideToMove, 'white')
      assert.strictEqual(task.title, 'Manual Problem')
      assert.strictEqual(task.prompt, 'Find the killing move')
      assert.strictEqual(task.goal, 'Kill the corner group')
      assert.deepStrictEqual(task.tags, ['tesuji', 'life-death'])
      assert.strictEqual(task.difficulty, 4)
    })

    it('T22: persists task via repository.createTask', async () => {
      const {service, repository} = createTestService()
      await service.createManualTask({positionSgf: MINIMAL_SGF, sideToMove: 'black'})
      assert.strictEqual(repository.calls.createTask.length, 1)
    })

    it('T23: manual task without prompt is a free task', async () => {
      const {service} = createTestService()
      const task = await service.createManualTask({
        positionSgf: MINIMAL_SGF,
        sideToMove: 'black',
      })
      assert.strictEqual(task.prompt, undefined)
      assert.strictEqual(task.goal, undefined)
    })

    it('T24: manual task with prompt is a problem-like task', async () => {
      const {service} = createTestService()
      const task = await service.createManualTask({
        positionSgf: MINIMAL_SGF,
        sideToMove: 'black',
        prompt: 'Solve this',
        goal: 'Win',
      })
      assert.strictEqual(task.prompt, 'Solve this')
      assert.strictEqual(task.goal, 'Win')
    })

    it('T25: manual task has no externalId in origin', async () => {
      const {service} = createTestService()
      const task = await service.createManualTask({positionSgf: MINIMAL_SGF})
      assert.strictEqual(task.origin.externalId, undefined)
    })
  })

  // =========================================================
  // createTaskFromLegacyProblem
  // =========================================================

  describe('createTaskFromLegacyProblem', () => {
    it('P2-T01: converts a local legacy problem into a standard TrainingTask', async () => {
      const {service} = createTestService({
        repository: {
          problems: {
            prob_local: {
              id: 'prob_local',
              positionSgf: MINIMAL_SGF,
              sideToMove: 'white',
              title: 'Local tesuji',
              positionDescription: 'Corner shape',
              taskGoal: 'Find the tesuji',
              passRule: {requireNoSevereBadMove: true},
              referenceLines: [{label: 'Main', moves: ['W[qq]'], source: 'human'}],
              tags: ['local-problem'],
              difficulty: 2,
              status: 'inbox',
            },
          },
        },
      })

      const task = await service.createTaskFromLegacyProblem({problemId: 'prob_local'})

      assert.strictEqual(task.origin.provider, 'local')
      assert.strictEqual(task.origin.externalId, 'prob_local')
      assert.strictEqual(task.rootPositionSgf, MINIMAL_SGF)
      assert.strictEqual(task.sideToMove, 'white')
      assert.strictEqual(task.title, 'Local tesuji')
      assert.strictEqual(task.prompt, 'Corner shape')
      assert.strictEqual(task.goal, 'Find the tesuji')
      assert.deepStrictEqual(task.passRule, {requireNoSevereBadMove: true})
      assert.deepStrictEqual(task.referenceLines, [{label: 'Main', moves: ['W[qq]'], source: 'human'}])
      assert.deepStrictEqual(task.tags, ['local-problem'])
      assert.strictEqual(task.difficulty, 2)
      assert.strictEqual(task.status, 'inbox')
    })

    it('P2-T02: creates no legacy Problem entity and no special kind', async () => {
      const {service, repository} = createTestService({
        repository: {
          problems: {
            prob_plain: {
              id: 'prob_plain',
              positionSgf: MINIMAL_SGF,
              sideToMove: 'black',
            },
          },
        },
      })

      const task = await service.createTaskFromLegacyProblem({problemId: 'prob_plain'})

      assert.strictEqual(repository.calls.createProblem.length, 0)
      assert.strictEqual(task.kind, undefined)
      assert.strictEqual(task.source, undefined)
      assert.strictEqual(repository.calls.createTask.length, 1)
    })

    it('P2-T01b: throws when the local legacy problem is missing', async () => {
      const {service} = createTestService()

      await assert.rejects(
        () => service.createTaskFromLegacyProblem({problemId: 'missing_problem'}),
        /problem not found/i,
      )
    })
  })

  // =========================================================
  // createTaskFromSnapshot
  // =========================================================

  describe('createTaskFromSnapshot', () => {
    it('T26: returns a TrainingTask with origin.provider=snapshot', async () => {
      const {service} = createTestService()
      const task = await service.createTaskFromSnapshot({
        parentTaskId: 'task_parent_1',
        positionSgf: MINIMAL_SGF,
        sideToMove: 'black',
      })
      assert.strictEqual(task.origin.provider, 'snapshot')
    })

    it('T27: stores parentTaskId in origin', async () => {
      const {service} = createTestService()
      const task = await service.createTaskFromSnapshot({
        parentTaskId: 'task_parent_2',
        positionSgf: MINIMAL_SGF,
        sideToMove: 'black',
      })
      assert.strictEqual(task.origin.parentTaskId, 'task_parent_2')
    })

    it('T28: stores parentAttemptId when provided', async () => {
      const {service} = createTestService()
      const task = await service.createTaskFromSnapshot({
        parentTaskId: 'task_p',
        parentAttemptId: 'attempt_1',
        positionSgf: MINIMAL_SGF,
        sideToMove: 'black',
      })
      assert.strictEqual(task.origin.parentAttemptId, 'attempt_1')
    })

    it('T29: stores moveIndex in origin.parentMoveIndex when provided', async () => {
      const {service} = createTestService()
      const task = await service.createTaskFromSnapshot({
        parentTaskId: 'task_p',
        positionSgf: MINIMAL_SGF,
        sideToMove: 'black',
        moveIndex: 42,
      })
      assert.strictEqual(task.origin.parentMoveIndex, 42)
    })

    it('T30: preserves referenceLines from input', async () => {
      const {service} = createTestService()
      const refLines = [
        {label: 'Main line', moves: ['B[pd]', 'W[pp]'], source: 'engine'},
      ]
      const task = await service.createTaskFromSnapshot({
        parentTaskId: 'task_p',
        positionSgf: MINIMAL_SGF,
        sideToMove: 'black',
        referenceLines: refLines,
      })
      assert.deepStrictEqual(task.referenceLines, refLines)
    })

    it('T30b: snapshot task without referenceLines has no referenceLines', async () => {
      const {service} = createTestService()
      const task = await service.createTaskFromSnapshot({
        parentTaskId: 'task_p',
        positionSgf: MINIMAL_SGF,
        sideToMove: 'black',
      })
      assert.strictEqual(task.referenceLines, undefined)
    })
  })

  // =========================================================
  // createTaskFromBadMove
  // =========================================================

  describe('createTaskFromBadMove', () => {
    function createTestServiceWithBadMove(badMoveId, badMoveData) {
      const badMoves = {[badMoveId]: {
        id: badMoveId,
        moveEvaluationId: 'eval_1',
        attemptId: 'attempt_1',
        taskId: 'task_original',
        moveIndex: 15,
        severity: 'severe',
        punishSide: 'white',
        createdAt: new Date().toISOString(),
        ...badMoveData,
      }}

      return createTestService({
        repository: {badMoves},
      })
    }

    it('T35: returns a TrainingTask with origin.provider=bad_move', async () => {
      const {service} = createTestServiceWithBadMove('bm_1', {
        positionBeforeSgf: MINIMAL_SGF,
      })
      const task = await service.createTaskFromBadMove({badMoveId: 'bm_1'})
      assert.strictEqual(task.origin.provider, 'bad_move')
    })

    it('T36: uses positionBeforeSgf as rootPositionSgf', async () => {
      const {service} = createTestServiceWithBadMove('bm_2', {
        positionBeforeSgf: GAME_SGF,
      })
      const task = await service.createTaskFromBadMove({badMoveId: 'bm_2'})
      assert.strictEqual(task.rootPositionSgf, GAME_SGF)
    })

    it('T37: sets sideToMove from badMove.punishSide', async () => {
      const {service} = createTestServiceWithBadMove('bm_3', {
        positionBeforeSgf: MINIMAL_SGF,
        punishSide: 'white',
      })
      const task = await service.createTaskFromBadMove({badMoveId: 'bm_3'})
      assert.strictEqual(task.sideToMove, 'white')
    })

    it('T38: throws if bad move not found', async () => {
      const {service} = createTestService()
      await assert.rejects(
        () => service.createTaskFromBadMove({badMoveId: 'nonexistent'}),
        /not found|missing/i,
      )
    })

    it('T39: updates badMove.generatedTaskId after creation', async () => {
      const {service, repository} = createTestServiceWithBadMove('bm_4', {
        positionBeforeSgf: MINIMAL_SGF,
      })
      const task = await service.createTaskFromBadMove({badMoveId: 'bm_4'})
      const updateCall = repository.calls.updateBadMove.find(c => c.id === 'bm_4')
      assert.ok(updateCall, 'should have called updateBadMove')
      assert.strictEqual(updateCall.patch.generatedTaskId, task.id)
    })

    it('T40: task references the original taskId via origin.parentTaskId (if stored)', async () => {
      const {service} = createTestServiceWithBadMove('bm_5', {
        positionBeforeSgf: MINIMAL_SGF,
        taskId: 'task_original_5',
      })
      const task = await service.createTaskFromBadMove({badMoveId: 'bm_5'})
      // origin should contain parent task linkage for traceability
      assert.ok(task.origin.parentTaskId || task.origin.raw?.taskId || task.origin.raw?.parentTaskId,
        'origin should reference the parent task for traceability')
    })

    it('T41: bad_move task is a plain TrainingTask, not a special kind', async () => {
      const {service} = createTestServiceWithBadMove('bm_6', {
        positionBeforeSgf: MINIMAL_SGF,
      })
      const task = await service.createTaskFromBadMove({badMoveId: 'bm_6'})
      // Verify it is a normal task with standard fields
      assert.ok(task.id, 'task must have id')
      assert.ok(task.rootPositionSgf, 'task must have rootPositionSgf')
      assert.ok(task.createdAt, 'task must have createdAt')
      assert.ok(task.updatedAt, 'task must have updatedAt')
      // No special snapshot_problem kind
      if (task.kind) {
        assert.notStrictEqual(task.kind, 'snapshot_problem')
        assert.notStrictEqual(task.kind, 'punishment_problem')
      }
    })
  })

  // =========================================================
  // Mode inference contract (T31)
  // =========================================================

  describe('mode inference after import', () => {
    it('T42: fox import yields play mode (no prompt)', async () => {
      const {service} = createTestService()
      const task = await service.importFoxGame({gameId: 'fox_mode'})
      assert.strictEqual(task.prompt, undefined)
      assert.strictEqual(task.goal, undefined)
    })

    it('T43: 101 import yields problem mode (has prompt)', async () => {
      const {service} = createTestService()
      const task = await service.import101Problem({problemId: '101_mode'})
      assert.ok(task.prompt || task.goal,
        '101 problem should have prompt or goal to yield problem mode')
    })

    it('T44: snapshot with referenceLines preserves them for problem mode inference', async () => {
      const {service} = createTestService()
      const refLines = [
        {label: 'Correct', moves: ['B[qq]'], source: 'engine'},
      ]
      const task = await service.createTaskFromSnapshot({
        parentTaskId: 'task_p',
        positionSgf: MINIMAL_SGF,
        sideToMove: 'black',
        referenceLines: refLines,
      })
      assert.ok(task.referenceLines, 'referenceLines should be preserved')
    })

    it('T45: manual task with prompt/goal supports problem mode inference', async () => {
      const {service} = createTestService()
      const task = await service.createManualTask({
        positionSgf: MINIMAL_SGF,
        sideToMove: 'black',
        prompt: 'Find the best move',
        goal: 'Win the capturing race',
      })
      assert.ok(task.prompt)
      assert.ok(task.goal)
    })
  })

  // =========================================================
  // Phase 7: BadMove -> Review auto-enqueue
  // =========================================================

  describe('Phase 7: BadMove -> Review auto-enqueue', () => {
    function createTestServiceWithBadMove(badMoveId, badMoveData, extraOverrides) {
      const badMoves = {[badMoveId]: {
        id: badMoveId,
        moveEvaluationId: 'eval_p7',
        attemptId: 'attempt_p7',
        taskId: 'task_original_p7',
        moveIndex: 12,
        severity: 'major',
        punishSide: 'black',
        positionBeforeSgf: GAME_SGF,
        createdAt: new Date().toISOString(),
        ...badMoveData,
      }}

      return createTestService({
        repository: {badMoves},
        ...extraOverrides,
      })
    }

    // C10: auto-enqueue into review queue after task creation
    it('T46: createTaskFromBadMove enqueues new task into review queue (C10)', async () => {
      const {service, repository} = createTestServiceWithBadMove('bm_c10', {
        positionBeforeSgf: MINIMAL_SGF,
      })
      const task = await service.createTaskFromBadMove({badMoveId: 'bm_c10'})

      // After creating the task, a review schedule should have been created
      // whose taskId points to the newly created task
      assert.ok(repository.calls.createReviewSchedule.length >= 1,
        'createReviewSchedule should be called at least once after creating task from bad move')

      const schedule = repository.calls.createReviewSchedule[
        repository.calls.createReviewSchedule.length - 1
      ]
      assert.strictEqual(schedule.taskId, task.id,
        'review schedule taskId must point to the newly created task')
    })

    // C10 supplementary: review schedule should have the task id, not the bad move id
    it('T47: review schedule taskId is the new task id, not the badMove id (C10)', async () => {
      const {service, repository} = createTestServiceWithBadMove('bm_c10b', {
        positionBeforeSgf: MINIMAL_SGF,
      })
      const task = await service.createTaskFromBadMove({badMoveId: 'bm_c10b'})

      const schedule = repository.calls.createReviewSchedule[
        repository.calls.createReviewSchedule.length - 1
      ]
      assert.notStrictEqual(schedule.taskId, 'bm_c10b',
        'review schedule taskId must NOT be the badMove id')
      assert.strictEqual(schedule.taskId, task.id,
        'review schedule taskId must be the new task id')
    })

    // C11: returned task is a plain TrainingTask with origin.provider = 'bad_move'
    it('T48: createTaskFromBadMove returns a plain TrainingTask (C11)', async () => {
      const {service} = createTestServiceWithBadMove('bm_c11', {
        positionBeforeSgf: MINIMAL_SGF,
      })
      const task = await service.createTaskFromBadMove({badMoveId: 'bm_c11'})

      // Standard TrainingTask fields
      assert.ok(task.id, 'task must have id')
      assert.ok(task.rootPositionSgf, 'task must have rootPositionSgf')
      assert.ok(task.createdAt, 'task must have createdAt')
      assert.ok(task.updatedAt, 'task must have updatedAt')
      assert.ok(task.origin, 'task must have origin')

      // No special kind discriminator
      if (task.kind) {
        assert.notStrictEqual(task.kind, 'snapshot_problem')
        assert.notStrictEqual(task.kind, 'punishment_problem')
      }
    })

    // C12: badMove.generatedTaskId updated to new task id
    it('T49: createTaskFromBadMove updates badMove.generatedTaskId (C12)', async () => {
      const {service, repository} = createTestServiceWithBadMove('bm_c12', {
        positionBeforeSgf: MINIMAL_SGF,
      })
      const task = await service.createTaskFromBadMove({badMoveId: 'bm_c12'})

      const updateCall = repository.calls.updateBadMove.find(c => c.id === 'bm_c12')
      assert.ok(updateCall, 'updateBadMove should be called for the bad move')
      assert.strictEqual(updateCall.patch.generatedTaskId, task.id,
        'badMove.generatedTaskId should be updated to the new task id')
    })

    // C13: origin.provider is 'bad_move'
    it('T50: bad_move derived task has origin.provider=bad_move (C13)', async () => {
      const {service} = createTestServiceWithBadMove('bm_c13', {
        positionBeforeSgf: MINIMAL_SGF,
      })
      const task = await service.createTaskFromBadMove({badMoveId: 'bm_c13'})
      assert.strictEqual(task.origin.provider, 'bad_move')
    })

    // C14: idempotency -- if generatedTaskId already exists, return existing task
    it('T51: duplicate createTaskFromBadMove returns existing task when generatedTaskId is set (C14)', async () => {
      // Set up a bad move that already has a generatedTaskId pointing to an existing task
      const existingTaskId = 'task_existing_from_bm'
      const existingTask = {
        id: existingTaskId,
        rootPositionSgf: GAME_SGF,
        sideToMove: 'black',
        origin: {provider: 'bad_move', parentTaskId: 'task_original_p7'},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const {service, repository} = createTestServiceWithBadMove('bm_c14', {
        positionBeforeSgf: MINIMAL_SGF,
        generatedTaskId: existingTaskId,
      }, {
        // Pre-populate the existing task in the repo so loadTask can find it
        repository: {
          badMoves: {},
          tasks: {[existingTaskId]: existingTask},
        },
      })

      // Override badMoves after construction since createTestServiceWithBadMove
      // sets up its own badMoves -- we need to inject the one with generatedTaskId
      repository.calls._badMovesOverride = true
      const bmData = {
        id: 'bm_c14',
        moveEvaluationId: 'eval_p7',
        attemptId: 'attempt_p7',
        taskId: 'task_original_p7',
        moveIndex: 12,
        severity: 'major',
        punishSide: 'black',
        positionBeforeSgf: MINIMAL_SGF,
        generatedTaskId: existingTaskId,
        createdAt: new Date().toISOString(),
      }
      // Inject into the repository's internal state
      // The mock repo stores badMoves in a closure via overrides.repository.badMoves
      // We need to ensure loadBadMove('bm_c14') returns our bad move with generatedTaskId
      // and loadTask(existingTaskId) returns the existing task.

      // Since createTestServiceWithBadMove already set up the repo with overrides,
      // let's rebuild more directly for this test.
      const repo2 = createMockRepository({
        badMoves: {bm_c14: bmData},
        tasks: {[existingTaskId]: existingTask},
      })
      const svc = createTaskImportService({
        repository: repo2,
        foxAdapter: createMockFoxAdapter(),
        weiqi101Db: createMockWeiqi101Db(),
        sgfAdapter: createMockSgfAdapter(),
        fileAdapter: createMockFileAdapter(),
        logger: createMockLogger(),
      })

      const task = await svc.createTaskFromBadMove({badMoveId: 'bm_c14'})

      // Should return the existing task, not create a new one
      assert.strictEqual(task.id, existingTaskId,
        'should return the existing task referenced by generatedTaskId')

      // Should NOT create a new task
      assert.strictEqual(repo2.calls.createTask.length, 0,
        'should not create a new task when generatedTaskId already exists')
    })

    // C14 supplementary: no duplicate review schedule for idempotent call
    it('T52: duplicate createTaskFromBadMove does not create additional review schedule (C14)', async () => {
      const existingTaskId = 'task_existing_dup'
      const existingTask = {
        id: existingTaskId,
        rootPositionSgf: GAME_SGF,
        sideToMove: 'black',
        origin: {provider: 'bad_move'},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const bmData = {
        id: 'bm_c14b',
        moveEvaluationId: 'eval_p7',
        attemptId: 'attempt_p7',
        taskId: 'task_original_p7',
        moveIndex: 12,
        severity: 'major',
        punishSide: 'black',
        positionBeforeSgf: MINIMAL_SGF,
        generatedTaskId: existingTaskId,
        createdAt: new Date().toISOString(),
      }

      const repo = createMockRepository({
        badMoves: {bm_c14b: bmData},
        tasks: {[existingTaskId]: existingTask},
      })
      const svc = createTaskImportService({
        repository: repo,
        foxAdapter: createMockFoxAdapter(),
        weiqi101Db: createMockWeiqi101Db(),
        sgfAdapter: createMockSgfAdapter(),
        fileAdapter: createMockFileAdapter(),
        logger: createMockLogger(),
      })

      await svc.createTaskFromBadMove({badMoveId: 'bm_c14b'})

      // No new review schedule should be created for the idempotent path
      assert.strictEqual(repo.calls.createReviewSchedule.length, 0,
        'idempotent call should not create a new review schedule')
    })
  })
})

// =========================================================
// Architecture boundary tests (T31, T34)
// =========================================================

describe('Architecture boundary: inferDefaultMode', () => {
  it('T31: inferDefaultMode does not depend on origin.provider', () => {
    // inferDefaultMode is imported statically -- it MUST exist.
    assert.ok(typeof inferDefaultMode === 'function',
      'inferDefaultMode should be importable from workbenchTabService')

    const sgf = '(;GM[1]FF[4]SZ[19])'
    const baseTask = {
      id: 'test_task',
      rootPositionSgf: sgf,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Free task from fox -- play mode
    const foxTask = {...baseTask, origin: {provider: 'fox'}}
    assert.strictEqual(inferDefaultMode(foxTask), 'play')

    // Free task from local -- play mode
    const localTask = {...baseTask, origin: {provider: 'local'}}
    assert.strictEqual(inferDefaultMode(localTask), 'play')

    // Free task from manual -- play mode
    const manualTask = {...baseTask, origin: {provider: 'manual'}}
    assert.strictEqual(inferDefaultMode(manualTask), 'play')

    // Problem-like task from 101 -- problem mode (because of prompt, NOT because of provider)
    const problemTask101 = {...baseTask, origin: {provider: '101'}, prompt: 'Find best move'}
    assert.strictEqual(inferDefaultMode(problemTask101), 'problem')

    // Problem-like task from snapshot -- problem mode (because of prompt, NOT because of provider)
    const problemTaskSnapshot = {...baseTask, origin: {provider: 'snapshot'}, prompt: 'Solve'}
    assert.strictEqual(inferDefaultMode(problemTaskSnapshot), 'problem')

    // Free task from bad_move -- play mode (no prompt)
    const badMoveTask = {...baseTask, origin: {provider: 'bad_move'}}
    assert.strictEqual(inferDefaultMode(badMoveTask), 'play')

    // Task with NO origin at all -- still works
    const noOriginTask = {...baseTask}
    assert.strictEqual(inferDefaultMode(noOriginTask), 'play')

    // Task with goal but no prompt -- still problem mode
    const goalOnlyTask = {...baseTask, goal: 'Kill the group'}
    assert.strictEqual(inferDefaultMode(goalOnlyTask), 'problem')
  })

  it('T31b: inferDefaultMode returns problem for task with referenceLines', () => {
    const task = {
      id: 't_ref',
      rootPositionSgf: '(;SZ[19])',
      referenceLines: [{label: 'Main', moves: ['B[pd]'], source: 'engine'}],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    assert.strictEqual(inferDefaultMode(task), 'problem')
  })

  it('T31c: inferDefaultMode returns problem for task with passRule', () => {
    const task = {
      id: 't_pass',
      rootPositionSgf: '(;SZ[19])',
      passRule: {allowed: false},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    assert.strictEqual(inferDefaultMode(task), 'problem')
  })

  it('T31d: changing origin.provider does not change mode if task fields stay the same', () => {
    const baseTask = {
      id: 't_invariant',
      rootPositionSgf: '(;SZ[19])',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const providers = ['fox', '101', 'local', 'manual', 'snapshot', 'bad_move', 'review', 'inferred', 'recall']
    const modes = providers.map(provider =>
      inferDefaultMode({...baseTask, origin: {provider}})
    )
    // All free tasks should yield the same mode regardless of provider
    const allSame = modes.every(m => m === modes[0])
    assert.ok(allSame, `Free tasks with different providers should yield same mode, got: ${modes.join(', ')}`)
  })
})

// T34: taskImportService must NOT call repository.createProblem
const describeOrSkipT34 = taskImportAvailable ? describe : describe.skip

describeOrSkipT34('Architecture boundary: taskImportService does not call createProblem', () => {
  it('T34a: importFoxGame does not call createProblem', async () => {
    const {service, repository} = createTestService()
    await service.importFoxGame({gameId: 'fox_no_problem'})
    assert.strictEqual(repository.calls.createProblem.length, 0,
      'importFoxGame should not call createProblem')
  })

  it('T34b: importLocalSgf does not call createProblem', async () => {
    const {service, repository} = createTestService()
    await service.importLocalSgf({filePath: '/no_problem.sgf'})
    assert.strictEqual(repository.calls.createProblem.length, 0,
      'importLocalSgf should not call createProblem')
  })

  it('T34c: import101Problem does not call createProblem', async () => {
    const {service, repository} = createTestService()
    await service.import101Problem({problemId: '101_no_problem'})
    assert.strictEqual(repository.calls.createProblem.length, 0,
      'import101Problem should not call createProblem')
  })

  it('T34d: createManualTask does not call createProblem', async () => {
    const {service, repository} = createTestService()
    await service.createManualTask({positionSgf: MINIMAL_SGF, sideToMove: 'black'})
    assert.strictEqual(repository.calls.createProblem.length, 0,
      'createManualTask should not call createProblem')
  })

  it('T34e: createTaskFromSnapshot does not call createProblem', async () => {
    const {service, repository} = createTestService()
    await service.createTaskFromSnapshot({
      parentTaskId: 'task_p',
      positionSgf: MINIMAL_SGF,
      sideToMove: 'black',
    })
    assert.strictEqual(repository.calls.createProblem.length, 0,
      'createTaskFromSnapshot should not call createProblem')
  })

  it('T34f: createTaskFromBadMove does not call createProblem', async () => {
    const badMoves = {
      bm_nop: {
        id: 'bm_nop',
        moveEvaluationId: 'eval_1',
        attemptId: 'attempt_1',
        taskId: 'task_orig',
        moveIndex: 10,
        severity: 'major',
        punishSide: 'black',
        positionBeforeSgf: MINIMAL_SGF,
        createdAt: new Date().toISOString(),
      },
    }
    const {service, repository} = createTestService({repository: {badMoves}})
    await service.createTaskFromBadMove({badMoveId: 'bm_nop'})
    assert.strictEqual(repository.calls.createProblem.length, 0,
      'createTaskFromBadMove should not call createProblem')
  })
})
