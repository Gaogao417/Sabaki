import assert from 'assert'

import { createReviewService, calculateNextDue } from '../../src/modules/training/review/reviewService.ts'

// --- Fake dependencies ---

function createFakeRepo(overrides = {}) {
  const schedules = {}

  return {
    schedules,

    async listDueReviewItems() {
      return Object.values(schedules).filter(s => new Date(s.dueAt) <= new Date())
    },
    async findReviewScheduleByItem(itemId, itemType) {
      return Object.values(schedules).find(
        s => s.itemId === itemId && s.itemType === itemType,
      ) ?? null
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

let tabSeq = 0
function createFakeTabService() {
  const openedTabs = []
  return {
    openedTabs,
    async openProblemTab(problemId) {
      const tab = {
        id: `tab_${++tabSeq}`,
        taskId: `task_${problemId}`,
        phase: 'play',
        childTabIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      openedTabs.push({ problemId, tab })
      return tab
    },
  }
}

function seedSchedule(repo, overrides = {}) {
  const schedule = {
    id: 'rev_1',
    itemId: 'prob_1',
    itemType: 'problem',
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
  describe('calculateNextDue (pure function)', () => {
    it('fail → 1 day interval, reset consecutive', () => {
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

    it('abandoned → same as fail', () => {
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

    it('soft_pass → 3 days, reset consecutive', () => {
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

    it('pass (1st consecutive) → 7 days', () => {
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

    it('pass (2nd consecutive) → 14 days', () => {
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

    it('pass (3rd+ consecutive) → 30 days', () => {
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

  describe('getDueItems', () => {
    it('returns due items from repository', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, { id: 'rev_1', itemId: 'prob_1' })
      seedSchedule(repo, { id: 'rev_2', itemId: 'prob_2' })

      const tabService = createFakeTabService()
      const service = createReviewService({ repository: repo, workbenchTabService: tabService })

      const items = await service.getDueItems()
      assert.strictEqual(items.length, 2)
    })

    it('returns empty array when no due items', async () => {
      const repo = createFakeRepo()
      const tabService = createFakeTabService()
      const service = createReviewService({ repository: repo, workbenchTabService: tabService })

      const items = await service.getDueItems()
      assert.strictEqual(items.length, 0)
    })
  })

  describe('openDueItem', () => {
    it('opens a problem review item as a new tab with phase=play', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, { id: 'rev_1', itemId: 'prob_1', itemType: 'problem' })

      const tabService = createFakeTabService()
      const service = createReviewService({ repository: repo, workbenchTabService: tabService })

      const tab = await service.openDueItem('rev_1')

      assert.strictEqual(tab.phase, 'play')
      assert.strictEqual(tabService.openedTabs.length, 1)
      assert.strictEqual(tabService.openedTabs[0].problemId, 'prob_1')
    })

    it('throws if schedule item not found', async () => {
      const repo = createFakeRepo()
      const tabService = createFakeTabService()
      const service = createReviewService({ repository: repo, workbenchTabService: tabService })

      await assert.rejects(
        () => service.openDueItem('missing'),
        /schedule item not found/,
      )
    })

    it('throws for unsupported recall_segment itemType', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, {
        id: 'rev_rs',
        itemId: 'seg_1',
        itemType: 'recall_segment',
        dueAt: new Date().toISOString(),
      })

      const tabService = createFakeTabService()
      const service = createReviewService({ repository: repo, workbenchTabService: tabService })

      await assert.rejects(
        () => service.openDueItem('rev_rs'),
        /unsupported itemType=recall_segment/,
      )
    })
  })

  describe('updateScheduleAfterResult', () => {
    it('updates existing schedule on fail', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, {
        id: 'rev_1',
        itemId: 'prob_1',
        intervalDays: 7,
        consecutivePassCount: 2,
        totalFailCount: 0,
      })

      const tabService = createFakeTabService()
      const service = createReviewService({ repository: repo, workbenchTabService: tabService })

      await service.updateScheduleAfterResult({
        itemId: 'prob_1',
        itemType: 'problem',
        result: 'fail',
      })

      const updated = repo.schedules['rev_1']
      assert.strictEqual(updated.intervalDays, 1)
      assert.strictEqual(updated.consecutivePassCount, 0)
      assert.strictEqual(updated.totalFailCount, 1)
      assert.strictEqual(updated.lastResult, 'fail')
    })

    it('updates existing schedule on pass', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, {
        id: 'rev_1',
        itemId: 'prob_1',
        intervalDays: 1,
        consecutivePassCount: 0,
        totalFailCount: 0,
      })

      const tabService = createFakeTabService()
      const service = createReviewService({ repository: repo, workbenchTabService: tabService })

      await service.updateScheduleAfterResult({
        itemId: 'prob_1',
        itemType: 'problem',
        result: 'pass',
      })

      const updated = repo.schedules['rev_1']
      assert.strictEqual(updated.intervalDays, 7)
      assert.strictEqual(updated.consecutivePassCount, 1)
      assert.strictEqual(updated.lastResult, 'pass')
    })

    it('updates existing non-due schedule instead of creating duplicate', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, {
        id: 'rev_1',
        itemId: 'prob_1',
        itemType: 'problem',
        dueAt: '2099-01-01T00:00:00.000Z',
        intervalDays: 14,
        consecutivePassCount: 1,
        totalFailCount: 0,
      })

      const tabService = createFakeTabService()
      const service = createReviewService({ repository: repo, workbenchTabService: tabService })

      await service.updateScheduleAfterResult({
        itemId: 'prob_1',
        itemType: 'problem',
        result: 'fail',
      })

      assert.strictEqual(Object.keys(repo.schedules).length, 1, 'should not create duplicate schedule')
      assert.strictEqual(repo.schedules['rev_1'].intervalDays, 1)
      assert.strictEqual(repo.schedules['rev_1'].lastResult, 'fail')
    })

    it('creates new schedule if item not found at all', async () => {
      const repo = createFakeRepo()
      const tabService = createFakeTabService()
      const service = createReviewService({ repository: repo, workbenchTabService: tabService })

      await service.updateScheduleAfterResult({
        itemId: 'prob_new',
        itemType: 'problem',
        result: 'pass',
      })

      const created = Object.values(repo.schedules)[0]
      assert.ok(created)
      assert.strictEqual(created.itemId, 'prob_new')
      assert.strictEqual(created.lastResult, 'pass')
      assert.strictEqual(created.intervalDays, 7)
    })

    it('accumulates fail count correctly', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, {
        id: 'rev_1',
        itemId: 'prob_1',
        intervalDays: 7,
        consecutivePassCount: 0,
        totalFailCount: 2,
      })

      const tabService = createFakeTabService()
      const service = createReviewService({ repository: repo, workbenchTabService: tabService })

      await service.updateScheduleAfterResult({
        itemId: 'prob_1',
        itemType: 'problem',
        result: 'fail',
      })

      assert.strictEqual(repo.schedules['rev_1'].totalFailCount, 3)
    })
  })

  describe('addToReviewQueue', () => {
    it('creates a new review schedule for an item', async () => {
      const repo = createFakeRepo()
      const tabService = createFakeTabService()
      const service = createReviewService({ repository: repo, workbenchTabService: tabService })

      const schedule = await service.addToReviewQueue({
        itemId: 'prob_new',
        itemType: 'problem',
      })

      assert.strictEqual(schedule.itemId, 'prob_new')
      assert.strictEqual(schedule.itemType, 'problem')
      assert.strictEqual(schedule.intervalDays, 1)
      assert.strictEqual(schedule.consecutivePassCount, 0)
      assert.strictEqual(schedule.totalFailCount, 0)
      assert.ok(schedule.id)
    })

    it('returns existing schedule if item already in queue', async () => {
      const repo = createFakeRepo()
      seedSchedule(repo, {
        id: 'rev_1',
        itemId: 'prob_1',
        itemType: 'problem',
        dueAt: new Date().toISOString(),
      })

      const tabService = createFakeTabService()
      const service = createReviewService({ repository: repo, workbenchTabService: tabService })

      const schedule = await service.addToReviewQueue({
        itemId: 'prob_1',
        itemType: 'problem',
      })

      assert.strictEqual(schedule.id, 'rev_1')
      assert.strictEqual(Object.keys(repo.schedules).length, 1, 'should not create duplicate')
    })
  })

  describe('logging', () => {
    it('logs review open and update events', async () => {
      const logs = []
      const repo = createFakeRepo()
      seedSchedule(repo, { id: 'rev_1', itemId: 'prob_1', itemType: 'problem' })

      const tabService = createFakeTabService()
      const service = createReviewService({
        repository: repo,
        workbenchTabService: tabService,
        logger: {
          info(channel, message, data) {
            logs.push({ channel, message, data })
          },
        },
      })

      await service.openDueItem('rev_1')
      await service.updateScheduleAfterResult({
        itemId: 'prob_1',
        itemType: 'problem',
        result: 'pass',
      })

      assert.ok(logs.some(l => l.channel === 'review.open'))
      assert.ok(logs.some(l => l.channel === 'review.update'))
    })

    it('logs add to queue event', async () => {
      const logs = []
      const repo = createFakeRepo()
      const tabService = createFakeTabService()
      const service = createReviewService({
        repository: repo,
        workbenchTabService: tabService,
        logger: {
          info(channel, message, data) {
            logs.push({ channel, message, data })
          },
        },
      })

      await service.addToReviewQueue({ itemId: 'prob_x', itemType: 'problem' })

      assert.ok(logs.some(l => l.channel === 'review.add'))
    })
  })
})
