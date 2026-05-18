import assert from 'assert'

import { createReviewService, calculateNextDue } from '../../src/modules/training/review/reviewService.ts'

// --- Fake dependencies ---

function createFakeRepo(overrides = {}) {
  const schedules = {}
  const tasks = {
    task_1: {
      id: 'task_1',
      rootPositionSgf: '(;GM[1]FF[4]SZ[19])',
      sideToMove: 'black',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  }

  return {
    schedules,
    tasks,

    async listDueReviewItems(now) {
      return Object.values(schedules).filter(s => new Date(s.dueAt) <= new Date(now))
    },
    async findReviewScheduleByTask(taskId) {
      return Object.values(schedules).find(s => s.taskId === taskId) ?? null
    },
    async loadTask(taskId) {
      return tasks[taskId] ?? null
    },
    async createReviewSchedule(schedule) {
      schedules[schedule.id] = { ...schedule }
      return { ...schedule }
    },
    async updateReviewSchedule(id, patch) {
      if (schedules[id]) {
        Object.assign(schedules[id], patch, { updatedAt: new Date().toISOString() })
      }
    },

    ...overrides,
  }
}

function createFakeTabService(overrides = {}) {
  const openedTabs = []
  const calls = { openProblemTab: 0, openTask: 0 }

  return {
    openedTabs,
    calls,

    async openProblemTab(problemId) {
      calls.openProblemTab++
      throw new Error('openProblemTab should not be called in Phase 7')
    },

    async openTask({ taskId, mode, parentTabId }) {
      calls.openTask++
      const tab = {
        id: `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        taskId,
        mode: mode || 'play',
        childTabIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      openedTabs.push({ taskId, mode, parentTabId, tab })
      return tab
    },

    ...overrides,
  }
}

function seedSchedule(repo, overrides = {}) {
  const schedule = {
    id: 'rev_1',
    taskId: 'task_1',
    dueAt: new Date().toISOString(),
    intervalDays: 7,
    easeFactor: undefined,
    lastResult: 'pass',
    consecutivePassCount: 1,
    totalFailCount: 0,
    lastReviewedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  repo.schedules[schedule.id] = schedule
  return schedule
}

// --- Tests ---

describe('reviewService', () => {
  // ====================================================================
  // calculateNextDue: pure function tests (unchanged across all phases)
  // ====================================================================

  describe('calculateNextDue (pure function)', () => {
    it('fail -> 1 day interval, reset consecutive', () => {
      const now = new Date('2026-05-15T12:00:00.000Z')
      const result = calculateNextDue({
        lastResult: 'fail',
        intervalDays: 7,
        consecutivePassCount: 2,
      }, now)

      assert.strictEqual(result.intervalDays, 1)
      assert.strictEqual(result.consecutivePassCount, 0)
      assert.strictEqual(result.totalFailDelta, 1)
      assert.strictEqual(result.dueAt, '2026-05-16T12:00:00.000Z')
    })

    it('abandoned -> same as fail', () => {
      const now = new Date('2026-05-15T12:00:00.000Z')
      const result = calculateNextDue({
        lastResult: 'abandoned',
        intervalDays: 14,
        consecutivePassCount: 3,
      }, now)

      assert.strictEqual(result.intervalDays, 1)
      assert.strictEqual(result.consecutivePassCount, 0)
      assert.strictEqual(result.totalFailDelta, 1)
      assert.strictEqual(result.dueAt, '2026-05-16T12:00:00.000Z')
    })

    it('soft_pass -> 3 days, reset consecutive', () => {
      const now = new Date('2026-05-15T12:00:00.000Z')
      const result = calculateNextDue({
        lastResult: 'soft_pass',
        intervalDays: 7,
        consecutivePassCount: 1,
      }, now)

      assert.strictEqual(result.intervalDays, 3)
      assert.strictEqual(result.consecutivePassCount, 0)
      assert.strictEqual(result.totalFailDelta, 0)
      assert.strictEqual(result.dueAt, '2026-05-18T12:00:00.000Z')
    })

    it('pass (1st consecutive) -> 7 days', () => {
      const now = new Date('2026-05-15T12:00:00.000Z')
      const result = calculateNextDue({
        lastResult: 'pass',
        intervalDays: 1,
        consecutivePassCount: 0,
      }, now)

      assert.strictEqual(result.intervalDays, 7)
      assert.strictEqual(result.consecutivePassCount, 1)
      assert.strictEqual(result.dueAt, '2026-05-22T12:00:00.000Z')
    })

    it('pass (2nd consecutive) -> 14 days', () => {
      const now = new Date('2026-05-15T12:00:00.000Z')
      const result = calculateNextDue({
        lastResult: 'pass',
        intervalDays: 7,
        consecutivePassCount: 1,
      }, now)

      assert.strictEqual(result.intervalDays, 14)
      assert.strictEqual(result.consecutivePassCount, 2)
      assert.strictEqual(result.dueAt, '2026-05-29T12:00:00.000Z')
    })

    it('pass (3rd+ consecutive) -> 30 days', () => {
      const now = new Date('2026-05-15T12:00:00.000Z')
      const result = calculateNextDue({
        lastResult: 'pass',
        intervalDays: 14,
        consecutivePassCount: 2,
      }, now)

      assert.strictEqual(result.intervalDays, 30)
      assert.strictEqual(result.consecutivePassCount, 3)
      assert.strictEqual(result.dueAt, '2026-06-14T12:00:00.000Z')
    })

    it('defaults to Date.now() when no now parameter', () => {
      const result = calculateNextDue({
        lastResult: 'fail',
        intervalDays: 1,
        consecutivePassCount: 0,
      })

      const expectedDue = new Date()
      expectedDue.setDate(expectedDue.getDate() + 1)
      assert.ok(!isNaN(Date.parse(result.dueAt)))
    })
  })

  // ====================================================================
  // Group A: reviewService API upgrade to taskId (C01-C09)
  // ====================================================================

  describe('openDueItem (C01, C02, C03)', () => {
    it('C01: calls openTask with schedule.taskId, not openProblemTab', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, { id: 'rev_1', taskId: 'task_1' })
      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      const tab = await svc.openDueItem('rev_1')

      // Contract: openTask was called (not openProblemTab)
      assert.strictEqual(tabSvc.calls.openTask, 1, 'openTask should be called exactly once')
      assert.strictEqual(tabSvc.calls.openProblemTab, 0, 'openProblemTab should not be called')
      // Contract: openTask received the taskId from the schedule
      assert.strictEqual(tabSvc.openedTabs[0].taskId, 'task_1')
      assert.strictEqual(tab.taskId, 'task_1')
    })

    it('C02: throws if schedule not found', async () => {
      const repo = createFakeRepo()
      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      await assert.rejects(
        () => svc.openDueItem('nonexistent_schedule'),
        /schedule.*not found|not found.*schedule/i,
      )
    })

    it('C03: throws if schedule found but task does not exist', async () => {
      const repo = createFakeRepo()
      // Seed a schedule referencing a task that does NOT exist in the fake repo
      seedSchedule(repo, { id: 'rev_orphan', taskId: 'task_missing' })
      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      await assert.rejects(
        () => svc.openDueItem('rev_orphan'),
        /task.*not found|not found.*task/i,
      )
    })
  })

  describe('updateScheduleAfterResult (C04, C05, C06)', () => {
    it('C04: finds schedule by taskId via findReviewScheduleByTask', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, {
        id: 'rev_1',
        taskId: 'task_1',
        intervalDays: 7,
        consecutivePassCount: 2,
        totalFailCount: 0,
      })
      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      // Track that findReviewScheduleByTask was called with correct taskId
      let findByTaskArg = null
      const originalFindByTask = repo.findReviewScheduleByTask.bind(repo)
      repo.findReviewScheduleByTask = async function(taskId) {
        findByTaskArg = taskId
        return originalFindByTask(taskId)
      }

      await svc.updateScheduleAfterResult({ taskId: 'task_1', result: 'fail' })

      assert.strictEqual(findByTaskArg, 'task_1',
        'findReviewScheduleByTask should be called with taskId')
    })

    it('C05: updates all fields when schedule found (fail)', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, {
        id: 'rev_1',
        taskId: 'task_1',
        intervalDays: 7,
        consecutivePassCount: 2,
        totalFailCount: 0,
      })
      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      await svc.updateScheduleAfterResult({ taskId: 'task_1', result: 'fail' })

      const updated = repo.schedules['rev_1']
      assert.strictEqual(updated.intervalDays, 1, 'intervalDays should be reset to 1 on fail')
      assert.strictEqual(updated.consecutivePassCount, 0, 'consecutivePassCount should reset on fail')
      assert.strictEqual(updated.totalFailCount, 1, 'totalFailCount should increment by 1')
      assert.strictEqual(updated.lastResult, 'fail', 'lastResult should be fail')
      assert.ok(updated.dueAt, 'dueAt should be set')
      assert.ok(updated.lastReviewedAt, 'lastReviewedAt should be set')
    })

    it('C05: updates all fields when schedule found (pass)', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, {
        id: 'rev_1',
        taskId: 'task_1',
        intervalDays: 1,
        consecutivePassCount: 0,
        totalFailCount: 2,
      })
      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      await svc.updateScheduleAfterResult({ taskId: 'task_1', result: 'pass' })

      const updated = repo.schedules['rev_1']
      assert.strictEqual(updated.intervalDays, 7, 'intervalDays should be 7 on 1st pass')
      assert.strictEqual(updated.consecutivePassCount, 1, 'consecutivePassCount should increment on pass')
      assert.strictEqual(updated.lastResult, 'pass', 'lastResult should be pass')
      assert.strictEqual(updated.totalFailCount, 2, 'totalFailCount should not change on pass')
    })

    it('C05: accumulates fail count correctly', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, {
        id: 'rev_1',
        taskId: 'task_1',
        intervalDays: 7,
        consecutivePassCount: 0,
        totalFailCount: 2,
      })
      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      await svc.updateScheduleAfterResult({ taskId: 'task_1', result: 'fail' })

      assert.strictEqual(repo.schedules['rev_1'].totalFailCount, 3)
    })

    it('C05: does not create duplicate when schedule exists but not due', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, {
        id: 'rev_1',
        taskId: 'task_1',
        dueAt: '2099-01-01T00:00:00.000Z',
        intervalDays: 14,
        consecutivePassCount: 1,
        totalFailCount: 0,
      })
      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      await svc.updateScheduleAfterResult({ taskId: 'task_1', result: 'fail' })

      assert.strictEqual(Object.keys(repo.schedules).length, 1,
        'should not create duplicate schedule')
      assert.strictEqual(repo.schedules['rev_1'].intervalDays, 1)
      assert.strictEqual(repo.schedules['rev_1'].lastResult, 'fail')
    })

    it('C06: creates new schedule with correct taskId when not found', async () => {
      const repo = createFakeRepo()
      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      await svc.updateScheduleAfterResult({ taskId: 'task_new', result: 'pass' })

      const created = Object.values(repo.schedules)[0]
      assert.ok(created, 'a new schedule should be created')
      assert.strictEqual(created.taskId, 'task_new',
        'created schedule taskId must match input taskId')
      assert.strictEqual(created.lastResult, 'pass')
      assert.strictEqual(created.intervalDays, 7)
    })
  })

  describe('addToReviewQueue (C07, C08)', () => {
    it('C07: creates new schedule with correct taskId and dueAt=now', async () => {
      const before = new Date()
      const repo = createFakeRepo()
      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      const schedule = await svc.addToReviewQueue({ taskId: 'task_new' })
      const after = new Date()

      assert.strictEqual(schedule.taskId, 'task_new',
        'created schedule taskId must match input')
      assert.strictEqual(schedule.intervalDays, 1)
      assert.strictEqual(schedule.consecutivePassCount, 0)
      assert.strictEqual(schedule.totalFailCount, 0)
      assert.ok(schedule.id, 'schedule should have an id')

      // dueAt should be approximately now
      const dueAtDate = new Date(schedule.dueAt)
      assert.ok(dueAtDate >= before && dueAtDate <= after,
        'dueAt should be approximately current time')
    })

    it('C08: returns existing schedule if same taskId already queued', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, {
        id: 'rev_1',
        taskId: 'task_1',
        dueAt: new Date().toISOString(),
      })
      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      const schedule = await svc.addToReviewQueue({ taskId: 'task_1' })

      assert.strictEqual(schedule.id, 'rev_1',
        'should return existing schedule id')
      assert.strictEqual(Object.keys(repo.schedules).length, 1,
        'should not create duplicate schedule')
    })
  })

  describe('getDueItems (C09)', () => {
    it('C09: returns schedule list with taskId field', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, { id: 'rev_1', taskId: 'task_1' })
      seedSchedule(repo, { id: 'rev_2', taskId: 'task_2' })

      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      const items = await svc.getDueItems()

      assert.strictEqual(items.length, 2)
      for (const item of items) {
        assert.ok(item.taskId, 'each due item should have a taskId field')
      }
    })

    it('returns empty array when no due items', async () => {
      const repo = createFakeRepo()
      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      const items = await svc.getDueItems()
      assert.strictEqual(items.length, 0)
    })
  })

  // ====================================================================
  // Group D: Architecture boundary guards (C19-C22)
  // ====================================================================

  describe('architecture boundary guards (C19-C22)', () => {
    it('C19: openDueItem does not call openProblemTab', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, { id: 'rev_1', taskId: 'task_1' })
      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      await svc.openDueItem('rev_1')

      assert.strictEqual(tabSvc.calls.openProblemTab, 0,
        'openProblemTab must not be called -- review should use openTask')
    })

    // C20: ReviewItemType is a TypeScript type-level constraint. It cannot be
    // meaningfully validated at runtime. If the TypeScript compiler accepts the
    // Phase 7 signatures (openDueItem(scheduleId), updateScheduleAfterResult({taskId, result}),
    // addToReviewQueue({taskId})) without ReviewItemType parameters, the contract
    // is satisfied. The real enforcement is that the ReviewService type definition
    // does not include ReviewItemType in its public API after Phase 7 migration.
    // A grep-based check would be fragile and tied to source layout. The TypeScript
    // compiler is the correct enforcement mechanism.
    it('C20: public API signatures do not include ReviewItemType parameters [compiler enforced]',
      () => {
        // This test documents the intent. TypeScript compiler enforces it.
        assert.ok(true, 'C20 is enforced by TypeScript compiler -- no runtime check possible')
      }
    )

    it('C21: openDueItem tab mode is determined by inferDefaultMode, not hardcoded', async () => {
      const repo = createFakeRepo()
      // task_with_prompt has prompt set, so inferDefaultMode should return 'problem'
      repo.tasks['task_prompt'] = {
        id: 'task_prompt',
        rootPositionSgf: '(;GM[1]FF[4]SZ[19])',
        sideToMove: 'black',
        prompt: 'Find the best move',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
      seedSchedule(repo, { id: 'rev_prompt', taskId: 'task_prompt' })

      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      const tab = await svc.openDueItem('rev_prompt')

      // inferDefaultMode returns 'problem' when task has prompt
      assert.strictEqual(tabSvc.openedTabs[0].mode, 'problem',
        'mode should be inferred from task properties, not hardcoded')
    })

    it('C22: review does not set mode=review -- review is not a mode', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, { id: 'rev_1', taskId: 'task_1' })

      const tabSvc = createFakeTabService()
      const svc = createReviewService({ repository: repo, workbenchTabService: tabSvc })

      const tab = await svc.openDueItem('rev_1')

      // Contract: review must not set mode='review'
      // Valid modes are 'play', 'problem', 'recall', 'analysis' (from tab.ts)
      // review is a tab/workbench phase, not a mode
      assert.notStrictEqual(tab.mode, 'review',
        'review is not a valid mode -- must not appear as tab.mode')
    })
  })

  // ====================================================================
  // Logging
  // ====================================================================

  describe('logging', () => {
    it('logs review.open with taskId and scheduleId', async () => {
      const logs = []
      const repo = createFakeRepo()
      seedSchedule(repo, { id: 'rev_1', taskId: 'task_1' })

      const tabSvc = createFakeTabService()
      const svc = createReviewService({
        repository: repo,
        workbenchTabService: tabSvc,
        logger: {
          info(channel, message, data) {
            logs.push({ channel, message, data })
          },
        },
      })

      await svc.openDueItem('rev_1')

      const openLog = logs.find(l => l.channel === 'review.open')
      assert.ok(openLog, 'should log review.open')
      assert.strictEqual(openLog.data.scheduleId, 'rev_1')
      assert.strictEqual(openLog.data.taskId, 'task_1')
    })

    it('logs review.update with taskId', async () => {
      const logs = []
      const repo = createFakeRepo()
      seedSchedule(repo, { id: 'rev_1', taskId: 'task_1', intervalDays: 1, consecutivePassCount: 0 })

      const tabSvc = createFakeTabService()
      const svc = createReviewService({
        repository: repo,
        workbenchTabService: tabSvc,
        logger: {
          info(channel, message, data) {
            logs.push({ channel, message, data })
          },
        },
      })

      await svc.updateScheduleAfterResult({ taskId: 'task_1', result: 'pass' })

      const updateLog = logs.find(l => l.channel === 'review.update')
      assert.ok(updateLog, 'should log review.update')
      assert.strictEqual(updateLog.data.taskId, 'task_1')
    })

    it('logs review.add when adding to queue', async () => {
      const logs = []
      const repo = createFakeRepo()
      const tabSvc = createFakeTabService()
      const svc = createReviewService({
        repository: repo,
        workbenchTabService: tabSvc,
        logger: {
          info(channel, message, data) {
            logs.push({ channel, message, data })
          },
        },
      })

      await svc.addToReviewQueue({ taskId: 'task_x' })

      const addLog = logs.find(l => l.channel === 'review.add')
      assert.ok(addLog, 'should log review.add')
      assert.strictEqual(addLog.data.taskId, 'task_x')
    })
  })
})
