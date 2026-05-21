import type { WorkbenchMode, WorkbenchTab, TrainingAttemptResult } from '../types/index'
import type { AnalysisContextSource } from '../types/analysis'
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

export type DashboardData = {
  inboxTasks: unknown[]
  incompleteAttempts: unknown[]
  incompleteRecallSessions: unknown[]
  recentBadMoveTasks: unknown[]
}

export type WorkbenchFlowService = {
  submit(tabId: string): Promise<void>
  enterAnalysis(tabId: string): void
  returnFromAnalysis(tabId: string, toMode: WorkbenchMode): void
  completeRecall(tabId: string): void
  restartAttempt(tabId: string): void
  startAttempt(tabId: string): Promise<void>
  snapshotFromCurrentContext(tabId: string): Promise<WorkbenchTab>
  updatePlayerConfig(tabId: string, patch: Partial<import('../types/tab').PlayerConfig>): void
  loadDashboardData(): Promise<DashboardData>
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

    logger?.info('flow.submit', 'Submit attempt', {
      tabId,
      mode: tab.mode,
      attemptId: tab.activeAttemptId ?? null,
    })

    if (!tab.activeAttemptId) {
      workbenchStore.updateTab(tabId, { mode: 'recall' })
      logger?.info('flow.submit', 'Submit completed (no active attempt, direct recall)', {
        tabId,
      })
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

      logger?.info('flow.submit', 'Submit completed', {
        tabId,
        attemptId: tab.activeAttemptId,
        result,
        sessionId: session.id,
      })
    })()
  }

  function enterAnalysis(tabId: string): void {
    const tab = getTab(tabId)
    assertTransition(tab, 'enterAnalysis')

    logger?.info('flow.enterAnalysis', 'Enter analysis mode', {
      tabId,
      from: tab.mode,
      attemptId: tab.activeAttemptId ?? null,
    })

    workbenchStore.updateTab(tabId, {
      mode: 'analysis',
      previousMode: tab.mode,
      analysisContext: {
        taskId: tab.taskId,
        source: tab.mode as AnalysisContextSource,
        attemptId: tab.activeAttemptId,
      },
    })

    logger?.info('flow.enterAnalysis', 'Analysis mode entered', {
      tabId,
      previousMode: tab.mode,
    })
  }

  function returnFromAnalysis(tabId: string, toMode: WorkbenchMode): void {
    const tab = getTab(tabId)
    assertTransition(tab, 'returnFromAnalysis')

    logger?.info('flow.returnFromAnalysis', 'Return from analysis', {
      tabId,
      toMode,
      previousMode: tab.previousMode ?? null,
    })

    workbenchStore.updateTab(tabId, {
      mode: toMode,
      previousMode: undefined,
    })

    logger?.info('flow.returnFromAnalysis', 'Returned from analysis', {
      tabId,
      toMode,
    })
  }

  function completeRecall(tabId: string): void {
    const tab = getTab(tabId)
    assertTransition(tab, 'completeRecall')

    logger?.info('flow.completeRecall', 'Complete recall', {
      tabId,
      recallSessionId: tab.activeRecallSessionId ?? null,
    })

    // Orchestrate recall completion: complete session -> update mode
    const recallSessionId = tab.activeRecallSessionId
    if (recallSessionId) {
      deps.recallService.completeRecall(recallSessionId).catch((err) => {
        logger?.info('flow.completeRecall', 'Recall session completion failed', {
          tabId,
          recallSessionId,
          error: String(err),
        })
      })
    }

    // Clear recall view model state
    runtimeStore?.setRecallView(null)
    runtimeStore?.setActiveCheckpoint(undefined)

    workbenchStore.updateTab(tabId, {
      mode: 'analysis',
    })

    logger?.info('flow.completeRecall', 'Recall completed, transitioned to analysis', {
      tabId,
    })
  }

  function restartAttempt(tabId: string): void {
    const tab = getTab(tabId)
    const targetMode = tab.previousMode ?? 'play'

    logger?.info('flow.restartAttempt', 'Restart attempt', {
      tabId,
      currentMode: tab.mode,
      targetMode,
    })

    workbenchStore.updateTab(tabId, {
      mode: targetMode,
    })

    logger?.info('flow.restartAttempt', 'Attempt restarted', {
      tabId,
      targetMode,
    })
  }

  async function startAttempt(tabId: string): Promise<void> {
    const tab = getTab(tabId)

    logger?.info('flow.startAttempt', 'Start attempt', {
      tabId,
      taskId: tab.taskId,
    })

    const task = await repository.loadTask(tab.taskId)

    const attempt = await attemptService.createAttempt({
      taskId: tab.taskId,
      tabId: tab.id,
      rootPositionSgf: task?.rootPositionSgf ?? '',
    })

    workbenchStore.updateTab(tabId, {
      activeAttemptId: attempt.id,
    })

    logger?.info('flow.startAttempt', 'Attempt started', {
      tabId,
      attemptId: attempt.id,
    })
  }

  async function snapshotFromCurrentContext(tabId: string): Promise<WorkbenchTab> {
    const tab = getTab(tabId)

    logger?.info('flow.snapshotFromCurrentContext', 'Snapshot from current context', {
      tabId,
      mode: tab.mode,
      taskId: tab.taskId,
      attemptId: tab.activeAttemptId ?? null,
    })

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

    logger?.info('flow.snapshotFromCurrentContext', 'Snapshot created, new tab opened', {
      tabId,
      snapshotTaskId: snapshotTask.id,
      newTabId: newTab.id,
    })

    return newTab
  }

  function updatePlayerConfig(tabId: string, patch: Partial<import('../types/tab').PlayerConfig>): void {
    const tab = getTab(tabId)
    const merged = { ...tab.playerConfig, ...patch }
    workbenchStore.updateTab(tabId, { playerConfig: merged })
  }

  async function loadDashboardData(): Promise<DashboardData> {
    const [
      inboxTasks,
      incompleteAttempts,
      incompleteRecallSessions,
      recentBadMoveTasks,
    ] = await Promise.all([
      typeof repository.listTasksByStatus === 'function'
        ? repository.listTasksByStatus('inbox')
        : Promise.resolve([]),
      repository.listIncompleteAttempts(),
      repository.listIncompleteRecallSessions(),
      typeof repository.listTasksByOriginProvider === 'function'
        ? repository.listTasksByOriginProvider('bad_move')
        : Promise.resolve([]),
    ])

    return { inboxTasks, incompleteAttempts, incompleteRecallSessions, recentBadMoveTasks }
  }

  return {
    submit,
    enterAnalysis,
    returnFromAnalysis,
    completeRecall,
    restartAttempt,
    startAttempt,
    snapshotFromCurrentContext,
    updatePlayerConfig,
    loadDashboardData,
  }
}