import type { WorkbenchMode, WorkbenchTab } from '../types/index'
import type { WorkbenchStore } from '../store/workbenchStore'
import type { SnapshotService } from '../analysis/snapshotService'
import type { WorkbenchTabService } from './workbenchTabService'
import type { TrainingRepository } from '../repository/trainingRepository'
import type { TaskImportService } from '../import/taskImportService'

const VALID_PHASES: Set<string> = new Set(['play', 'recall', 'analysis'])

/** @deprecated Use WorkbenchFlowService instead. */
export type PhaseTransition =
  | 'submit'
  | 'complete'
  | 'restart'
  | 'snapshot'

export const VALID_PHASE_TRANSITIONS: Record<WorkbenchMode, PhaseTransition[]> = {
  play: ['submit'],
  recall: ['complete', 'restart'],
  analysis: ['restart', 'snapshot'],
}

export const PHASE_TRANSITION_RESULT: Record<string, WorkbenchMode> = {
  'play:submit': 'recall',
  'recall:complete': 'analysis',
  'recall:restart': 'play',
  'analysis:restart': 'play',
}

/** @deprecated Use WorkbenchFlowService instead. */
export type WorkbenchPhaseService = {
  transition(tabId: string, transition: PhaseTransition): void
  getPhase(tabId: string): WorkbenchMode | null
  getMode(tabId: string): WorkbenchMode | null
  getValidTransitions(tabId: string): PhaseTransition[]
  snapshotFromAnalysis(tabId: string): Promise<WorkbenchTab>
}

export type WorkbenchPhaseServiceDeps = {
  workbenchStore: WorkbenchStore
  repository: TrainingRepository
  snapshotService: SnapshotService
  tabService: WorkbenchTabService
  taskImportService?: TaskImportService
  logger?: { info(channel: string, message: string, data?: Record<string, unknown>): void }
}

export class InvalidPhaseTransitionError extends Error {
  constructor(
    public readonly tabId: string,
    public readonly from: WorkbenchMode,
    public readonly transition: PhaseTransition,
  ) {
    super(`Invalid phase transition: ${from} --${transition}--> ? (tabId=${tabId})`)
    this.name = 'InvalidPhaseTransitionError'
  }
}

/** @deprecated Use createWorkbenchFlowService instead. This module will not receive new features. */
export function createWorkbenchPhaseService(deps: WorkbenchPhaseServiceDeps): WorkbenchPhaseService {
  const { workbenchStore, repository, snapshotService, tabService, taskImportService, logger } = deps

  function getTab(tabId: string) {
    return workbenchStore.getState().tabs.find(t => t.id === tabId) ?? null
  }

  function transition(tabId: string, transition: PhaseTransition): void {
    const tab = getTab(tabId)
    if (!tab) {
      throw new Error(`workbenchPhaseService.transition: tab not found (id=${tabId})`)
    }

    if (!VALID_PHASES.has(tab.mode)) {
      throw new Error(`workbenchPhaseService.transition: unknown phase "${tab.mode}" on tab ${tabId}`)
    }

    const allowed = VALID_PHASE_TRANSITIONS[tab.mode]
    if (!allowed.includes(transition)) {
      logger?.info('phase.transition.rejected', 'Phase transition rejected', {
        tabId,
        from: tab.mode,
        transition,
        allowed,
      })
      throw new InvalidPhaseTransitionError(tabId, tab.mode, transition)
    }

    const key = `${tab.mode}:${transition}` as const

    // snapshot does not change current tab phase — it creates a new tab
    if (transition === 'snapshot') {
      logger?.info('phase.snapshot', 'Snapshot transition (phase unchanged)', {
        tabId,
        from: tab.mode,
      })
      return
    }

    const newPhase = PHASE_TRANSITION_RESULT[key]
    if (!newPhase) {
      throw new Error(`workbenchPhaseService.transition: no result phase for ${key}`)
    }

    logger?.info('phase.transition', 'Phase transition', {
      tabId,
      from: tab.mode,
      to: newPhase,
      transition,
    })

    workbenchStore.updateTab(tabId, { mode: newPhase })
  }

  async function snapshotFromAnalysis(tabId: string): Promise<WorkbenchTab> {
    const tab = getTab(tabId)
    if (!tab) {
      throw new Error(`workbenchPhaseService.snapshotFromAnalysis: tab not found (id=${tabId})`)
    }
    if (tab.mode !== 'analysis') {
      throw new Error(`workbenchPhaseService.snapshotFromAnalysis: tab must be in analysis mode (current=${tab.mode})`)
    }

    const task = await repository.loadTask(tab.taskId)
    if (!task) {
      throw new Error(`workbenchPhaseService.snapshotFromAnalysis: task not found (id=${tab.taskId})`)
    }

    const snapshotInput = await snapshotService.captureSnapshotInput({
      tabId,
      sourceTaskId: tab.taskId,
      sourceAttemptId: undefined,
    })

    if (!taskImportService) {
      throw new Error('workbenchPhaseService.snapshotFromAnalysis: taskImportService is required')
    }

    const snapshotTask = await repository.transaction(async () => {
      const taskInput = {
        parentTaskId: (snapshotInput as { parentTaskId?: string }).parentTaskId ?? tab.taskId,
        positionSgf: snapshotInput.positionSgf,
        sideToMove: snapshotInput.sideToMove,
      } as Parameters<TaskImportService['createTaskFromSnapshot']>[0]

      const parentAttemptId =
        (snapshotInput as { parentAttemptId?: string }).parentAttemptId ??
        snapshotInput.sourceAttemptId
      if (parentAttemptId !== undefined) taskInput.parentAttemptId = parentAttemptId
      if (snapshotInput.referenceLines !== undefined) taskInput.referenceLines = snapshotInput.referenceLines
      const moveIndex =
        (snapshotInput as { moveIndex?: number }).moveIndex ??
        snapshotInput.sourceMoveIndex
      if (moveIndex !== undefined) taskInput.moveIndex = moveIndex
      if (snapshotInput.snapshotReason !== undefined) taskInput.snapshotReason = snapshotInput.snapshotReason

      return taskImportService.createTaskFromSnapshot(taskInput)
    })

    logger?.info('phase.snapshot.created', 'Snapshot task created', {
      tabId,
      taskId: snapshotTask.id,
      sourceTaskId: tab.taskId,
    })

    const newTab = await tabService.openTask({
      taskId: snapshotTask.id,
      mode: 'problem',
      parentTabId: tabId,
    })

    return newTab
  }

  function getPhase(tabId: string): WorkbenchMode | null {
    return getMode(tabId)
  }

  function getValidTransitions(tabId: string): PhaseTransition[] {
    const tab = getTab(tabId)
    if (!tab) return []
    if (!VALID_PHASES.has(tab.mode)) return []
    return VALID_PHASE_TRANSITIONS[tab.mode]
  }

  function getMode(tabId: string): WorkbenchMode | null {
    const tab = getTab(tabId)
    return tab?.mode ?? null
  }

  return {
    transition,
    snapshotFromAnalysis,
    getPhase,
    getMode,
    getValidTransitions,
  }
}
