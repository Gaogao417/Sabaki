import type { WorkbenchMode, WorkbenchTab, TrainingAttemptResult } from '../types/index'
import type { WorkbenchStore } from '../store/workbenchStore'
import type { TrainingRepository } from '../repository/trainingRepository'
import type { SnapshotService } from '../analysis/snapshotService'
import type { WorkbenchTabService } from './workbenchTabService'
import type { TrainingRuntimeStore } from '../store/trainingRuntimeStore'

const MODE_TRANSITIONS: Record<WorkbenchMode, string[]> = {
  play: ['submit', 'enterAnalysis'],
  problem: ['submit', 'enterAnalysis'],
  recall: ['completeRecall', 'enterAnalysis'],
  analysis: ['returnFromAnalysis'],
}

const TRANSITION_RESULT: Record<string, WorkbenchMode | null> = {
  'play:submit': 'recall',
  'problem:submit': 'recall',
  'recall:completeRecall': 'analysis',
  'play:enterAnalysis': 'analysis',
  'problem:enterAnalysis': 'analysis',
  'recall:enterAnalysis': 'analysis',
}

export class InvalidModeTransitionError extends Error {
  constructor(
    public readonly tabId: string,
    public readonly from: WorkbenchMode,
    public readonly method: string,
  ) {
    super(`Invalid mode transition: ${from} --${method}--> ? (tabId=${tabId})`)
    this.name = 'InvalidModeTransitionError'
  }
}

export type WorkbenchFlowServiceDeps = {
  workbenchStore: WorkbenchStore
  repository: TrainingRepository
  attemptService: {
    createAttempt(input: { taskId: string; tabId: string; rootPositionSgf: string }): Promise<{ id: string }>
    freezeAttempt(attemptId: string): Promise<void>
    finalizeAttemptResult(attemptId: string, result: TrainingAttemptResult): Promise<void>
  }
  recallService: {
    createRecallSession(input: Record<string, unknown>): Promise<{ id: string }>
    completeRecall(recallSessionId: string): Promise<void>
  }
  snapshotService: SnapshotService
  tabService: WorkbenchTabService
  evaluationRules?: {
    evaluateAttempt(input: {
      attempt: Record<string, unknown>
      evaluations: unknown[]
      badMoves: unknown[]
    }): TrainingAttemptResult
  }
  runtimeStore?: TrainingRuntimeStore
  logger?: { info(channel: string, message: string, data?: Record<string, unknown>): void }
}

export type WorkbenchFlowService = {
  submit(tabId: string): Promise<void>
  enterAnalysis(tabId: string): void
  returnFromAnalysis(tabId: string, toMode: WorkbenchMode): void
  completeRecall(tabId: string): void
  restartAttempt(tabId: string): void
  startAttempt(tabId: string): Promise<void>
  snapshotFromCurrentContext(tabId: string): Promise<WorkbenchTab>
}

export function createWorkbenchFlowService(deps: WorkbenchFlowServiceDeps): WorkbenchFlowService {
  const { workbenchStore, repository, attemptService, recallService, snapshotService, tabService, logger } = deps
  const evaluationRules = deps.evaluationRules
  const runtimeStore = deps.runtimeStore

  function getTab(tabId: string): WorkbenchTab {
    const tab = workbenchStore.getState().tabs.find(t => t.id === tabId)
    if (!tab) throw new Error(`workbenchFlowService: tab not found (id=${tabId})`)
    return tab
  }

  function assertTransition(tab: WorkbenchTab, method: string): void {
    const allowed = MODE_TRANSITIONS[tab.mode]
    if (!allowed || !allowed.includes(method)) {
      logger?.info('flow.transition.rejected', 'Transition rejected', {
        tabId: tab.id,
        from: tab.mode,
        method,
      })
      throw new InvalidModeTransitionError(tab.id, tab.mode, method)
    }
  }

  function submit(tabId: string): Promise<void> {
    const tab = getTab(tabId)
    assertTransition(tab, 'submit')

    if (!tab.activeAttemptId) {
      workbenchStore.updateTab(tabId, { mode: 'recall' })
      return Promise.resolve()
    }

    return (async () => {
      // Step 1: Freeze attempt
      await attemptService.freezeAttempt(tab.activeAttemptId)

      // Step 2 & 3: Load evaluations and bad moves, then evaluate
      let result: TrainingAttemptResult = 'pass'
      if (evaluationRules && attemptService.finalizeAttemptResult) {
        const [evaluations, badMoves] = await Promise.all([
          repository.listMoveEvaluationsByAttempt(tab.activeAttemptId),
          repository.listBadMovesByAttempt(tab.activeAttemptId),
        ])
        result = evaluationRules.evaluateAttempt({
          attempt: { id: tab.activeAttemptId },
          evaluations,
          badMoves,
        })

        // Step 4: Finalize attempt result
        await attemptService.finalizeAttemptResult(tab.activeAttemptId, result)
      }

      // Step 5: Create recall session
      const session = await recallService.createRecallSession({
        taskId: tab.taskId,
        tabId: tab.id,
        attemptId: tab.activeAttemptId,
      })

      // Step 6: Transition mode only after all work succeeds
      workbenchStore.updateTab(tabId, {
        mode: 'recall',
        activeRecallSessionId: session.id,
      })

      // Step 7: Update runtime store
      runtimeStore?.setProblemView(null)
      runtimeStore?.setActiveRecallSession(session.id)
    })()
  }

  function enterAnalysis(tabId: string): void {
    const tab = getTab(tabId)
    assertTransition(tab, 'enterAnalysis')

    workbenchStore.updateTab(tabId, {
      mode: 'analysis',
      previousMode: tab.mode,
    })
  }

  function returnFromAnalysis(tabId: string, toMode: WorkbenchMode): void {
    const tab = getTab(tabId)
    assertTransition(tab, 'returnFromAnalysis')

    workbenchStore.updateTab(tabId, {
      mode: toMode,
      previousMode: undefined,
    })
  }

  function completeRecall(tabId: string): void {
    const tab = getTab(tabId)
    assertTransition(tab, 'completeRecall')

    // Orchestrate recall completion: complete session -> update mode
    const recallSessionId = tab.activeRecallSessionId
    if (recallSessionId) {
      deps.recallService.completeRecall(recallSessionId).catch(() => {})
    }

    workbenchStore.updateTab(tabId, {
      mode: 'analysis',
    })
  }

  function restartAttempt(tabId: string): void {
    const tab = getTab(tabId)
    const targetMode = tab.previousMode ?? 'play'
    workbenchStore.updateTab(tabId, {
      mode: targetMode,
    })
  }

  async function startAttempt(tabId: string): Promise<void> {
    const tab = getTab(tabId)
    const task = await repository.loadTask(tab.taskId)

    const attempt = await attemptService.createAttempt({
      taskId: tab.taskId,
      tabId: tab.id,
      rootPositionSgf: task?.rootPositionSgf ?? '',
    })

    workbenchStore.updateTab(tabId, {
      activeAttemptId: attempt.id,
    })
  }

  async function snapshotFromCurrentContext(tabId: string): Promise<WorkbenchTab> {
    const tab = getTab(tabId)

    const snapshotInput = await snapshotService.captureSnapshotInput({
      tabId,
      sourceTaskId: tab.taskId,
      sourceAttemptId: tab.activeAttemptId,
    })

    const now = new Date().toISOString()
    const snapshotTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      rootPositionSgf: snapshotInput.positionSgf ?? '',
      sideToMove: snapshotInput.sideToMove,
      origin: {
        provider: 'snapshot' as const,
        parentTaskId: tab.taskId,
        parentAttemptId: tab.activeAttemptId,
        parentMoveIndex: undefined,
      },
      createdAt: now,
      updatedAt: now,
    }

    await repository.transaction(async () => {
      await repository.createTask(snapshotTask)
    })

    const newTab = await tabService.openTask({
      taskId: snapshotTask.id,
      mode: 'problem',
      parentTabId: tabId,
    })

    return newTab
  }

  return {
    submit,
    enterAnalysis,
    returnFromAnalysis,
    completeRecall,
    restartAttempt,
    startAttempt,
    snapshotFromCurrentContext,
  }
}