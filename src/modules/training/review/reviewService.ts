import type { TrainingAttemptResult } from '../types/attempt'
import type { ReviewSchedule, ReviewItemType } from '../types/review'
import type { TrainingRepository } from '../repository/trainingRepository'
import type { WorkbenchTabService } from '../workbench/workbenchTabService'

export type ReviewService = {
  getDueItems(now?: string): Promise<ReviewSchedule[]>
  openDueItem(itemId: string): Promise<ReturnType<WorkbenchTabService['openProblemTab']>>
  updateScheduleAfterResult(input: {
    itemId: string
    itemType: ReviewItemType
    result: TrainingAttemptResult
  }): Promise<void>
  addToReviewQueue(input: {
    itemId: string
    itemType: ReviewItemType
  }): Promise<ReviewSchedule>
}

export type ReviewServiceDeps = {
  repository: TrainingRepository
  workbenchTabService: WorkbenchTabService
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

  async function openDueItem(itemId: string): Promise<ReturnType<WorkbenchTabService['openProblemTab']>> {
    const schedule = (await repository.listDueReviewItems(new Date().toISOString()))
      .find(s => s.id === itemId)

    if (!schedule) {
      throw new Error(`reviewService.openDueItem: schedule item not found (id=${itemId})`)
    }

    if (schedule.itemType === 'problem') {
      logger?.info('review.open', 'Opening review problem', {
        scheduleId: itemId,
        problemId: schedule.itemId,
      })

      return workbenchTabService.openProblemTab(schedule.itemId)
    }

    throw new Error(`reviewService.openDueItem: unsupported itemType=${schedule.itemType}`)
  }

  async function updateScheduleAfterResult(input: {
    itemId: string
    itemType: ReviewItemType
    result: TrainingAttemptResult
  }): Promise<void> {
    const schedule = await repository.findReviewScheduleByItem(input.itemId, input.itemType)

    if (!schedule) {
      logger?.info('review.update', 'Creating new review schedule', {
        itemId: input.itemId,
        itemType: input.itemType,
        result: input.result,
      })

      const next = calculateNextDue({
        lastResult: input.result,
        intervalDays: 1,
        consecutivePassCount: 0,
      })

      await repository.createReviewSchedule({
        id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        taskId: input.itemId,
        itemId: input.itemId,
        itemType: input.itemType,
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
      itemId: input.itemId,
      result: input.result,
      nextIntervalDays: next.intervalDays,
    })
  }

  async function addToReviewQueue(input: {
    itemId: string
    itemType: ReviewItemType
  }): Promise<ReviewSchedule> {
    const existing = await repository.findReviewScheduleByItem(input.itemId, input.itemType)
    if (existing) {
      logger?.info('review.add', 'Item already in review queue', {
        itemId: input.itemId,
        itemType: input.itemType,
        scheduleId: existing.id,
      })
      return existing
    }

    const now = new Date()
    const schedule: ReviewSchedule = {
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      taskId: input.itemId,
      itemId: input.itemId,
      itemType: input.itemType,
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

    logger?.info('review.add', 'Added item to review queue', {
      scheduleId: saved.id,
      itemId: input.itemId,
      itemType: input.itemType,
    })

    return saved
  }

  return {
    getDueItems,
    openDueItem,
    updateScheduleAfterResult,
    addToReviewQueue,
  }
}
