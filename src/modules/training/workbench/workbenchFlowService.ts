import type {
  WorkbenchMode,
  WorkbenchTab,
  TrainingAttemptResult,
  ReferenceLine,
  RecallSession,
  AnalysisReturnTarget,
} from '../types/index'
import type {AnalysisContextSource} from '../types/analysis'
import type {WorkbenchStore} from '../store/workbenchStore'
import type {TrainingRepository} from '../repository/trainingRepository'
import type {SnapshotService} from '../analysis/snapshotService'
import type {WorkbenchTabService} from './workbenchTabService'
import type {
  TrainingRuntimeStore,
} from '../store/trainingRuntimeStore'
import type {RecallCheckpointService} from '../recall/recallCheckpointService'
import type {
  ProblemFlowService,
  SubmitProblemResult,
  UndoMoveResult,
} from '../problem/problemFlowService'
import type {WorkbenchOverlayRegion} from '../../overlays/workbenchOverlayRegion'
import {resolveTransition} from './modeTransitions'
import {
  createWorkbenchRuntimeRegion,
  type WorkbenchRuntimeRegion,
} from './workbenchRuntimeRegion'

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
    createAttempt(input: {
      taskId: string
      tabId: string
      rootPositionSgf: string
    }): Promise<{id: string}>
    freezeAttempt(attemptId: string): Promise<void>
    finalizeAttemptResult(
      attemptId: string,
      result: TrainingAttemptResult,
    ): Promise<void>
  }
  recallService: {
    createRecallFromAttempt?: (attemptId: string) => Promise<RecallSession>
    createRecallSession?: (
      input: Record<string, unknown>,
    ) => Promise<RecallSession>
    skipRecallMove?: (recallSessionId: string) => Promise<unknown>
    completeRecall(recallSessionId: string): Promise<void>
  }
  recallCheckpointService?: RecallCheckpointService
  snapshotService: SnapshotService
  tabService: WorkbenchTabService
  problemFlowService?: ProblemFlowService
  modeEffects?: WorkbenchModeEffects
  overlayRegion?: WorkbenchOverlayRegion
  evaluationRules?: {
    evaluateAttempt(input: {
      attempt: Record<string, unknown>
      evaluations: unknown[]
      badMoves: unknown[]
    }): TrainingAttemptResult
  }
  runtimeStore?: TrainingRuntimeStore
  runtimeRegion?: WorkbenchRuntimeRegion
  logger?: {
    info(channel: string, message: string, data?: Record<string, unknown>): void
  }
}

export type ModeEnterReason =
  | 'manual'
  | 'snapshot'
  | 'edit-position'
  | 'recall-complete'
export type ModeExitReason = 'return' | 'restart-attempt'

export type ModeEffectAnalysisContext = {
  taskId?: string | null
  source: AnalysisContextSource
  attemptId?: string
  checkpointId?: string
  positionHash?: string
  positionSgf?: string
}

export type ModeEnterEffectInput = {
  tabId: string
  fromMode: 'play' | 'problem' | 'recall'
  toMode: 'analysis'
  beforeTab: WorkbenchTab
  afterTab: WorkbenchTab
  analysisReturnTarget: AnalysisReturnTarget
  analysisContext: ModeEffectAnalysisContext
  reason?: ModeEnterReason
  selectedTool?: string
}

export type ModeExitEffectInput = {
  tabId: string
  fromMode: 'analysis'
  toMode: 'play' | 'problem' | 'recall'
  beforeTab: WorkbenchTab
  afterTab: WorkbenchTab
  analysisReturnTarget: AnalysisReturnTarget
  reason?: ModeExitReason
}

export type WorkbenchModeEffects = {
  enterAnalysis(input: ModeEnterEffectInput): void | Promise<void>
  exitAnalysis(input: ModeExitEffectInput): void | Promise<void>
}

type LegacySabakiAnalysisAdapter = {
  state?: {
    mode?: string
    editWorkspace?: {activeTab?: string} | null
    analysisType?: string
  }
  setMode?: (
    mode: string,
    options?: {autoEnableTerritory?: boolean},
  ) => void
  setState?: (patch: Record<string, unknown>) => void
  createAnalysisWorkspace?: () => unknown
  scheduleEditWorkspaceAnalysis?: (tab?: string) => void
}

export type DashboardData = {
  inboxTasks: unknown[]
  incompleteAttempts: unknown[]
  incompleteRecallSessions: unknown[]
  recentBadMoveTasks: unknown[]
}

export type WorkbenchFlowService = {
  submit(tabId: string): Promise<void>
  undoProblemMove(tabId: string): Promise<UndoMoveResult | null>
  abandonProblem(tabId: string): Promise<void>
  enterAnalysis(
    tabId: string,
    options?: {reason?: ModeEnterReason; selectedTool?: string},
  ): void
  returnFromAnalysis(input: {tabId: string; reason?: ModeExitReason}): void
  enterRecall(input: {tabId: string; attemptId: string}): Promise<{id: string}>
  showRecallHint(tabId: string): void
  skipRecallMove(tabId: string): Promise<void>
  completeRecall(tabId: string): void
  restartAttempt(tabId: string): void
  startAttempt(tabId: string): Promise<void>
  submitCheckpointCorrection(tabId: string): Promise<void>
  revealCheckpointAi(tabId: string): Promise<ReferenceLine[]>
  skipCheckpoint(tabId: string): Promise<void>
  saveCheckpointComment(input: {tabId: string; content: string}): Promise<void>
  snapshotFromCurrentContext(tabId: string): Promise<WorkbenchTab>
  updatePlayerConfig(
    tabId: string,
    patch: Partial<import('../types/tab').PlayerConfig>,
  ): void
  loadDashboardData(): Promise<DashboardData>
  setModeEffects?(modeEffects?: WorkbenchModeEffects | null): void
}

export function createSabakiModeEffects(
  sabaki: LegacySabakiAnalysisAdapter,
): WorkbenchModeEffects {
  function ensureAnalysisWorkspace(selectedTool?: string): void {
    if (!sabaki.state || typeof sabaki.setState !== 'function') return

    if (sabaki.state.mode !== 'analysis') {
      sabaki.setMode?.('analysis', {autoEnableTerritory: false})
    } else if (!sabaki.state.editWorkspace && sabaki.createAnalysisWorkspace) {
      sabaki.setState({
        editWorkspace: sabaki.createAnalysisWorkspace(),
      })
      sabaki.scheduleEditWorkspaceAnalysis?.()
    } else if (sabaki.state.editWorkspace) {
      sabaki.scheduleEditWorkspaceAnalysis?.(
        sabaki.state.editWorkspace.activeTab || 'current',
      )
    }

    const statePatch: Record<string, unknown> = {
      showAnalysis: true,
      analysisType: sabaki.state.analysisType || 'winrate',
    }
    if (selectedTool != null) statePatch.selectedTool = selectedTool
    sabaki.setState(statePatch)
  }

  function exitAnalysisWorkspace(): void {
    if (!sabaki.state) return
    if (sabaki.state.mode === 'analysis') {
      sabaki.setMode?.('play')
    }
  }

  return {
    enterAnalysis(input) {
      ensureAnalysisWorkspace(input.selectedTool)
    },
    exitAnalysis() {
      exitAnalysisWorkspace()
    },
  }
}

export function createWorkbenchFlowService(
  deps: WorkbenchFlowServiceDeps,
): WorkbenchFlowService {
  const {
    workbenchStore,
    repository,
    attemptService,
    recallService,
    recallCheckpointService,
    snapshotService,
    tabService,
    problemFlowService,
    logger,
  } = deps
  let activeModeEffects = deps.modeEffects
  const overlayRegion = deps.overlayRegion
  const evaluationRules = deps.evaluationRules
  const runtimeStore = deps.runtimeStore
  const runtimeRegion =
    deps.runtimeRegion ??
    (runtimeStore ? createWorkbenchRuntimeRegion({runtimeStore}) : undefined)

  function getTab(tabId: string): WorkbenchTab {
    const tab = workbenchStore.getState().tabs.find((t) => t.id === tabId)
    if (!tab)
      throw new Error(`workbenchFlowService: tab not found (id=${tabId})`)
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
    if (
      method === 'enterAnalysis' &&
      tab.mode === 'recall' &&
      !tab.activeRecallSessionId
    ) {
      return
    }

    // Legacy/Free-play: enterAnalysis from play/problem without a task is allowed for free play.
    if (
      method === 'enterAnalysis' &&
      (tab.mode === 'play' || tab.mode === 'problem') &&
      !tab.taskId
    ) {
      return
    }

    const result = resolveTransition({
      from: tab.mode,
      event: method as
        | 'submit'
        | 'enterAnalysis'
        | 'returnFromAnalysis'
        | 'restartAttempt'
        | 'snapshot',
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

  function getCheckpointCommandContext(
    tabId: string,
    method: string,
  ): {
    tab: WorkbenchTab
    checkpointId: string
  } {
    const tab = getTab(tabId)
    if (tab.mode !== 'recall') {
      throw new InvalidModeTransitionError(tab.id, tab.mode, method)
    }
    if (!runtimeStore) {
      throw new Error(
        `workbenchFlowService.${method}: runtimeStore is required`,
      )
    }
    if (!recallCheckpointService) {
      throw new Error(
        `workbenchFlowService.${method}: recallCheckpointService is required`,
      )
    }

    const checkpointId = runtimeStore.getState().activeCheckpointId
    if (!checkpointId) {
      throw new Error(
        `workbenchFlowService.${method}: no active checkpoint (tabId=${tabId})`,
      )
    }

    return {tab, checkpointId}
  }

  function assertCheckpointTransition(input: {
    tab: WorkbenchTab
    event: 'revealAi' | 'commentCheckpoint' | 'resumeRecall'
    method: string
    hasCheckpoint?: boolean
    isCorrectionSubmitted?: boolean
    isCheckpointAiRevealed?: boolean
    isCheckpointSavedOrSkipped?: boolean
  }): void {
    const result = resolveTransition({
      from: input.tab.mode,
      recallSubstate: input.tab.recallSubstate,
      event: input.event,
      hasActiveAttempt: !!input.tab.activeAttemptId,
      isAttemptFrozen: false,
      hasActiveRecallSession: !!input.tab.activeRecallSessionId,
      hasTask: !!input.tab.taskId,
      hasCheckpoint: input.hasCheckpoint ?? true,
      isCorrectionSubmitted: input.isCorrectionSubmitted ?? false,
      isCheckpointAiRevealed: input.isCheckpointAiRevealed ?? false,
      isCheckpointSavedOrSkipped: input.isCheckpointSavedOrSkipped ?? false,
      hasAnalysisReturnTarget: !!input.tab.analysisReturnTarget,
    })

    if (!result.allowed) {
      logger?.info('flow.transition.rejected', 'Transition rejected', {
        tabId: input.tab.id,
        from: input.tab.mode,
        method: input.method,
        reason: result.reason,
      })
      throw new InvalidModeTransitionError(
        input.tab.id,
        input.tab.mode,
        input.method,
      )
    }
  }

  function createAnalysisReturnTarget(tab: WorkbenchTab): AnalysisReturnTarget {
    const target: AnalysisReturnTarget = {
      mode: tab.mode as 'play' | 'problem' | 'recall',
    }

    if (tab.recallSubstate !== undefined) {
      target.recallSubstate = tab.recallSubstate
    }
    if (tab.currentTreePosition !== undefined) {
      target.treePosition = tab.currentTreePosition
    }

    const recallMoveIndex = runtimeStore?.getState().recallView?.moveIndex
    if (tab.mode === 'recall' && recallMoveIndex !== undefined) {
      target.moveIndex = recallMoveIndex
    }

    return target
  }

  function createAnalysisContext(
    tab: WorkbenchTab,
  ): NonNullable<WorkbenchTab['analysisContext']> {
    const context: NonNullable<WorkbenchTab['analysisContext']> = {
      taskId: tab.taskId,
      source: tab.mode,
    }

    if (tab.activeAttemptId !== undefined) {
      context.attemptId = tab.activeAttemptId
    }

    const checkpointId = runtimeStore?.getState().activeCheckpointId
    if (checkpointId !== undefined) {
      context.checkpointId = checkpointId
    }

    return context
  }

  function assertProblemCommand(tab: WorkbenchTab, method: string): void {
    if (tab.mode !== 'problem') {
      logger?.info('flow.transition.rejected', 'Transition rejected', {
        tabId: tab.id,
        from: tab.mode,
        method,
      })
      throw new InvalidModeTransitionError(tab.id, tab.mode, method)
    }
  }

  async function createRecallForAttempt(
    tab: WorkbenchTab,
  ): Promise<RecallSession> {
    if (!tab.activeAttemptId) {
      throw new Error(
        `workbenchFlowService.submit: no active attempt (tabId=${tab.id})`,
      )
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

    throw new Error(
      'workbenchFlowService.submit: recall service cannot create recall from attempt',
    )
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
      workbenchStore.updateTab(tabId, {mode: 'recall'})
      logger?.info(
        'flow.submit',
        'Submit completed (no active attempt, direct recall)',
        {
          tabId,
        },
      )
      return Promise.resolve()
    }
    const activeAttemptId = tab.activeAttemptId

    assertTransition(tab, 'submit')

    return (async () => {
      let problemSubmitResult: SubmitProblemResult | null = null
      if (tab.mode === 'problem' && problemFlowService) {
        problemSubmitResult = await problemFlowService.submitActiveProblem()
      }

      if (problemSubmitResult) {
        const session = await createRecallForAttempt(tab)

        workbenchStore.updateTab(tabId, {
          mode: 'recall',
          recallSubstate: 'normal',
          activeRecallSessionId: session.id,
        })

        if (runtimeRegion) runtimeRegion.onRecallActivated({session})

        logger?.info('flow.submit', 'Problem submit completed', {
          tabId,
          attemptId: tab.activeAttemptId,
          result: problemSubmitResult.result,
          sessionId: session.id,
        })
        return
      }

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
          attempt: {id: activeAttemptId},
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

      if (runtimeRegion) runtimeRegion.onRecallActivated({session})

      logger?.info('flow.submit', 'Submit completed', {
        tabId,
        attemptId: tab.activeAttemptId,
        result,
        sessionId: session.id,
      })
    })()
  }

  async function undoProblemMove(
    tabId: string,
  ): Promise<UndoMoveResult | null> {
    const tab = getTab(tabId)
    assertProblemCommand(tab, 'undoProblemMove')

    if (!problemFlowService) {
      throw new Error(
        'workbenchFlowService.undoProblemMove: problemFlowService is required',
      )
    }

    logger?.info('flow.problemUndo', 'Undo problem move', {
      tabId,
      attemptId: tab.activeAttemptId ?? null,
    })

    return problemFlowService.undoProblemMove()
  }

  async function abandonProblem(tabId: string): Promise<void> {
    const tab = getTab(tabId)
    assertProblemCommand(tab, 'abandonProblem')

    logger?.info('flow.problemAbandon', 'Abandon problem attempt', {
      tabId,
      attemptId: tab.activeAttemptId ?? null,
    })

    if (problemFlowService) {
      await problemFlowService.abandonActiveProblem()
    } else if (tab.activeAttemptId) {
      await attemptService.finalizeAttemptResult(tab.activeAttemptId, 'abandoned')
      runtimeStore?.setProblemView(null)
    } else {
      runtimeStore?.setProblemView(null)
    }

    workbenchStore.updateTab(tabId, {
      mode: 'play',
      activeAttemptId: undefined,
    })
  }

  function enterAnalysis(
    tabId: string,
    options?: {reason?: ModeEnterReason; selectedTool?: string},
  ): void {
    const tab = getTab(tabId)
    assertTransition(tab, 'enterAnalysis')

    logger?.info('flow.enterAnalysis', 'Enter analysis mode', {
      tabId,
      from: tab.mode,
      attemptId: tab.activeAttemptId ?? null,
    })

    const analysisReturnTarget = createAnalysisReturnTarget(tab)
    const analysisContext = createAnalysisContext(tab)

    workbenchStore.updateTab(tabId, {
      mode: 'analysis',
      previousMode: tab.mode,
      analysisReturnTarget,
      analysisContext: analysisContext as ModeEffectAnalysisContext,
    })
    const afterTab = getTab(tabId)
    const fromMode = tab.mode as 'play' | 'problem' | 'recall'

    overlayRegion?.onWorkbenchModeTransition({
      tabId,
      fromMode,
      toMode: 'analysis',
      beforeTab: tab,
      afterTab,
      reason: options?.reason,
    })

    activeModeEffects?.enterAnalysis({
      tabId,
      fromMode,
      toMode: 'analysis',
      beforeTab: tab,
      afterTab,
      analysisReturnTarget,
      analysisContext,
      reason: options?.reason,
      selectedTool: options?.selectedTool,
    })

    logger?.info('flow.enterAnalysis', 'Analysis mode entered', {
      tabId,
      previousMode: tab.mode,
      analysisReturnTarget,
    })
  }

  function returnFromAnalysis(input: {
    tabId: string
    reason?: ModeExitReason
  }): void {
    const tab = getTab(input.tabId)

    if (!tab.analysisReturnTarget) {
      logger?.info(
        'flow.returnFromAnalysis',
        'Return rejected: no analysisReturnTarget',
        {
          tabId: input.tabId,
        },
      )
      throw new InvalidModeTransitionError(
        input.tabId,
        tab.mode,
        'returnFromAnalysis',
      )
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
    const afterTab = getTab(input.tabId)

    overlayRegion?.onWorkbenchModeTransition({
      tabId: input.tabId,
      fromMode: 'analysis',
      toMode: target.mode,
      beforeTab: tab,
      afterTab,
      reason: input.reason,
    })

    activeModeEffects?.exitAnalysis({
      tabId: input.tabId,
      fromMode: 'analysis',
      toMode: target.mode,
      beforeTab: tab,
      afterTab,
      analysisReturnTarget: target,
      reason: input.reason,
    })

    logger?.info('flow.returnFromAnalysis', 'Returned from analysis', {
      tabId: input.tabId,
      toMode: target.mode,
    })
  }

  async function enterRecall(input: {
    tabId: string
    attemptId: string
  }): Promise<{id: string}> {
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

    if (runtimeRegion) runtimeRegion.onRecallActivated({session})

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
        logger?.info(
          'flow.completeRecall',
          'Recall session completion failed',
          {
            tabId,
            recallSessionId,
            error: String(err),
          },
        )
      })
    }

    const analysisReturnTarget = createAnalysisReturnTarget(tab)
    const analysisContext = createAnalysisContext(tab)

    if (runtimeRegion) runtimeRegion.onRecallCompleted({sessionId: recallSessionId})

    workbenchStore.updateTab(tabId, {
      mode: 'analysis',
      previousMode: tab.mode,
      analysisReturnTarget,
      analysisContext: analysisContext as ModeEffectAnalysisContext,
    })
    const afterTab = getTab(tabId)

    overlayRegion?.onWorkbenchModeTransition({
      tabId,
      fromMode: 'recall',
      toMode: 'analysis',
      beforeTab: tab,
      afterTab,
      reason: 'recall-complete',
    })

    activeModeEffects?.enterAnalysis({
      tabId,
      fromMode: 'recall',
      toMode: 'analysis',
      beforeTab: tab,
      afterTab,
      analysisReturnTarget,
      analysisContext,
      reason: 'recall-complete',
    })

    logger?.info(
      'flow.completeRecall',
      'Recall completed, transitioned to analysis',
      {
        tabId,
      },
    )
  }

  function showRecallHint(tabId: string): void {
    const tab = getTab(tabId)
    if (tab.mode !== 'recall') {
      throw new InvalidModeTransitionError(tab.id, tab.mode, 'showRecallHint')
    }
    if (!runtimeStore) {
      throw new Error('workbenchFlowService.showRecallHint: runtimeStore is required')
    }

    const recallView = runtimeStore.getState().recallView
    if (!recallView || recallView.completed) return

    runtimeStore.setRecallView({
      ...recallView,
      showHint: true,
    })

    logger?.info('flow.recallHint', 'Recall hint shown', {
      tabId,
      recallSessionId: recallView.recallSessionId,
      moveIndex: recallView.moveIndex,
    })
  }

  async function skipRecallMove(tabId: string): Promise<void> {
    const tab = getTab(tabId)
    if (tab.mode !== 'recall') {
      throw new InvalidModeTransitionError(tab.id, tab.mode, 'skipRecallMove')
    }
    if (!runtimeStore) {
      throw new Error('workbenchFlowService.skipRecallMove: runtimeStore is required')
    }

    const recallView = runtimeStore.getState().recallView
    if (!recallView || recallView.completed) return

    const recallSessionId = tab.activeRecallSessionId ?? recallView.recallSessionId
    if (recallSessionId && recallService.skipRecallMove) {
      await recallService.skipRecallMove(recallSessionId)
      return
    }

    const expected = recallView.expectedMoves[recallView.moveIndex]
    if (!expected) return

    const nextIndex = recallView.moveIndex + 1
    runtimeStore.setRecallView({
      ...recallView,
      moveIndex: nextIndex,
      userAttempts: [
        ...recallView.userAttempts,
        {vertex: 'skip', isCorrect: false},
      ],
      showHint: false,
      completed: nextIndex >= recallView.expectedMoves.length,
    })

    logger?.info('flow.recallSkip', 'Recall move skipped', {
      tabId,
      recallSessionId,
      moveIndex: recallView.moveIndex,
    })
  }

  function restartAttempt(tabId: string): void {
    const tab = getTab(tabId)
    const targetMode =
      tab.analysisReturnTarget?.mode ?? tab.previousMode ?? 'play'
    const shouldExitAnalysis = tab.mode === 'analysis' && targetMode !== 'analysis'
    const analysisReturnTarget =
      tab.analysisReturnTarget ??
      (targetMode === 'play' || targetMode === 'problem' || targetMode === 'recall'
        ? ({mode: targetMode} as AnalysisReturnTarget)
        : undefined)

    logger?.info('flow.restartAttempt', 'Restart attempt', {
      tabId,
      currentMode: tab.mode,
      targetMode,
    })

    workbenchStore.updateTab(tabId, {
      mode: targetMode,
      previousMode: undefined,
      analysisReturnTarget: undefined,
    })
    const afterTab = getTab(tabId)

    if (shouldExitAnalysis && analysisReturnTarget) {
      overlayRegion?.onWorkbenchModeTransition({
        tabId,
        fromMode: 'analysis',
        toMode: targetMode as 'play' | 'problem' | 'recall',
        beforeTab: tab,
        afterTab,
        reason: 'restart-attempt',
      })

      activeModeEffects?.exitAnalysis({
        tabId,
        fromMode: 'analysis',
        toMode: targetMode as 'play' | 'problem' | 'recall',
        beforeTab: tab,
        afterTab,
        analysisReturnTarget,
        reason: 'restart-attempt',
      })
    }

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

  async function submitCheckpointCorrection(tabId: string): Promise<void> {
    const {tab, checkpointId} = getCheckpointCommandContext(
      tabId,
      'submitCheckpointCorrection',
    )
    const draft = runtimeStore!.getState().correctionDraft
    const moves =
      draft && draft.checkpointId === checkpointId ? draft.moves : []

    await recallCheckpointService!.submitUserCorrectionLine({
      checkpointId,
      moves,
    })

    workbenchStore.updateTab(tab.id, {
      recallSubstate: 'checkpoint_correction',
    })
  }

  async function revealCheckpointAi(tabId: string): Promise<ReferenceLine[]> {
    const {tab, checkpointId} = getCheckpointCommandContext(
      tabId,
      'revealCheckpointAi',
    )
    const checkpoint = await repository.loadRecallCheckpoint(checkpointId)
    const isCorrectionSubmitted =
      !!checkpoint && checkpoint.userCorrectionLine.length > 0

    assertCheckpointTransition({
      tab,
      event: 'revealAi',
      method: 'revealCheckpointAi',
      isCorrectionSubmitted,
    })

    const lines =
      await recallCheckpointService!.revealAiCandidateLines(checkpointId)

    workbenchStore.updateTab(tab.id, {
      recallSubstate: 'checkpoint_ai_revealed',
    })

    return lines
  }

  async function skipCheckpoint(tabId: string): Promise<void> {
    const {tab, checkpointId} = getCheckpointCommandContext(
      tabId,
      'skipCheckpoint',
    )

    await recallCheckpointService!.skipCheckpoint(checkpointId)
    if (runtimeRegion) runtimeRegion.onCheckpointResumed({checkpointId})

    const updatedTab = getTab(tab.id)
    assertCheckpointTransition({
      tab: updatedTab,
      event: 'resumeRecall',
      method: 'skipCheckpoint',
      isCheckpointSavedOrSkipped: true,
    })

    workbenchStore.updateTab(tab.id, {
      recallSubstate: 'normal',
    })
  }

  async function saveCheckpointComment(input: {
    tabId: string
    content: string
  }): Promise<void> {
    const {tab, checkpointId} = getCheckpointCommandContext(
      input.tabId,
      'saveCheckpointComment',
    )
    const checkpoint = await repository.loadRecallCheckpoint(checkpointId)
    const isCheckpointAiRevealed = checkpoint?.status === 'ai_revealed'

    assertCheckpointTransition({
      tab,
      event: 'commentCheckpoint',
      method: 'saveCheckpointComment',
      isCheckpointAiRevealed,
    })

    workbenchStore.updateTab(tab.id, {
      recallSubstate: 'checkpoint_commenting',
    })

    await recallCheckpointService!.saveComment({
      checkpointId,
      comment: {
        id: '',
        target: {kind: 'checkpoint', checkpointId},
        content: input.content,
        createdAt: '',
        updatedAt: '',
      },
    })

    const commentingTab = getTab(tab.id)
    assertCheckpointTransition({
      tab: commentingTab,
      event: 'resumeRecall',
      method: 'saveCheckpointComment',
      isCheckpointSavedOrSkipped: true,
    })

    await recallCheckpointService!.resumeRecall(checkpointId)
    if (runtimeRegion) runtimeRegion.onCheckpointResumed({checkpointId})

    workbenchStore.updateTab(tab.id, {
      recallSubstate: 'normal',
    })
  }

  async function snapshotFromCurrentContext(
    tabId: string,
  ): Promise<WorkbenchTab> {
    const tab = getTab(tabId)

    if (tab.mode !== 'analysis') {
      logger?.info(
        'flow.snapshotFromCurrentContext',
        'Snapshot guard entered analysis first',
        {
          tabId,
          mode: tab.mode,
          taskId: tab.taskId ?? null,
        },
      )
      enterAnalysis(tabId, {reason: 'snapshot'})
      return getTab(tabId)
    }

    assertTransition(tab, 'snapshot')

    if (tab.taskId == null) {
      logger?.info(
        'flow.snapshotFromCurrentContext',
        'Snapshot rejected: null-task analysis cannot persist directly',
        {
          tabId,
          mode: tab.mode,
        },
      )
      throw new Error(
        `workbenchFlowService.snapshotFromCurrentContext: cannot persist snapshot directly from null task (tabId=${tabId})`,
      )
    }

    logger?.info(
      'flow.snapshotFromCurrentContext',
      'Snapshot from current context',
      {
        tabId,
        mode: tab.mode,
        taskId: tab.taskId,
        attemptId: tab.activeAttemptId ?? null,
      },
    )

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
        parentMoveIndex: snapshotInput.sourceMoveIndex,
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

    logger?.info(
      'flow.snapshotFromCurrentContext',
      'Snapshot created, new tab opened',
      {
        tabId,
        snapshotTaskId: snapshotTask.id,
        newTabId: newTab.id,
      },
    )

    return newTab
  }

  function updatePlayerConfig(
    tabId: string,
    patch: Partial<import('../types/tab').PlayerConfig>,
  ): void {
    const tab = getTab(tabId)
    const merged: import('../types/tab').PlayerConfig = {
      black: tab.playerConfig?.black ?? 'human',
      white: tab.playerConfig?.white ?? 'human',
      problemOpponent: tab.playerConfig?.problemOpponent,
      ai: tab.playerConfig?.ai,
      ...patch,
    }
    workbenchStore.updateTab(tabId, {playerConfig: merged})
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

    return {
      inboxTasks,
      incompleteAttempts,
      incompleteRecallSessions,
      recentBadMoveTasks,
    }
  }

  function setModeEffects(modeEffects?: WorkbenchModeEffects | null): void {
    activeModeEffects = modeEffects ?? undefined
  }

  return {
    submit,
    undoProblemMove,
    abandonProblem,
    enterAnalysis,
    returnFromAnalysis,
    enterRecall,
    showRecallHint,
    skipRecallMove,
    completeRecall,
    restartAttempt,
    startAttempt,
    submitCheckpointCorrection,
    revealCheckpointAi,
    skipCheckpoint,
    saveCheckpointComment,
    snapshotFromCurrentContext,
    updatePlayerConfig,
    loadDashboardData,
    setModeEffects,
  }
}
