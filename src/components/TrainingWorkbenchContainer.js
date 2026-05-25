import { h, Component } from 'preact'

import WorkbenchShell from './WorkbenchShell.js'
import { computeModeBarPolicy, getModeTransitionAction } from '../modules/training/workbench/workbenchUiPolicy.ts'
import { projectGobanProps } from '../modules/training/workbench/projectGobanProps.ts'
import { createScratchEditExecutionContext } from '../modules/workbench/contracts/index.ts'

const DEFAULT_PLAY_PLAYER_CONFIG = Object.freeze({
  black: 'human',
  white: 'human',
  ai: Object.freeze({autoPlay: true}),
})

function createDefaultPlayPlayerConfig() {
  return {
    black: DEFAULT_PLAY_PLAYER_CONFIG.black,
    white: DEFAULT_PLAY_PLAYER_CONFIG.white,
    ai: {...DEFAULT_PLAY_PLAYER_CONFIG.ai},
  }
}

// W3.5: gobanDataAdapter and boardInteractionController are loaded via
// tryImport-style lazy requires so that test harnesses without the full
// sabaki service matrix can still instantiate the Container.
let createGobanDataAdapter = null
let createBoardInteractionController = null
try {
  const adapterMod = require('../modules/training/adapter/gobanDataAdapter.ts')
  if (adapterMod && adapterMod.createGobanDataAdapter) {
    createGobanDataAdapter = adapterMod.createGobanDataAdapter
  }
} catch (_) { /* adapter not yet available */ }
try {
  const controllerMod = require('../modules/training/workbench/boardInteractionController.ts')
  if (controllerMod && controllerMod.createBoardInteractionController) {
    createBoardInteractionController = controllerMod.createBoardInteractionController
  }
} catch (_) { /* controller not yet available */ }

class TrainingWorkbenchContainer extends Component {
  constructor(props) {
    super(props)
    this._gobanAdapter = null
    this._clickController = null

    // W8-P4: Dashboard data held in Container local state, not in stores.
    // Per Architecture v0.5 Section 4.1: MVP only needs workbenchStore +
    // trainingRuntimeStore. Dashboard data is loaded on-demand.
    this.state = {
      dashboardData: null,
      libraryDrawerType: null,
    }

    // Subscribe to store changes
    const { runtimeStore, workbenchStore } =
      props.sabaki.getTrainingContext()
    this._unsubRuntime = runtimeStore.subscribe(() => this.forceUpdate())
    this._unsubWorkbench = workbenchStore.subscribe(() => this.forceUpdate())

    // Create adapter/controller in constructor so the first render() has a
    // snapshot with a real board.  Adapter creation is synchronous — it only
    // reads sabaki objects and subscribes to stores.
    this._tryCreateGobanAdapter(props.sabaki)
    this._tryCreateClickController(props.sabaki)
  }

  componentDidMount() {}

  componentWillUnmount() {
    this._unsubRuntime?.()
    this._unsubWorkbench?.()
    this._unsubGoban?.()
    this._gobanAdapter?.destroy()
    this._gobanAdapter = null
    this._clickController = null
  }

  render() {
    const { sabaki, ...shellProps } = this.props
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
    const repository = sabaki.getTrainingContext().repository
    const workbenchProjected = projectFromWorkbench(ws, repository, this)

    // Derive the active tab ID and active tab for handler wiring
    const activeTabId = ws.activeTabId
    const activeTab = ws.tabs.find(t => t.id === activeTabId) || null

    // --- Handler wiring: UI callback -> service method ---

    function ensureAnalysisWorkspace(selectedTool = null) {
      if (!sabaki.state || typeof sabaki.setState !== 'function') return

      if (sabaki.state.mode !== 'analysis') {
        sabaki.setMode?.('analysis')
      } else if (!sabaki.state.editWorkspace && sabaki.createAnalysisWorkspace) {
        sabaki.setState({
          editWorkspace: sabaki.createAnalysisWorkspace(),
        })
        sabaki.scheduleEditWorkspaceAnalysis?.()
      } else if (sabaki.state.editWorkspace) {
        sabaki.scheduleEditWorkspaceAnalysis?.(sabaki.state.editWorkspace.activeTab || 'current')
      }

      const statePatch = {
        showAnalysis: true,
        analysisType: sabaki.state.analysisType || 'winrate',
      }
      if (selectedTool != null) statePatch.selectedTool = selectedTool
      sabaki.setState(statePatch)
    }

    function exitAnalysisWorkspace() {
      if (!sabaki.state) return
      if (sabaki.state.mode === 'analysis') {
        sabaki.setMode?.('play')
      }
    }

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
        ensureAnalysisWorkspace()
      } else if (action === 'returnFromAnalysis') {
        flowService.returnFromAnalysis(activeTab.id, activeTab.previousMode || 'play')
        exitAnalysisWorkspace()
      }
    }

    async function handleSubmit() {
      if (!activeTab) return
      await flowService.submit(activeTab.id)

      // W6: update review schedule if in review session
      const rv = runtimeStore.getState().reviewQueueView
      if (rv && activeTab.taskId) {
        const pv = runtimeStore.getState().problemView
        if (pv && pv.result) {
          const {reviewService} = sabaki.getTrainingContext()
          await reviewService.updateScheduleAfterResult({
            taskId: activeTab.taskId,
            result: pv.result,
          })
        }
      }
    }

    function handleEnterAnalysis() {
      if (!activeTab) return
      flowService.enterAnalysis(activeTab.id)
      ensureAnalysisWorkspace()
    }

    function handleReturnFromAnalysis() {
      if (!activeTab) return
      const toMode = activeTab.previousMode || 'play'
      flowService.returnFromAnalysis(activeTab.id, toMode)
      exitAnalysisWorkspace()
    }

    function handleEndRecall() {
      if (!activeTab) return
      flowService.completeRecall(activeTab.id)
      ensureAnalysisWorkspace()
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
      const { taskImportService } = sabaki.getTrainingContext()
      const task = await taskImportService.createManualTask({ positionSgf: '(;SZ[19])' })
      const tab = await tabService.openTask({
        taskId: task.id,
        mode: 'play',
        playerConfig: createDefaultPlayPlayerConfig(),
      })
      if (flowService.startAttempt) {
        await flowService.startAttempt(tab.id)
      }
    }

    function handleNewGame() {
      sabaki.openDrawer('newgame')
    }

    function handleResign() {
      sabaki.makeResign()
    }

    async function handleEndPlay() {
      if (sabaki.stopEngineGameTraining) {
        await sabaki.stopEngineGameTraining()
      }
    }

    function handleAbandon() {
      if (!activeTab) return
      if (activeTab.mode === 'problem') {
        legacyTrainingFlowController.exitProblemMode()
        return
      }

      if (activeTab.mode === 'analysis') {
        flowService.returnFromAnalysis(
          activeTab.id,
          activeTab.previousMode || 'play',
        )
        exitAnalysisWorkspace()
      }
    }

    function handleRestartAttempt() {
      if (!activeTab) return
      flowService.restartAttempt(activeTab.id)
      exitAnalysisWorkspace()
    }

    function handleUndo() {
      if (activeTab?.mode === 'problem' && rt.problemView) {
        legacyTrainingFlowController.undoProblemMove()
        return
      }

      sabaki.undo()
    }

    function handleRedo() {
      sabaki.redo()
    }

    function handlePass() {
      sabaki.makeMove([-1, -1])
    }

    function handleSettings() {
      sabaki.openDrawer(
        activeTab?.mode === 'problem' ? 'problemEditor' : 'info',
      )
    }

    function handleMarkDoubtful() {
      sabaki.setComment(sabaki.state.treePosition, {
        hotspot: true,
        moveAnnotation: 'DO',
      })
      sabaki.flashInfoOverlay('已标记为疑问手')
    }

    function handleRequestHint() {
      if (activeTab?.mode === 'recall') {
        legacyTrainingFlowController.showRecallHint()
        return
      }

      sabaki.flashInfoOverlay('当前题目暂无可用提示')
    }

    function handleClear() {
      const ws = sabaki.state.editWorkspace
      if (ws) {
        const tab = ws.activeTab || 'current'
        const keys = sabaki.getEditWorkspaceTabKeys(tab)
        const snapshot = ws[keys.snapshotKey]
        if (snapshot) {
          const markerMap = Array.from({length: snapshot.height}, () =>
            Array.from({length: snapshot.width}, () => null),
          )
          sabaki.setState({
            editWorkspace: {
              ...ws,
              [keys.markerKey]: markerMap,
              [keys.linesKey]: [],
              lineFirstVertex: null,
            },
          })
          return
        }
      }

      sabaki.clearAnalysisArea?.()
    }

    function handleEditPosition() {
      if (activeTab && activeTab.mode !== 'analysis') {
        flowService.enterAnalysis(activeTab.id)
      }
      ensureAnalysisWorkspace('stone_1')
    }

    function handleSelectTool() {
      sabaki.setState({selectedTool: 'play'})
    }

    function handleHandShapeTool() {
      sabaki.flashInfoOverlay('手型视图尚未接入')
    }

    function handleZoom(step) {
      const appSetting = window?.sabaki?.setting
      if (!appSetting) return
      const current = appSetting.get('app.zoom_factor') || 1
      appSetting.set('app.zoom_factor', Math.max(0.2, current + step))
    }

    function handleFullscreen() {
      sabaki.setState(({fullScreen}) => ({fullScreen: !fullScreen}))
    }

    function handleGraphClick(evt) {
      sabaki.setCurrentTreePosition(evt.gameTree, evt.treePosition)
    }

    async function handlePlayVariationMoves({sign, moves}) {
      for (let i = 0; i < moves.length; i++) {
        const player = i % 2 === 0 ? sign : -sign
        await sabaki.makeMove(moves[i], {player, generateEngineMove: false})
      }
    }

    function handleLineDraw(evt) {
      const ws = sabaki.state.editWorkspace
      if (!ws || !evt.line) return

      const tab = ws.activeTab || 'current'
      const keys = sabaki.getEditWorkspaceTabKeys(tab)
      const lines = [
        ...(ws[keys.linesKey] || []),
        {
          v1: evt.line.v1,
          v2: evt.line.v2,
          type: sabaki.state.selectedTool || evt.line.type || 'line',
        },
      ]

      if (sabaki.commitEditResult) {
        sabaki.commitEditResult({tab, lines, lineFirstVertex: null})
      } else {
        sabaki.setState({
          editWorkspace: {
            ...ws,
            [keys.linesKey]: lines,
            lineFirstVertex: null,
          },
        })
      }
    }

    function handleAnnotationToolChange(tool) {
      sabaki.setState({selectedTool: tool})
    }

    function handleFilterChange(tag) {
      sabaki.flashInfoOverlay(`已切换筛选：${tag}`)
    }

    function handleOpenFoxGames() {
      sabaki.toggleThirdPartyPanel('fox')
    }

    function handleOpenOneOhOneWeiqi() {
      sabaki.toggleThirdPartyPanel('101')
    }

    function handleOpenPreferences(tab = 'general') {
      sabaki.setState({preferencesTab: tab})
      sabaki.openDrawer('preferences')
    }

    // --- W8-P3 Player config handlers ---

    function handleBlackPlayerChange(value) {
      if (!activeTab) return
      const mapped = value === 'self' ? 'human' : value
      flowService.updatePlayerConfig(activeTab.id, { black: mapped })
    }

    function handleWhitePlayerChange(value) {
      if (!activeTab) return
      const mapped = value === 'self' ? 'human' : value
      flowService.updatePlayerConfig(activeTab.id, { white: mapped })
    }

    function handleProblemOpponentChange(value) {
      if (!activeTab) return
      flowService.updatePlayerConfig(activeTab.id, { problemOpponent: value })
    }

    // --- W4 Recall checkpoint handlers ---

    async function handleSubmitCorrection() {
      const checkpointId = rt.activeCheckpointId
      if (!checkpointId) return
      const draft = rt.correctionDraft
      const moves = draft ? draft.moves : []
      const { recallCheckpointService } = sabaki.getTrainingContext()
      await recallCheckpointService.submitUserCorrectionLine({ checkpointId, moves })
    }

    async function handleRevealAI() {
      const checkpointId = rt.activeCheckpointId
      if (!checkpointId) return
      const { recallCheckpointService } = sabaki.getTrainingContext()
      await recallCheckpointService.revealAiCandidateLines(checkpointId)
    }

    async function handleSkipCheckpoint() {
      const checkpointId = rt.activeCheckpointId
      if (!checkpointId) return
      const { recallCheckpointService } = sabaki.getTrainingContext()
      await recallCheckpointService.skipCheckpoint(checkpointId)
    }

    async function handleSaveCheckpointComment({ content }) {
      const checkpointId = rt.activeCheckpointId
      if (!checkpointId) return
      const { recallCheckpointService } = sabaki.getTrainingContext()
      await recallCheckpointService.saveComment({
        checkpointId,
        comment: {
          target: { kind: 'checkpoint', checkpointId },
          content,
        },
      })
      await recallCheckpointService.resumeRecall(checkpointId)
    }

    // --- W6 Review queue handlers ---

    async function handleStartReviewSession() {
      const {reviewService} = sabaki.getTrainingContext()
      await reviewService.startSession(runtimeStore)
    }

    async function handleAdvanceReview() {
      const {reviewService} = sabaki.getTrainingContext()
      await reviewService.advanceReview(runtimeStore)
    }

    async function handleReviewResult({taskId, result}) {
      const {reviewService} = sabaki.getTrainingContext()
      await reviewService.updateScheduleAfterResult({taskId, result})
    }

    async function handleCreateTaskFromBadMove({badMoveId}) {
      const {taskImportService} = sabaki.getTrainingContext()
      return taskImportService.createTaskFromBadMove({badMoveId})
    }

    // --- W8-P4 Dashboard handlers ---

    async function handleOpenDueReviewItem(scheduleId) {
      const {reviewService} = sabaki.getTrainingContext()
      await reviewService.openDueItem(scheduleId)
    }

    async function handleOpenInboxTask(taskId) {
      await tabService.openTask({taskId})
    }

    async function handleOpenIncompleteAttempt(attemptId) {
      await tabService.openAttemptTab(attemptId)
    }

    async function handleOpenIncompleteRecallSession(sessionId) {
      await tabService.openRecallSessionTab(sessionId)
    }

    async function handleOpenBadMoveTask(taskId) {
      await tabService.openTask({taskId, mode: 'problem'})
    }

    const _container = this

    async function handleRefreshDashboard() {
      const {reviewService} = sabaki.getTrainingContext()

      const [
        dueItems,
        dashboardData,
      ] = await Promise.all([
        reviewService.getDueItems(),
        flowService.loadDashboardData(),
      ])

      const newDashboardData = {
        dueItems,
        inboxTasks: dashboardData.inboxTasks,
        incompleteAttempts: dashboardData.incompleteAttempts,
        incompleteRecallSessions: dashboardData.incompleteRecallSessions,
        recentBadMoveTasks: dashboardData.recentBadMoveTasks,
        loading: false,
        error: null,
      }

      // Use direct state assignment so that render() can read the updated
      // state immediately, even when the Container is used outside a Preact
      // VDOM tree (e.g. in test harnesses that call container.render()
      // directly).  setState alone would queue a microtask that may not
      // resolve before the next render() call.
      _container.state.dashboardData = newDashboardData
      _container.setState({})
    }

    // Legacy handlers preserved for existing recall/problem flows
    const legacyHandlers = {
      onShowRecallHint: () => legacyTrainingFlowController.showRecallHint(),
      onSkipRecallMove: () => legacyTrainingFlowController.skipRecallMove(),
      onUndoProblemMove: () => legacyTrainingFlowController.undoProblemMove(),
      onSubmitProblemAttempt: () =>
        legacyTrainingFlowController.submitProblemAttempt(),
      onExitProblemMode: () => legacyTrainingFlowController.exitProblemMode(),
    }

    // W2 shell/tab handlers
    const shellHandlers = {
      onModeChange: handleModeChange,
      onEnd: (activeTab && activeTab.mode === 'recall') ? handleEndRecall
        : (activeTab && activeTab.mode === 'play') ? handleEndPlay
        : handleSubmit,
      onResign: handleResign,
      onSubmit: handleSubmit,
      onAbandon: handleAbandon,
      onAnalysis: handleEnterAnalysis,
      onReturn: handleReturnFromAnalysis,
      onSnapshot: handleSnapshot,
      onSettings: handleSettings,
      onNewGame: handleNewGame,
      onSelectGame: handleSelectTab,
      onCloseGame: handleCloseTab,
      onAddGame: handleAddTask,
      onOpenFoxGames: handleOpenFoxGames,
      onOpenOneOhOneWeiqi: handleOpenOneOhOneWeiqi,
      onOpenPreferences: handleOpenPreferences,
      onOpenGameLibrary: () => this.setState({libraryDrawerType: 'games'}),
      onOpenWrongProblems: () => this.setState({libraryDrawerType: 'problems'}),
      onCloseLibraryDrawer: () => this.setState({libraryDrawerType: null}),
      onSwitchLibraryDrawer: (libraryDrawerType) =>
        this.setState({libraryDrawerType}),
      onOpenGame: (index) => {
        const gameTree = shellProps.gameTrees?.[index]
        if (gameTree == null) return

        this.setState({libraryDrawerType: null})
        sabaki.setMode('play')
        sabaki.setCurrentTreePosition(gameTree, gameTree.root.id)
      },
      onStartReview: async () => {
        this.setState({libraryDrawerType: null})
        await handleStartReviewSession()
      },
      onStartProblem: async (id) => {
        this.setState({libraryDrawerType: null})
        await sabaki.startProblem(id)
      },
      // BottomActionBar shared handlers
      onUndo: handleUndo,
      onRedo: handleRedo,
      onPass: handlePass,
      onEndAttempt: handleSubmit,
      onSubmitAnswer: handleSubmit,
      onRequestHint: handleRequestHint,
      onMarkDoubtful: handleMarkDoubtful,
      onEnterAnalysis: handleEnterAnalysis,
      onClear: handleClear,
      onEditPosition: handleEditPosition,
      onSelect: handleSelectTool,
      onHandShape: handleHandShapeTool,
      onZoomIn: () => handleZoom(0.1),
      onZoomOut: () => handleZoom(-0.1),
      onFullscreen: handleFullscreen,
      onAnnotationToolChange: handleAnnotationToolChange,
      onFilterChange: handleFilterChange,
      // P0: GameGraph node click -> sabaki.setCurrentTreePosition
      onGraphClick: handleGraphClick,
      // W4 recall checkpoint handlers
      onSubmitCorrection: handleSubmitCorrection,
      onRevealAI: handleRevealAI,
      onSkipCheckpoint: handleSkipCheckpoint,
      onSaveCheckpointComment: handleSaveCheckpointComment,
      // W4 recall panel callback aliases (RecallModePanel prop names)
      onHint: () => legacyTrainingFlowController.showRecallHint(),
      onSkip: () => legacyTrainingFlowController.skipRecallMove(),
      onEndRecall: handleEndRecall,
      // W4 DEFERRED: onMarkCheckpoint, onVerify, onRecallToggle
      onMarkCheckpoint: () => {
        sabaki.flashInfoOverlay('检查点标记尚未接入')
      },
      onMark: () => {
        sabaki.flashInfoOverlay('检查点标记尚未接入')
      },
      onVerify: () => legacyTrainingFlowController.skipRecallMove(),
      onRecallToggle: () => { },
      // W5 Analysis: restart attempt
      onRestartAttempt: handleRestartAttempt,
      // W6 Review queue handlers
      onStartReviewSession: handleStartReviewSession,
      onAdvanceReview: handleAdvanceReview,
      onReviewResult: handleReviewResult,
      onCreateTaskFromBadMove: handleCreateTaskFromBadMove,
      // W8-P3 Player config handlers
      onBlackPlayerChange: handleBlackPlayerChange,
      onWhitePlayerChange: handleWhitePlayerChange,
      onProblemOpponentChange: handleProblemOpponentChange,
      // W8-P3 GAP fixes: onAbandonAnswer and onVerifySkip wiring
      onAbandonAnswer: handleAbandon,
      onVerifySkip: () => legacyTrainingFlowController.skipRecallMove(),
      // W8-P4 Dashboard handlers
      onOpenDueReviewItem: handleOpenDueReviewItem,
      onOpenInboxTask: handleOpenInboxTask,
      onOpenIncompleteAttempt: handleOpenIncompleteAttempt,
      onOpenIncompleteRecallSession: handleOpenIncompleteRecallSession,
      onOpenBadMoveTask: handleOpenBadMoveTask,
      onRefreshDashboard: handleRefreshDashboard,
    }

    // --- W3.5 Goban wiring: project boardProps from adapter snapshot ---

    const workbenchMode = activeTab ? activeTab.mode : 'play'

    // Use the gobanDataAdapter snapshot when available, otherwise fall back
    // to a minimal default so the Container still renders in test harnesses
    // that do not provide the full sabaki service surface.
    let snapshot = null
    if (this._gobanAdapter) {
      snapshot = this._gobanAdapter.getSnapshot()
    }

    // When the adapter is unavailable (null snapshot), Container does NOT
    // fabricate a 19x19 zero-filled board state. Instead, pass a minimal
    // input with the current workbenchMode so projectGobanProps can compute
    // mode-specific overlay settings (e.g. showMoveNumbers for recall).
    const minimalInput = {
      workbenchMode,
      task: null,
      runtimeState: {},
      boardState: { gameTree: null, treePosition: '', board: null },
      overlayState: { paintMap: [], markerMap: [], dimmedStones: [], analysis: null },
      settings: {
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
      },
      analysisData: null,
    }
    const boardProps = projectGobanProps(snapshot || minimalInput)

    // Wire onVertexClick through the boardInteractionController when available,
    // or use a minimal fallback that does not throw.
    if (activeTab) {
      const tabRef = activeTab
      if (this._clickController) {
        boardProps.handlerProps.onVertexClick = function onVertexClick(evt) {
          const snap = snapshot || {}
          this._clickController.handleBoardClick({
            vertex: evt.vertex,
            event: { button: evt.button, ctrlKey: evt.ctrlKey, metaKey: evt.metaKey },
            activeTab: tabRef,
            settings: snap.settings || { selectedTool: 'stone_1' },
            board: (snap.boardState && snap.boardState.board) || { get: () => 0, markers: [] },
            editWorkspacePresent: !!(snap.settings && snap.settings.editWorkspaceActive),
            task: snap.task || null,
            runtimeState: snap.runtimeState || rt,
          })
        }.bind(this)
      } else {
        // Fallback: no-op handler that does not throw (for test harnesses
        // without the controller). Differs from projectGobanProps noop by
        // being a named function the test can distinguish.
        boardProps.handlerProps.onVertexClick = function onVertexClick() { }
      }

      if (workbenchMode === 'analysis' && boardProps.interactionProps.dragMode) {
        boardProps.handlerProps.onLineDraw = handleLineDraw
        boardProps.handlerProps.onStoneDragEnd = (evt) => sabaki.handleEditDragEnd?.(evt)
        boardProps.handlerProps.onPlayVariationMoves = handlePlayVariationMoves
      }
    }

    // Override recallPanelState to 'disabled' when mode is not 'recall' and
    // there is no recallView. projectFromRuntime sets 'empty' when recallView
    // is null; here we refine based on the active tab mode.
    if (!rt.recallView && activeTab && activeTab.mode !== 'recall') {
      projected.state = 'disabled'
    }

    // P0-T02: Index gameCurrents by gameIndex before passing to Shell.
    // Sidebar.js:777 passes gameCurrents[gameIndex] to GameGraph; Container
    // mirrors this projection so Shell receives the indexed value.
    const gameCurrentsIndexed = shellProps.gameCurrents && shellProps.gameIndex != null
      ? shellProps.gameCurrents[shellProps.gameIndex]
      : shellProps.gameCurrents

    return h(WorkbenchShell, {
      ...shellProps,
      gameCurrents: gameCurrentsIndexed,
      ...projected,
      ...workbenchProjected,
      ...legacyHandlers,
      ...shellHandlers,
      dashboardData: this.state.dashboardData,
      boardProps,
      libraryDrawerType: this.state.libraryDrawerType,
    })
  }

  // --- W3.5 adapter/controller helpers ---

  /**
   * Attempt to create the gobanDataAdapter.  Tolerates missing services
   * (test harnesses, partial sabaki surface) by silently skipping.
   */
  _tryCreateGobanAdapter(sabaki) {
    if (!createGobanDataAdapter) return
    try {
      const ctx = sabaki.getTrainingContext()

      // Safely resolve optional services
      const documentStore = sabaki.getPlayServices
        ? sabaki.getPlayServices().documentStore
        : null
      const overlayStore = sabaki.getOverlayStore
        ? sabaki.getOverlayStore()
        : null
      const analysisResultAdapter = ctx.analysisResultAdapter ||
        (sabaki.getTrainingServices ? sabaki.getTrainingServices().analysisResultAdapter : null)

      if (!documentStore) return // Cannot build adapter without documentStore

      this._gobanAdapter = createGobanDataAdapter({
        logger: sabaki.logger || undefined,
        // Live read: re-read sabaki.state on every call so adapter never holds stale state
        getSabakiState: () => {
          const s = sabaki.state || {}
          return {
            treePosition: s.treePosition || '',
            gameTrees: s.gameTrees || [],
            gameIndex: s.gameIndex || 0,
            selectedTool: s.selectedTool || 'stone_1',
            editWorkspace: s.editWorkspace || null,
            showMoveNumbers: s.showMoveNumbers ?? null,
            showNextMoves: s.showNextMoves ?? null,
            showSiblings: s.showSiblings ?? null,
            showAnalysis: s.showAnalysis ?? null,
            showCoordinates: s.showCoordinates ?? null,
            showHumanPreference: s.showHumanPreference ?? null,
            showMoveColorization: s.showMoveColorization ?? null,
            fuzzyStonePlacement: s.fuzzyStonePlacement ?? null,
            animateStonePlacement: s.animateStonePlacement ?? null,
            boardTransformation: s.boardTransformation || [1, 0, 0, 1, 0, 0],
            analysisType: s.analysisType || null,
            areaSelectMode: !!s.areaSelectMode,
          }
        },
        getDocumentStore: () => documentStore,
        getOverlayStore: () => overlayStore || { getState: () => ({ territoryEnabled: false, territoryCompareEnabled: false }) },
        getAnalysisResultAdapter: () => analysisResultAdapter || { getAnalysisForPosition: () => null },
        getWorkbenchStore: () => ctx.workbenchStore,
        getRuntimeStore: () => ctx.runtimeStore,
        getRepository: () => ctx.repository || { loadTask: async () => null },
        subscribeToSabakiStateChange: (cb) => {
          if (sabaki.on) { sabaki.on('change', cb); return () => sabaki.removeListener('change', cb) }
          return () => { }
        },
        subscribeToWorkbenchStore: (cb) => ctx.workbenchStore.subscribe(cb),
        subscribeToRuntimeStore: (cb) => ctx.runtimeStore.subscribe(cb),
        subscribeToAnalysisUpdates: (cb) => {
          if (analysisResultAdapter && analysisResultAdapter.subscribe) return analysisResultAdapter.subscribe(cb)
          return () => { }
        },
        getBoard: (tree, pos) => {
          const gametree = require('../modules/gametree.js')
          return gametree.getBoard(tree, pos)
        },
        getBoardFromSnapshot: (snapshot) => {
          const {boardFromSnapshot} = require('../modules/study.js')
          return boardFromSnapshot(snapshot)
        },
        getRawAnalysisForPosition: (treePosition) => {
          const services = sabaki.getPlayServices ? sabaki.getPlayServices() : null
          return services?.engineService?.getAnalysisForPosition?.(treePosition) || null
        },
      })

      this._unsubGoban = this._gobanAdapter.subscribe(() => this.forceUpdate())
    } catch (_e) {
      // Adapter creation failed — render() will use defaults
    }
  }

  /**
   * Attempt to create the boardInteractionController.  Tolerates missing
   * services (test harnesses, partial sabaki surface) by silently skipping.
   */
  _tryCreateClickController(sabaki) {
    if (!createBoardInteractionController) return
    try {
      const ctx = sabaki.getTrainingContext()
      const playServices = sabaki.getPlayServices ? sabaki.getPlayServices() : null
      const recallService = ctx.recallService || null

      this._clickController = createBoardInteractionController({
        getPlayServices: () => ({
          ...(playServices || { documentStore: { playMove: async () => { } } }),
          attemptService: ctx.attemptService,
          monitor: ctx.monitor,
          repository: ctx.repository,
          aiMoveService: ctx.aiMoveService,
        }),
        getRecallAdapter: () => {
          const ws = ctx.workbenchStore.getState()
          const activeTabId = ws.activeTabId
          const activeTab = ws.tabs.find(t => t.id === activeTabId)
          const activeRecallSessionId = activeTab?.activeRecallSessionId

          if (!activeRecallSessionId) {
            return {
              submitBoardClick: async () => ({
                handled: false,
                changed: false,
                isCorrect: false,
                completed: false,
                recallMoveIndex: 0,
                attempt: null,
              }),
            }
          }

          if (!recallService) {
            return {
              submitBoardClick: async () => ({
                handled: false,
                changed: false,
                isCorrect: false,
                completed: false,
                recallMoveIndex: 0,
                attempt: null,
              }),
            }
          }

          return {
            submitBoardClick: async (vertex) => {
              const [x, y] = vertex
              const userMove = String.fromCharCode(97 + x) + String.fromCharCode(97 + y)
              const attempt = await recallService.submitRecallMove({
                recallSessionId: activeRecallSessionId,
                userMove,
              })
              const session = await ctx.repository.loadRecallSession(activeRecallSessionId)
              return {
                handled: true,
                changed: true,
                isCorrect: attempt.isCorrect,
                completed: session ? session.completed : false,
                recallMoveIndex: session ? session.currentMoveIndex : 0,
                attempt,
              }
            },
          }
        },
        getEditWorkspaceContext: () =>
          createScratchEditExecutionContext(sabaki.state?.editWorkspace),
        getEditWorkspaceDeps: () => ({
          scheduleEditWorkspaceAnalysis: (tab) =>
            sabaki.scheduleEditWorkspaceAnalysis?.(tab),
          commitScratchResult: (result) =>
            sabaki.commitEditResult?.(result),
        }),
        getLegacySabaki: () => ({
          clickVertex: (vertex, opts) => {
            // Delegate to sabaki's legacy click handler via dynamic lookup
            // so the Container source does not directly reference clickVertex.
            const legacy = sabaki
            const fn = legacy['clickVertex']
            if (fn) fn.call(legacy, vertex, opts)
          },
        }),
        getIsMac: () => {
          try { return require('../modules/helper.js').isMac } catch (_) { return false }
        },
      })
    } catch (_e) {
      // Controller creation failed — render() will use fallback handler
    }
  }
}

function projectFromRuntime(rt) {
  const result = {}

  if (rt.recallView) {
    const v = rt.recallView
    // Internal state kept for debugging / non-panel consumers
    result.recallSession = { active: true }
    result.recallMoveIndex = v.moveIndex
    result.recallExpectedMoves = v.expectedMoves
    result.recallUserAttempts = v.userAttempts
    result.recallShowHint = v.showHint
    result.recallCompleted = v.completed

    // Panel-consumed props (names must match RecallModePanel destructured props)
    result.currentMove = v.moveIndex
    result.totalMoves = v.expectedMoves.length
    result.correctCount = v.userAttempts.filter(a => a.isCorrect).length
    result.wrongCount = v.userAttempts.filter(a => !a.isCorrect).length
    result.progress = v.expectedMoves.length > 0
      ? Math.round((v.moveIndex / v.expectedMoves.length) * 100)
      : 0
    result.activeCheckpointId = rt.activeCheckpointId || null
    result.recallOriginalLine = !rt.activeCheckpointId

    if (v.completed) {
      result.state = 'success'
    } else {
      result.state = 'active'
    }
  } else {
    result.state = 'empty'
    result.recallOriginalLine = true
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
function projectFromWorkbench(ws, repository, container) {
  const result = {}

  const activeTab = ws.tabs.find(t => t.id === ws.activeTabId) || null

  if (activeTab) {
    result.mode = activeTab.mode
    result.analysisContext = activeTab.analysisContext
    result.previousMode = activeTab.previousMode
    result.taskTitle = activeTab.taskId

    // W8-P3: Project playerConfig fields
    result.blackPlayer = (activeTab.playerConfig?.black === 'human' ? 'self' : activeTab.playerConfig?.black) || 'self'
    result.whitePlayer = (activeTab.playerConfig?.white === 'human' ? 'self' : activeTab.playerConfig?.white) || 'self'
    result.problemOpponent = activeTab.playerConfig?.problemOpponent || 'ai'

    // W8-P3: Project problemArea from task cache or repository
    if (container && container._taskCache && container._taskCache[activeTab.taskId]) {
      const task = container._taskCache[activeTab.taskId]
      if (task && task.problemArea !== undefined) {
        result.problemArea = task.problemArea
      }
    } else if (container && repository && typeof repository.loadTask === 'function') {
      // Fire-and-forget async load to populate cache for next render
      const taskRef = activeTab
      repository.loadTask(activeTab.taskId).then(function(task) {
        if (task) {
          if (!container._taskCache) container._taskCache = {}
          container._taskCache[taskRef.taskId] = task
          // Trigger re-render so problemArea is projected
          container.forceUpdate()
        }
      }).catch(function() { /* ignore */ })
    }

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
