import type { TrainingAttemptResult } from '../types/attempt'
import type { ReviewSchedule } from '../types/review'
import type { TrainingRepository } from '../repository/trainingRepository'
import type { WorkbenchTabService } from '../workbench/workbenchTabService'
import { inferDefaultMode } from '../workbench/workbenchTabService'

export type ReviewService = {
  getDueItems(now?: string): Promise<ReviewSchedule[]>
  openDueItem(scheduleId: string): Promise<ReturnType<WorkbenchTabService['openTask']>>
  updateScheduleAfterResult(input: {
    taskId: string
    result: TrainingAttemptResult
  }): Promise<void>
  addToReviewQueue(input: {
    taskId: string
  }): Promise<ReviewSchedule>
  startSession(): Promise<void>
  advanceReview(): Promise<void>
}

export type ReviewServiceDeps = {
  repository: TrainingRepository
  workbenchTabService: WorkbenchTabService
  runtimeStore?: {
    getState(): { reviewQueueView: { queue: string[]; currentIndex: number; totalDue: number } | null }
    setReviewQueueView(view: { queue: string[]; currentIndex: number; totalDue: number } | null): void
  }
  logger?: { info(channel: string, message: string, data?: Record<string, unknown>): void }
}

// --- Inline pure function for MVP review scheduling ---

export type CalculateNextDueInput = {
  lastResult: TrainingAttemptResult
  intervalDays: number
  consecutivePassCount: number
}

export type CalculateNextDueResult = {
  dueAt: string
  intervalDays: number
  consecutivePassCount: number
  totalFailDelta: number
}

export function calculateNextDue(input: CalculateNextDueInput, now: Date = new Date()): CalculateNextDueResult {
  const { lastResult, intervalDays, consecutivePassCount } = input
  let nextInterval: number
  let nextConsecutive: number
  let failDelta = 0

  if (lastResult === 'fail' || lastResult === 'abandoned') {
    nextInterval = 1
    nextConsecutive = 0
    failDelta = 1
  } else if (lastResult === 'soft_pass') {
    nextInterval = 3
    nextConsecutive = 0
  } else if (lastResult === 'pass') {
    nextConsecutive = consecutivePassCount + 1
    if (nextConsecutive >= 3) {
      nextInterval = 30
    } else if (nextConsecutive >= 2) {
      nextInterval = 14
    } else {
      nextInterval = 7
    }
  } else {
    nextInterval = intervalDays
    nextConsecutive = 0
  }

  const dueAt = new Date(now)
  dueAt.setDate(dueAt.getDate() + nextInterval)

  return {
    dueAt: dueAt.toISOString(),
    intervalDays: nextInterval,
    consecutivePassCount: nextConsecutive,
    totalFailDelta: failDelta,
  }
}

// --- Service ---

export function createReviewService(deps: ReviewServiceDeps): ReviewService {
  const { repository, workbenchTabService, logger } = deps

  async function getDueItems(now?: string): Promise<ReviewSchedule[]> {
    const isoNow = now ?? new Date().toISOString()
    return repository.listDueReviewItems(isoNow)
  }

  async function openDueItem(scheduleId: string): Promise<ReturnType<WorkbenchTabService['openTask']>> {
    const schedule = (await repository.listDueReviewItems(new Date().toISOString()))
      .find(s => s.id === scheduleId)

    if (!schedule) {
      throw new Error(`reviewService.openDueItem: schedule not found (id=${scheduleId})`)
    }

    const task = await repository.loadTask(schedule.taskId)
    if (!task) {
      throw new Error(`reviewService.openDueItem: task not found (taskId=${schedule.taskId})`)
    }

    logger?.info('review.open', 'Opening review task', {
      scheduleId,
      taskId: schedule.taskId,
    })

    return workbenchTabService.openTask({ taskId: schedule.taskId, mode: inferDefaultMode(task) })
  }

  async function updateScheduleAfterResult(input: {
    taskId: string
    result: TrainingAttemptResult
  }): Promise<void> {
    const schedule = await repository.findReviewScheduleByTask(input.taskId)

    if (!schedule) {
      logger?.info('review.update', 'Creating new review schedule', {
        taskId: input.taskId,
        result: input.result,
      })

      const next = calculateNextDue({
        lastResult: input.result,
        intervalDays: 1,
        consecutivePassCount: 0,
      })

      await repository.createReviewSchedule({
        id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        taskId: input.taskId,
        dueAt: next.dueAt,
        intervalDays: next.intervalDays,
        consecutivePassCount: next.consecutivePassCount,
        totalFailCount: next.totalFailDelta,
        lastResult: input.result,
        lastReviewedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      return
    }

    const next = calculateNextDue({
      lastResult: input.result,
      intervalDays: schedule.intervalDays,
      consecutivePassCount: schedule.consecutivePassCount,
    })

    await repository.updateReviewSchedule(schedule.id, {
      dueAt: next.dueAt,
      intervalDays: next.intervalDays,
      consecutivePassCount: next.consecutivePassCount,
      totalFailCount: schedule.totalFailCount + next.totalFailDelta,
      lastResult: input.result,
      lastReviewedAt: new Date().toISOString(),
    })

    logger?.info('review.update', 'Review schedule updated', {
      scheduleId: schedule.id,
      taskId: input.taskId,
      result: input.result,
      nextIntervalDays: next.intervalDays,
    })
  }

  async function addToReviewQueue(input: {
    taskId: string
  }): Promise<ReviewSchedule> {
    const existing = await repository.findReviewScheduleByTask(input.taskId)
    if (existing) {
      logger?.info('review.add', 'Task already in review queue', {
        taskId: input.taskId,
        scheduleId: existing.id,
      })
      return existing
    }

    const now = new Date()
    const schedule: ReviewSchedule = {
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      taskId: input.taskId,
      dueAt: now.toISOString(),
      intervalDays: 1,
      easeFactor: undefined,
      lastResult: undefined,
      consecutivePassCount: 0,
      totalFailCount: 0,
      lastReviewedAt: undefined,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    const saved = await repository.createReviewSchedule(schedule)

    logger?.info('review.add', 'Added task to review queue', {
      scheduleId: saved.id,
      taskId: input.taskId,
    })

    return saved
  }

  async function startSession(runtimeStoreOverride?: ReviewServiceDeps['runtimeStore']): Promise<void> {
    const store = runtimeStoreOverride ?? deps.runtimeStore
    if (!store) return
    const items = await getDueItems()
    if (items.length === 0) {
      logger?.info('review.session', 'No due items, session skipped', {})
      return
    }
    const queue = items.map(s => s.id)
    logger?.info('review.session', 'Starting review session', { totalDue: queue.length })
    store.setReviewQueueView({
      queue,
      currentIndex: 0,
      totalDue: queue.length,
    })
    await openDueItem(queue[0])
  }

  async function advanceReview(runtimeStoreOverride?: ReviewServiceDeps['runtimeStore']): Promise<void> {
    const store = runtimeStoreOverride ?? deps.runtimeStore
    if (!store) return
    const rv = store.getState().reviewQueueView
    if (!rv) return
    const nextIndex = rv.currentIndex + 1
    if (nextIndex >= rv.queue.length) {
      logger?.info('review.advance', 'Review queue completed', { totalItems: rv.queue.length })
      store.setReviewQueueView(null)
      return
    }
    logger?.info('review.advance', 'Advancing to next item', { index: nextIndex, total: rv.queue.length })
    store.setReviewQueueView({...rv, currentIndex: nextIndex})
    await openDueItem(rv.queue[nextIndex])
  }

  return {
    getDueItems,
    openDueItem,
    updateScheduleAfterResult,
    addToReviewQueue,
    startSession,
    advanceReview,
  }
}
