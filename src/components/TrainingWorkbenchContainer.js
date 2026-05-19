import {h, Component} from 'preact'

import WorkbenchShell from './WorkbenchShell.js'
import {computeModeBarPolicy, getModeTransitionAction} from '../modules/training/workbench/workbenchUiPolicy.ts'
import {projectGobanProps} from '../modules/training/workbench/projectGobanProps.ts'
import {resolveBoardInteraction} from '../modules/workbench/board-interactions/resolveBoardInteraction.ts'

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
      const action = getModeTransitionAction(
        {
          currentMode: activeTab.mode,
          previousMode: activeTab.previousMode,
          activeAttemptId: activeTab.activeAttemptId,
          activeRecallSessionId: activeTab.activeRecallSessionId,
        },
        mode,
      )

      if (action === 'enterAnalysis') {
        flowService.enterAnalysis(activeTab.id)
      } else if (action === 'returnFromAnalysis') {
        flowService.returnFromAnalysis(activeTab.id, activeTab.previousMode || 'play')
      }
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

    // --- W3 Goban wiring: project boardProps from active tab state ---

    const workbenchMode = activeTab ? activeTab.mode : 'play'

    // Default settings matching test expectations
    const gobanSettings = {
      showMoveNumbers: false,
      showNextMoves: true,
      showSiblings: true,
      showAnalysis: false,
      showCoordinates: true,
      showHumanPreference: false,
      selectedTool: 'stone_1',
      editWorkspaceActive: false,
      boardTransformation: [1, 0, 0, 1, 0, 0],
      areaSelectMode: false,
    }

    const boardProps = projectGobanProps({
      workbenchMode,
      task: null,
      runtimeState: rt,
      boardState: {
        gameTree: null,
        treePosition: '',
        board: {width: 19, height: 19, signMap: []},
      },
      overlayState: {
        paintMap: [],
        markerMap: [],
        dimmedStones: [],
        analysis: null,
      },
      settings: gobanSettings,
      analysisData: null,
    })

    // Override the noop onVertexClick with a real handler that routes
    // through the resolver with workbench context.
    if (activeTab) {
      const tabRef = activeTab
      boardProps.handlerProps.onVertexClick = function onVertexClick(vertex, event) {
        resolveBoardInteraction({
          mode: 'play',
          selectedTool: gobanSettings.selectedTool,
          event: {
            button: event.button,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            isMac: event.isMac || false,
          },
          point: {sign: 0, markerType: null},
          vertex,
          positionSource: null,
          mutationContract: null,
          editWorkspacePresent: false,
          // W3 workbenchMode extension fields
          workbenchMode: tabRef.mode,
          tabId: tabRef.id,
          taskId: tabRef.taskId,
          playerConfig: tabRef.playerConfig || null,
          problemArea: null,
          activeAttemptId: tabRef.activeAttemptId,
          activeRecallSessionId: tabRef.activeRecallSessionId,
        })
      }
    }

    return h(WorkbenchShell, {
      ...shellProps,
      ...projected,
      ...workbenchProjected,
      ...legacyHandlers,
      ...shellHandlers,
      boardProps,
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

    result.modeBarPolicy = computeModeBarPolicy({
      currentMode: activeTab.mode,
      previousMode: activeTab.previousMode,
      activeAttemptId: activeTab.activeAttemptId,
      activeRecallSessionId: activeTab.activeRecallSessionId,
    })
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
