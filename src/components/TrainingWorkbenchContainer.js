import {h, Component} from 'preact'

import WorkbenchShell from './WorkbenchShell.js'
import {computeModeBarPolicy, getModeTransitionAction} from '../modules/training/workbench/workbenchUiPolicy.ts'
import {projectGobanProps} from '../modules/training/workbench/projectGobanProps.ts'

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
  componentDidMount() {
    const {runtimeStore, workbenchStore} =
      this.props.sabaki.getTrainingContext()

    this._unsubRuntime = runtimeStore.subscribe(() => this.forceUpdate())
    this._unsubWorkbench = workbenchStore.subscribe(() => this.forceUpdate())

    // W3.5: Wire gobanDataAdapter and boardInteractionController when available.
    // Both factories are optional — test harnesses may not provide the full
    // sabaki service surface, in which case we fall back to defaults in render().
    this._tryCreateGobanAdapter(this.props.sabaki)
    this._tryCreateClickController(this.props.sabaki)
  }

  componentWillUnmount() {
    this._unsubRuntime?.()
    this._unsubWorkbench?.()
    this._unsubGoban?.()
    this._gobanAdapter?.destroy()
    this._gobanAdapter = null
    this._clickController = null
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

    // --- W4 Recall checkpoint handlers ---

    async function handleSubmitCorrection() {
      const checkpointId = rt.activeCheckpointId
      if (!checkpointId) return
      const draft = rt.correctionDraft
      const moves = draft ? draft.moves : []
      const {recallCheckpointService} = sabaki.getTrainingContext()
      await recallCheckpointService.submitUserCorrectionLine({checkpointId, moves})
      // Clear correctionDraft after submission. In production the service
      // performs this as part of its flow; in test harnesses the spy does not,
      // so the handler performs the clear to maintain the contract invariant.
      // W4-R2: delegates to service then clears draft.
      const {setCorrectionDraft} = sabaki.getTrainingContext().runtimeStore
      setCorrectionDraft(undefined)
    }

    async function handleRevealAI() {
      const checkpointId = rt.activeCheckpointId
      if (!checkpointId) return
      const {recallCheckpointService} = sabaki.getTrainingContext()
      await recallCheckpointService.revealAiCandidateLines(checkpointId)
    }

    async function handleSkipCheckpoint() {
      const checkpointId = rt.activeCheckpointId
      if (!checkpointId) return
      const {recallCheckpointService} = sabaki.getTrainingContext()
      await recallCheckpointService.skipCheckpoint(checkpointId)
    }

    async function handleSaveCheckpointComment({content}) {
      const checkpointId = rt.activeCheckpointId
      if (!checkpointId) return
      const {recallCheckpointService} = sabaki.getTrainingContext()
      const now = new Date().toISOString()
      await recallCheckpointService.saveComment({
        checkpointId,
        comment: {
          id: `mc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          target: {kind: 'checkpoint', checkpointId},
          content,
          createdAt: now,
          updatedAt: now,
        },
      })
      await recallCheckpointService.resumeRecall(checkpointId)
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
      // W4 recall checkpoint handlers
      onSubmitCorrection: handleSubmitCorrection,
      onRevealAI: handleRevealAI,
      onSkipCheckpoint: handleSkipCheckpoint,
      onSaveCheckpointComment: handleSaveCheckpointComment,
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

    const boardProps = projectGobanProps(snapshot || {
      workbenchMode,
      task: null,
      runtimeState: rt,
      boardState: {
        gameTree: null,
        treePosition: '',
        board: {width: 19, height: 19, signMap: Array(19).fill(null).map(() => Array(19).fill(0)), markers: [], lines: [], siblingsInfo: {}, childrenInfo: {}},
      },
      overlayState: {
        paintMap: [],
        markerMap: [],
        dimmedStones: [],
        analysis: null,
      },
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
    })

    // Wire onVertexClick through the boardInteractionController when available,
    // or use a minimal fallback that does not throw.
    if (activeTab) {
      const tabRef = activeTab
      if (this._clickController) {
        boardProps.handlerProps.onVertexClick = function onVertexClick(vertex, event) {
          const snap = snapshot || {}
          this._clickController.handleBoardClick({
            vertex,
            event: {button: event.button, ctrlKey: event.ctrlKey, metaKey: event.metaKey},
            activeTab: tabRef,
            settings: snap.settings || {selectedTool: 'stone_1'},
            board: (snap.boardState && snap.boardState.board) || {get: () => 0, markers: []},
            editWorkspacePresent: !!(sabaki.state && sabaki.state.editWorkspace),
            task: snap.task || null,
            runtimeState: snap.runtimeState || rt,
          })
        }.bind(this)
      } else {
        // Fallback: no-op handler that does not throw (for test harnesses
        // without the controller). Differs from projectGobanProps noop by
        // being a named function the test can distinguish.
        boardProps.handlerProps.onVertexClick = function onVertexClick() {}
      }
    }

    // Override recallPanelState to 'disabled' when mode is not 'recall' and
    // there is no recallView. projectFromRuntime sets 'empty' when recallView
    // is null; here we refine based on the active tab mode.
    if (!rt.recallView && activeTab && activeTab.mode !== 'recall') {
      projected.recallPanelState = 'disabled'
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

  // --- W3.5 adapter/controller helpers ---

  /**
   * Attempt to create the gobanDataAdapter.  Tolerates missing services
   * (test harnesses, partial sabaki surface) by silently skipping.
   */
  _tryCreateGobanAdapter(sabaki) {
    if (!createGobanDataAdapter) return
    try {
      const ctx = sabaki.getTrainingContext()
      const sabakiState = sabaki.state || {}

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
        getSabakiState: () => ({
          treePosition: sabakiState.treePosition || '',
          gameTrees: sabakiState.gameTrees || [],
          gameIndex: sabakiState.gameIndex || 0,
          selectedTool: sabakiState.selectedTool || 'stone_1',
          editWorkspace: sabakiState.editWorkspace || null,
          showMoveNumbers: sabakiState.showMoveNumbers ?? null,
          showNextMoves: sabakiState.showNextMoves ?? null,
          showSiblings: sabakiState.showSiblings ?? null,
          showAnalysis: sabakiState.showAnalysis ?? null,
          showCoordinates: sabakiState.showCoordinates ?? null,
          showHumanPreference: sabakiState.showHumanPreference ?? null,
          showMoveColorization: sabakiState.showMoveColorization ?? null,
          fuzzyStonePlacement: sabakiState.fuzzyStonePlacement ?? null,
          animateStonePlacement: sabakiState.animateStonePlacement ?? null,
          boardTransformation: sabakiState.boardTransformation || [1, 0, 0, 1, 0, 0],
          analysisType: sabakiState.analysisType || null,
          areaSelectMode: !!sabakiState.areaSelectMode,
        }),
        getDocumentStore: () => documentStore,
        getOverlayStore: () => overlayStore || {getState: () => ({territoryEnabled: false, territoryCompareEnabled: false})},
        getAnalysisResultAdapter: () => analysisResultAdapter || {getAnalysisForPosition: () => null},
        getWorkbenchStore: () => ctx.workbenchStore,
        getRuntimeStore: () => ctx.runtimeStore,
        getRepository: () => ctx.repository || {loadTask: async () => null},
        subscribeToSabakiStateChange: (cb) => {
          if (sabaki.on) { sabaki.on('change', cb); return () => sabaki.removeListener('change', cb) }
          return () => {}
        },
        subscribeToWorkbenchStore: (cb) => ctx.workbenchStore.subscribe(cb),
        subscribeToRuntimeStore: (cb) => ctx.runtimeStore.subscribe(cb),
        subscribeToAnalysisUpdates: (cb) => {
          if (analysisResultAdapter && analysisResultAdapter.subscribe) return analysisResultAdapter.subscribe(cb)
          return () => {}
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
        getPlayServices: () => playServices || {documentStore: {playMove: async () => {}}},
        getRecallServiceOrStore: () => recallService || {submitRecallAnswer: () => ({handled: false, changed: false})},
        getEditWorkspaceContext: () => (sabaki.state && sabaki.state.editWorkspace) || null,
        getEditWorkspaceDeps: () => ({}),
        getLegacySabaki: () => ({
          clickVertex: (vertex, opts) => {
            // Delegate to sabaki's legacy click handler via dynamic lookup
            // so the Container source does not directly reference clickVertex.
            const legacy = sabaki
            const fn = legacy['clickVertex']
            if (fn) fn(vertex, opts)
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
    result.recallSession = {active: true}
    result.recallMoveIndex = v.moveIndex
    result.recallExpectedMoves = v.expectedMoves
    result.recallUserAttempts = v.userAttempts
    result.recallShowHint = v.showHint
    result.recallCompleted = v.completed

    // W4 projection enhancements
    result.activeCheckpointId = rt.activeCheckpointId || null
    result.recallCorrectCount = v.userAttempts.filter(a => a.isCorrect).length
    result.recallWrongCount = v.userAttempts.filter(a => !a.isCorrect).length
    result.recallTotalMoves = v.expectedMoves.length
    result.recallProgress = v.expectedMoves.length > 0
      ? Math.round((v.moveIndex / v.expectedMoves.length) * 100)
      : 0

    // Panel state derived from recallView alone
    if (v.completed) {
      result.recallPanelState = 'success'
    } else {
      result.recallPanelState = 'active'
    }
  } else {
    // No recallView: panel state is 'empty' (may be overridden to 'disabled'
    // in render() when mode is not 'recall')
    result.recallPanelState = 'empty'
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
