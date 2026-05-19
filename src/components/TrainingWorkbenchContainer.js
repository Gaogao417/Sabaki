import {h, Component} from 'preact'

import WorkbenchShell from './WorkbenchShell.js'

class TrainingWorkbenchContainer extends Component {
  componentDidMount() {
    const {runtimeStore, workbenchStore} =
      this.props.sabaki.getTrainingContext()

    this._unsubRuntime = runtimeStore.subscribe(() => this.forceUpdate())
    this._unsubWorkbench = workbenchStore.subscribe(() => this.forceUpdate())
  }

  componentWillUnmount() {
    this._unsubRuntime?.()
    this._unsubWorkbench?.()
  }

  render() {
    const {sabaki, ...shellProps} = this.props
    const {
      runtimeStore,
      workbenchStore,
      legacyTrainingFlowController,
      flowService,
      tabService,
    } = sabaki.getTrainingContext()
    const rt = runtimeStore.getState()
    const ws = workbenchStore.getState()

    // Project runtimeStore view models into legacy prop shapes
    // that WorkbenchShell/RecallBar/ProblemBar expect.
    const projected = projectFromRuntime(rt)

    // Project workbench store state into UI props
    const workbenchProjected = projectFromWorkbench(ws)

    // Derive the active tab ID and active tab for handler wiring
    const activeTabId = ws.activeTabId
    const activeTab = ws.tabs.find(t => t.id === activeTabId) || null

    // --- Handler wiring: UI callback -> service method ---

    function handleModeChange(mode) {
      if (!activeTab) return
      const currentMode = activeTab.mode

      // Use existing flowService methods for known transitions
      if (mode === 'analysis') {
        flowService.enterAnalysis(activeTab.id)
      } else if (mode === currentMode) {
        // No-op: already in requested mode
      } else if (currentMode === 'analysis' && activeTab.previousMode === mode) {
        flowService.returnFromAnalysis(activeTab.id, mode)
      }
      // Other free switches (GAP-03) not supported yet
    }

    function handleSubmit() {
      if (!activeTab) return
      flowService.submit(activeTab.id)
    }

    function handleEnterAnalysis() {
      if (!activeTab) return
      flowService.enterAnalysis(activeTab.id)
    }

    function handleReturnFromAnalysis() {
      if (!activeTab) return
      const toMode = activeTab.previousMode || 'play'
      flowService.returnFromAnalysis(activeTab.id, toMode)
    }

    function handleEndRecall() {
      if (!activeTab) return
      flowService.completeRecall(activeTab.id)
    }

    async function handleSnapshot() {
      if (!activeTab) return
      await flowService.snapshotFromCurrentContext(activeTab.id)
    }

    function handleSelectTab(index) {
      const tabId = ws.tabs[index]?.id
      if (tabId) tabService.switchTab(tabId)
    }

    function handleCloseTab(index) {
      const tabId = ws.tabs[index]?.id
      if (tabId) tabService.closeTab(tabId)
    }

    async function handleAddTask() {
      const {taskImportService} = sabaki.getTrainingContext()
      const task = await taskImportService.createManualTask({rootPositionSgf: ''})
      await tabService.openTask({taskId: task.id, mode: 'play'})
    }

    async function handleNewGame() {
      // Same as handleAddTask: create manual play task -> open tab
      await handleAddTask()
    }

    function handleResign() {
      // GAP-01: No dedicated resign method on flowService yet.
      if (!activeTab) return
      console.warn('W2 GAP-01: resign not yet implemented on flowService')
    }

    function handleAbandon() {
      // GAP-02: No dedicated abandon method on flowService yet.
      if (!activeTab) return
      console.warn('W2 GAP-02: abandon not yet implemented on flowService')
    }

    // Legacy handlers preserved for existing recall/problem/review flows
    const legacyHandlers = {
      onShowRecallHint: () => legacyTrainingFlowController.showRecallHint(),
      onSkipRecallMove: () => legacyTrainingFlowController.skipRecallMove(),
      onUndoProblemMove: () => legacyTrainingFlowController.undoProblemMove(),
      onSubmitProblemAttempt: () =>
        legacyTrainingFlowController.submitProblemAttempt(),
      onExitProblemMode: () => legacyTrainingFlowController.exitProblemMode(),
      onAdvanceReview: () => legacyTrainingFlowController.advanceReview(),
    }

    // W2 shell/tab handlers
    const shellHandlers = {
      onModeChange: handleModeChange,
      onEnd: (activeTab && activeTab.mode === 'recall') ? handleEndRecall : handleSubmit,
      onResign: handleResign,
      onSubmit: handleSubmit,
      onAbandon: handleAbandon,
      onAnalysis: handleEnterAnalysis,
      onReturn: handleReturnFromAnalysis,
      onSnapshot: handleSnapshot,
      onNewGame: handleNewGame,
      onSelectGame: handleSelectTab,
      onCloseGame: handleCloseTab,
      onAddGame: handleAddTask,
      // BottomActionBar shared handlers
      onEndAttempt: handleSubmit,
      onSubmitAnswer: handleSubmit,
      onEnterAnalysis: handleEnterAnalysis,
    }

    return h(WorkbenchShell, {
      ...shellProps,
      ...projected,
      ...workbenchProjected,
      ...legacyHandlers,
      ...shellHandlers,
    })
  }
}

function projectFromRuntime(rt) {
  const result = {}

  if (rt.recallView) {
    const v = rt.recallView
    result.recallSession = {active: true}
    result.recallMoveIndex = v.moveIndex
    result.recallExpectedMoves = v.expectedMoves
    result.recallUserAttempts = v.userAttempts
    result.recallShowHint = v.showHint
    result.recallCompleted = v.completed
  }

  if (rt.problemView) {
    const v = rt.problemView
    result.problemSession = v.legacyProblemSession
    result.problemAttempt = {
      userLine: v.evalCache.map((e) => e.move),
      moveEvaluations: v.evalCache,
    }
    result.problemEvalCache = v.evalCache
    result.problemBadMoves = v.badMoves
    result.problemSubmitted = v.submitted
    result.problemResult = v.result
  }

  if (rt.reviewQueueView) {
    const v = rt.reviewQueueView
    result.reviewQueue = v.queue
    result.reviewCurrentIndex = v.currentIndex
    result.reviewTotalDue = v.totalDue
  }

  return result
}

/**
 * Project workbenchStore state into WorkbenchShell props.
 * Maps tabs to games array, derives mode and activeIndex.
 */
function projectFromWorkbench(ws) {
  const result = {}

  const activeTab = ws.tabs.find(t => t.id === ws.activeTabId) || null

  if (activeTab) {
    result.mode = activeTab.mode
    result.taskTitle = activeTab.taskId
  }

  if (ws.tabs.length > 0) {
    result.games = ws.tabs.map((tab, index) => ({
      index,
      title: tab.taskId,
      active: tab.id === ws.activeTabId,
    }))
    result.activeIndex = ws.tabs.findIndex(t => t.id === ws.activeTabId)
  }

  return result
}

export default TrainingWorkbenchContainer
