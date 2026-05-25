import type { WorkbenchMode, WorkbenchTab, TrainingAttemptResult } from '../types/index'
import type { AnalysisContextSource } from '../types/analysis'
import type { WorkbenchStore } from '../store/workbenchStore'
import type { TrainingRepository } from '../repository/trainingRepository'
import type { SnapshotService } from '../analysis/snapshotService'
import type { WorkbenchTabService } from './workbenchTabService'
import type { TrainingRuntimeStore } from '../store/trainingRuntimeStore'
import { resolveTransition } from './modeTransitions'

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
    createRecallFromAttempt?: (attemptId: string) => Promise<{ id: string }>
    createRecallSession?: (input: Record<string, unknown>) => Promise<{ id: string }>
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
  returnFromAnalysis(input: {tabId: string}): void
  enterRecall(input: {tabId: string; attemptId: string}): Promise<{id: string}>
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
    // Legacy events not in modeTransitions state machine
    if (method === 'completeRecall') {
      if (tab.mode !== 'recall') {
        logger?.info('flow.transition.rejected', 'Transition rejected', {
          tabId: tab.id,
          from: tab.mode,
          method,
        })
        throw new InvalidModeTransitionError(tab.id, tab.mode, method)
      }
      return
    }

    // Legacy: enterAnalysis from recall without active session was allowed by old code.
    // The pure state machine requires hasActiveRecallSession, but the service preserves
    // backward compatibility for recall tabs without a session.
    if (method === 'enterAnalysis' && tab.mode === 'recall' && !tab.activeRecallSessionId) {
      return
    }

    const result = resolveTransition({
      from: tab.mode,
      event: method as 'submit' | 'enterAnalysis' | 'returnFromAnalysis' | 'restartAttempt' | 'snapshot',
      hasActiveAttempt: !!tab.activeAttemptId,
      isAttemptFrozen: false,
      hasActiveRecallSession: !!tab.activeRecallSessionId,
      hasTask: !!tab.taskId,
      hasCheckpoint: false,
      isCorrectionSubmitted: false,
      isCheckpointAiRevealed: false,
      isCheckpointSavedOrSkipped: false,
      hasAnalysisReturnTarget: !!tab.analysisReturnTarget,
    })
    if (!result.allowed) {
      logger?.info('flow.transition.rejected', 'Transition rejected', {
        tabId: tab.id,
        from: tab.mode,
        method,
        reason: result.reason,
      })
      throw new InvalidModeTransitionError(tab.id, tab.mode, method)
    }
  }

  async function createRecallForAttempt(tab: WorkbenchTab): Promise<{ id: string }> {
    if (!tab.activeAttemptId) {
      throw new Error(`workbenchFlowService.submit: no active attempt (tabId=${tab.id})`)
    }

    if (recallService.createRecallFromAttempt) {
      return recallService.createRecallFromAttempt(tab.activeAttemptId)
    }

    if (recallService.createRecallSession) {
      return recallService.createRecallSession({
        taskId: tab.taskId,
        tabId: tab.id,
        attemptId: tab.activeAttemptId,
      })
    }

    throw new Error('workbenchFlowService.submit: recall service cannot create recall from attempt')
  }

  function submit(tabId: string): Promise<void> {
    const tab = getTab(tabId)

    logger?.info('flow.submit', 'Submit attempt', {
      tabId,
      mode: tab.mode,
      attemptId: tab.activeAttemptId ?? null,
    })

    if (!tab.activeAttemptId) {
      // Legacy path: no active attempt, directly transition to recall.
      // The pure state machine rejects this case (P1G-T07), but the service
      // preserves backward compatibility for callers without an attempt.
      if (tab.mode !== 'play' && tab.mode !== 'problem') {
        logger?.info('flow.transition.rejected', 'Transition rejected', {
          tabId: tab.id,
          from: tab.mode,
          method: 'submit',
        })
        throw new InvalidModeTransitionError(tab.id, tab.mode, 'submit')
      }
      workbenchStore.updateTab(tabId, { mode: 'recall' })
      logger?.info('flow.submit', 'Submit completed (no active attempt, direct recall)', {
        tabId,
      })
      return Promise.resolve()
    }
    const activeAttemptId = tab.activeAttemptId

    assertTransition(tab, 'submit')

    return (async () => {
      // Step 1 & 2: Load evaluations and bad moves, then evaluate while
      // the Attempt is still mutable. Repository guards reject result/status
      // patches once the Attempt has been frozen.
      let result: TrainingAttemptResult = 'pass'
      if (evaluationRules && attemptService.finalizeAttemptResult) {
        const [evaluations, badMoves] = await Promise.all([
          repository.listMoveEvaluationsByAttempt(activeAttemptId),
          repository.listBadMovesByAttempt(activeAttemptId),
        ])
        result = evaluationRules.evaluateAttempt({
          attempt: { id: activeAttemptId },
          evaluations,
          badMoves,
        })

        // Step 3: Finalize attempt result
        await attemptService.finalizeAttemptResult(activeAttemptId, result)
      }

      // Step 4: Freeze attempt
      await attemptService.freezeAttempt(activeAttemptId)

      // Step 5: Create recall session from the submitted attempt.
      const session = await createRecallForAttempt(tab)

      // Step 6: Transition mode only after all work succeeds
      workbenchStore.updateTab(tabId, {
        mode: 'recall',
        recallSubstate: 'normal',
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

    const analysisReturnTarget = {
      mode: tab.mode as 'play' | 'problem' | 'recall',
      recallSubstate: tab.recallSubstate,
      treePosition: tab.currentTreePosition,
    }

    workbenchStore.updateTab(tabId, {
      mode: 'analysis',
      previousMode: tab.mode,
      analysisReturnTarget,
      analysisContext: {
        taskId: tab.taskId,
        source: tab.mode as AnalysisContextSource,
        attemptId: tab.activeAttemptId,
      },
    })

    logger?.info('flow.enterAnalysis', 'Analysis mode entered', {
      tabId,
      previousMode: tab.mode,
      analysisReturnTarget,
    })
  }

  function returnFromAnalysis(input: {tabId: string}): void {
    const tab = getTab(input.tabId)

    if (!tab.analysisReturnTarget) {
      logger?.info('flow.returnFromAnalysis', 'Return rejected: no analysisReturnTarget', {
        tabId: input.tabId,
      })
      throw new InvalidModeTransitionError(input.tabId, tab.mode, 'returnFromAnalysis')
    }

    assertTransition(tab, 'returnFromAnalysis')

    const target = tab.analysisReturnTarget

    logger?.info('flow.returnFromAnalysis', 'Return from analysis', {
      tabId: input.tabId,
      targetMode: target.mode,
      targetRecallSubstate: target.recallSubstate ?? null,
      targetTreePosition: target.treePosition ?? null,
    })

    workbenchStore.updateTab(input.tabId, {
      mode: target.mode,
      recallSubstate: target.recallSubstate,
      currentTreePosition: target.treePosition,
      previousMode: undefined,
      analysisReturnTarget: undefined,
    })

    logger?.info('flow.returnFromAnalysis', 'Returned from analysis', {
      tabId: input.tabId,
      toMode: target.mode,
    })
  }

  async function enterRecall(input: {tabId: string; attemptId: string}): Promise<{id: string}> {
    const tab = getTab(input.tabId)

    logger?.info('flow.enterRecall', 'Enter recall mode', {
      tabId: input.tabId,
      attemptId: input.attemptId,
      fromMode: tab.mode,
    })

    // Create recall session from the attempt
    const session = await createRecallForAttempt({
      ...tab,
      activeAttemptId: input.attemptId,
    })

    workbenchStore.updateTab(input.tabId, {
      mode: 'recall',
      recallSubstate: 'normal',
      activeRecallSessionId: session.id,
    })

    runtimeStore?.setActiveRecallSession(session.id)

    logger?.info('flow.enterRecall', 'Recall mode entered', {
      tabId: input.tabId,
      sessionId: session.id,
    })

    return session
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
    const targetMode = tab.analysisReturnTarget?.mode ?? tab.previousMode ?? 'play'

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
      sourceTaskId: tab.taskId ?? undefined,
      sourceAttemptId: tab.activeAttemptId,
    })

    const now = new Date().toISOString()
    const snapshotTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      rootPositionSgf: snapshotInput.positionSgf ?? '',
      sideToMove: snapshotInput.sideToMove,
      origin: {
        provider: 'snapshot' as const,
        parentTaskId: tab.taskId ?? undefined,
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
    const merged: import('../types/tab').PlayerConfig = {
      black: tab.playerConfig?.black ?? 'human',
      white: tab.playerConfig?.white ?? 'human',
      problemOpponent: tab.playerConfig?.problemOpponent,
      ai: tab.playerConfig?.ai,
      ...patch,
    }
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
    enterRecall,
    completeRecall,
    restartAttempt,
    startAttempt,
    snapshotFromCurrentContext,
    updatePlayerConfig,
    loadDashboardData,
  }
}
