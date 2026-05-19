import fs from 'fs'
import EventEmitter from 'events'
import {basename, extname, join} from 'path'
import {ipcRenderer} from 'electron'
import {h} from 'preact'
import {v4 as uuid} from 'uuid'

import Board from '@sabaki/go-board'
import deadstones from '@sabaki/deadstones'
import gtp from '@sabaki/gtp'
import sgf from '@sabaki/sgf'

import i18n from '../i18n.js'
import EngineSyncer, {detectEngines} from './enginesyncer.js'
import * as dialog from './dialog.js'
import * as fileformats from './fileformats/index.js'
import * as gametree from './gametree.js'
import * as gobantransformer from './gobantransformer.js'
import * as gtplogger from './gtplogger.js'
import {logger, createWinstonWriter} from './logger/index.js'
import * as helper from './helper.js'
import {
  MUTATION_CONTRACTS,
  SCRATCH_ROLES,
  WORKSPACE_KINDS,
  createGameTreePositionSource,
  createScratchEditExecutionContext,
  createScratchPositionFromSnapshot,
  createScratchPositionSource,
  getMutationContractFromState,
  getPositionSourceFromState,
} from './workbench/contracts/index.ts'
import {
  RESOLVE_STATUSES,
  createBoardInteractionContext,
  executeBoardInteraction,
  executePlayInteraction,
  resolveBoardInteraction,
} from './workbench/board-interactions/index.ts'
import {createDocumentStore} from './document/documentStore.js'
import {createEngineService} from './engine/engineService.js'
import {createAnalysisService} from './analysis/analysisService.ts'
import {createOverlayStore} from './overlays/overlayStore.ts'
import {createAnalysisAreaStore} from './analysis/analysisAreaStore.ts'
import {
  createWorkbenchStore,
  createTrainingRuntimeStore,
  createTrainingRepository,
  createLegacySabakiAdapter,
  createAnalysisResultAdapter,
  createPositionSnapshotAdapter,
  createWorkbenchTabService,
  createWorkbenchPhaseService,
  createWorkbenchFlowService,
  createAttemptService,
  createPlayTrainingMonitor,
  createRecallService,
  createRecallCheckpointService,
  createSnapshotService,
  createReviewService,
  createProblemService,
  createProblemFlowService,
  createLegacyTrainingFlowController,
  evaluateAttempt,
  projectTrainingState,
} from './training/index.ts'
import {
  boardFromSnapshot,
  cloneSnapshot,
  createSnapshotFromBoard,
  snapshotToGameTree,
} from './study.js'
import * as sound from './sound.js'
import hubStore from './hubStore.js'

deadstones.useFetch('./node_modules/@sabaki/deadstones/wasm/deadstones_bg.wasm')

const setting = {
  get: (key) => window.sabaki.setting.get(key),
  set: (key, value) => {
    window.sabaki.setting.set(key, value)
    return setting
  },
  events: {
    on: (id, event, f) => {
      if (event === 'change') {
        window.sabaki.setting.onDidChange(f)
      }
    },
  },
}

const humanSLModelFilename = 'b18c384nbt-humanv0.bin.gz'

class Sabaki extends EventEmitter {
  constructor() {
    super()

    let emptyTree = gametree.new()

    this.state = {
      mode: 'play',
      openDrawer: null,
      busy: 0,
      fullScreen: false,
      showMenuBar: null,
      zoomFactor: null,

      representedFilename: null,
      gameIndex: 0,
      gameTrees: [emptyTree],
      gameCurrents: [{}],
      treePosition: emptyTree.root.id,

      // Bars

      selectedTool: 'stone_1',
      scoringMethod: null,
      findText: '',
      findVertex: null,
      deadStones: [],

      // Goban

      territoryEnabled: false,
      territoryCompareEnabled: false,
      highlightVertices: [],
      playVariation: null,
      analysisType: null,
      coordinatesType: null,
      showAnalysis: null,
      showAISuggestions: null,
      showHumanPreference: null,
      showCoordinates: null,
      showMoveColorization: null,
      showMoveNumbers: null,
      showNextMoves: null,
      showSiblings: null,
      fuzzyStonePlacement: null,
      animateStonePlacement: null,
      boardTransformation: '',
      // Analysis workspace (set only when mode === 'analysis')
      editWorkspace: null,

      // Sidebar

      showLeftSidebar: setting.get('view.show_leftsidebar'),
      leftSidebarWidth: setting.get('view.leftsidebar_width'),
      showWinrateGraph: setting.get('view.show_winrategraph'),
      showGameGraph: setting.get('view.show_graph'),
      showCommentBox: setting.get('view.show_comments'),
      sidebarWidth: setting.get('view.sidebar_width'),
      graphGridSize: null,
      graphNodeSize: null,

      // Engines (state owned by engineService — only settings here)
      engines: null,
      selectedAnalysisVertex: null,

      // Drawers

      preferencesTab: 'general',

      // Input Box

      showInputBox: false,
      inputBoxText: '',
      onInputBoxSubmit: helper.noop,
      onInputBoxCancel: helper.noop,

      // Info Overlay

      infoOverlayText: '',
      showInfoOverlay: false,

      // Third-party Panel
      showThirdPartyPanel: false,
      thirdPartyPanelTab: 'fox',
      weiqi101Connected: false,
    }

    this.events = new EventEmitter()

    // --- LoggerService + Winston writer ---
    this._winstonWriter = createWinstonWriter({
      isFileEnabled: () => setting.get('app.logging_file_enabled'),
      getFileLevel: () => setting.get('app.logging_level') || 'info',
      getLogPath: () => setting.get('app.logging_file_path'),
      isWritableDir: (dir) => helper.isWritableDirectory(dir),
      showWarning: (msg, type) => dialog.showMessageBox(msg, type),
    })

    logger.reconfigure({writers: [this._winstonWriter]})

    // App info will be set via IPC - use defaults initially
    this.appName = 'Sabaki'
    this.version = ''
    this._initAppInfo()

    // Window operations proxy
    this.window = {
      setFullScreen: (f) => window.sabaki.window.setFullScreen(f),
      isFullScreen: () => this._windowState.isFullScreen,
      isMaximized: () => this._windowState.isMaximized,
      isMinimized: () => this._windowState.isMinimized,
      setMenuBarVisibility: (v) => window.sabaki.window.setMenuBarVisibility(v),
      setProgressBar: (p) => window.sabaki.window.setProgressBar(p),
      getContentSize: () => this._windowState.contentSize,
      setContentSize: (w, h) => window.sabaki.window.setContentSize(w, h),
      close: () => window.sabaki.window.close(),
      on: (event, callback) => {
        this._windowListeners[event] = this._windowListeners[event] || []
        this._windowListeners[event].push(callback)
        return window.sabaki.window.on(event, callback)
      },
      removeListener: (event, callback) => {
        if (this._windowListeners[event]) {
          const idx = this._windowListeners[event].indexOf(callback)
          if (idx >= 0) this._windowListeners[event].splice(idx, 1)
        }
      },
      get autoHideMenuBar() {
        return !setting.get('view.show_menubar')
      },
      set autoHideMenuBar(v) {
        window.sabaki.window.setAutoHideMenuBar(v)
      },
      webContents: {
        undo: () => window.sabaki.webContents.undo(),
        redo: () => window.sabaki.webContents.redo(),
        toggleDevTools: () => window.sabaki.webContents.toggleDevTools(),
        getOSProcessId: () => window.sabaki.webContents.getOSProcessId(),
        get zoomFactor() {
          return setting.get('app.zoom_factor')
        },
        set zoomFactor(f) {
          window.sabaki.webContents.setZoomFactor(f)
        },
        set audioMuted(m) {
          window.sabaki.webContents.setAudioMuted(m)
        },
      },
    }

    this._windowState = {
      isFullScreen: false,
      isMaximized: false,
      isMinimized: false,
      contentSize: [0, 0],
    }
    this._windowListeners = {}
    this._setupWindowStateSync()

    this.treeHash = this.generateTreeHash()
    // Phase 12C: ownership cache and analysis request counters moved to
    // analysisCache.ts and analysisLifecycle.ts respectively.
    this.historyPointer = 0
    this.history = []
    this.recordHistory()

    // Bind state to settings
    window.sabaki.setting.onDidChange(({key, value}) => {
      this.updateSettingState(key)
    })

    this.updateSettingState()

    logger.info('state.created', 'Application state initialized', {
      mode: this.state.mode,
      gameCount: this.state.gameTrees.length,
      treePosition: this.state.treePosition,
    })
  }

  async _initAppInfo() {
    this.appName = await window.sabaki.app.getName()
    this.version = await window.sabaki.app.getVersion()
  }

  async _setupWindowStateSync() {
    // Initial state
    this._windowState.isFullScreen = await window.sabaki.window.isFullScreen()
    this._windowState.isMaximized = await window.sabaki.window.isMaximized()
    this._windowState.isMinimized = await window.sabaki.window.isMinimized()
    this._windowState.contentSize = await window.sabaki.window.getContentSize()

    // Listen for window events to keep state in sync
    window.sabaki.window.on('maximize', () => {
      this._windowState.isMaximized = true
    })
    window.sabaki.window.on('unmaximize', () => {
      this._windowState.isMaximized = false
    })
    window.sabaki.window.on('resize', async () => {
      this._windowState.contentSize =
        await window.sabaki.window.getContentSize()
    })
  }

  setState(change, callback = null) {
    if (typeof change === 'function') {
      change = change(this.state)
    }

    Object.assign(this.state, change)
    this.emit('change', {change, callback})
  }

  getInferredState(state) {
    let self = this

    return {
      get title() {
        let title = self.appName
        let {representedFilename, gameIndex, gameTrees} = state
        let t = i18n.context('sabaki.window')

        if (representedFilename) title = basename(representedFilename)

        if (gameTrees.length > 1) {
          title +=
            ' — ' +
            t((p) => `Game ${p.gameNumber}`, {
              gameNumber: gameIndex + 1,
            })
        }

        if (representedFilename && process.platform != 'darwin') {
          title += ' — ' + self.appName
        }

        return title
      },
      get gameTree() {
        return state.gameTrees[state.gameIndex]
      },
      get showSidebar() {
        return (
          state.showGameGraph ||
          state.showCommentBox ||
          state.editWorkspace?.referenceSnapshot != null ||
          state.territoryEnabled ||
          state.mode === 'play' ||
          (state.mode === 'analysis' && state.editWorkspace != null)
        )
      },
      get gameInfo() {
        return self.getGameInfo()
      },
      get currentPlayer() {
        return self.getPlayer(state.treePosition)
      },
      get lastPlayer() {
        let node = this.gameTree.get(state.treePosition)

        return 'B' in node.data
          ? 1
          : 'W' in node.data
            ? -1
            : -this.currentPlayer
      },
      get board() {
        return gametree.getBoard(this.gameTree, state.treePosition)
      },
      get analyzingEngineSyncer() {
        return (
          self._playServices?.engineService?.getAnalyzingEngineSyncer() ??
          undefined
        )
      },
      get winrateData() {
        return [
          ...this.gameTree.listCurrentNodes(
            state.gameCurrents[state.gameIndex],
          ),
        ].map((x) => x.data.SBKV && x.data.SBKV[0])
      },
      get scoreLeadData() {
        return [
          ...this.gameTree.listCurrentNodes(
            state.gameCurrents[state.gameIndex],
          ),
        ].map((x) => x.data.SBKS && x.data.SBKS[0])
      },
      get currentLineNodes() {
        return [
          ...this.gameTree.listCurrentNodes(
            state.gameCurrents[state.gameIndex],
          ),
        ]
      },
    }
  }

  get inferredState() {
    return this.getInferredState(this.state)
  }

  updateSettingState(key = null) {
    let data = {
      'app.zoom_factor': 'zoomFactor',
      'board.analysis_type': 'analysisType',
      'board.show_analysis': 'showAnalysis',
      'board.show_ai_suggestions': 'showAISuggestions',
      'board.show_human_preference': 'showHumanPreference',
      'view.show_menubar': 'showMenuBar',
      'view.show_coordinates': 'showCoordinates',
      'view.show_move_colorization': 'showMoveColorization',
      'view.show_move_numbers': 'showMoveNumbers',
      'view.show_next_moves': 'showNextMoves',
      'view.show_siblings': 'showSiblings',
      'view.coordinates_type': 'coordinatesType',
      'view.fuzzy_stone_placement': 'fuzzyStonePlacement',
      'view.animated_stone_placement': 'animateStonePlacement',
      'graph.grid_size': 'graphGridSize',
      'graph.node_size': 'graphNodeSize',
      'engines.list': 'engines',
      'scoring.method': 'scoringMethod',
    }

    if (key == null) {
      for (let k in data) this.updateSettingState(k)
      return
    }

    if (key in data) {
      this.setState({[data[key]]: setting.get(key)})
    }
  }

  async waitForRender() {
    return new Promise((resolve) => this.setState({}, resolve))
  }

  // User Interface

  createScratchSnapshotFromCurrentPosition(role = SCRATCH_ROLES.CURRENT) {
    let tree = this.state.gameTrees[this.state.gameIndex]
    let board = gametree.getBoard(tree, this.state.treePosition)
    let currentPlayer = this.getPlayer(this.state.treePosition)
    let snapshot = createSnapshotFromBoard(board, currentPlayer)
    let komi = +gametree.getRootProperty(tree, 'KM', 0)
    let rules = gametree.getRootProperty(tree, 'RU', null)

    return createScratchPositionFromSnapshot(snapshot, {
      id: uuid(),
      role,
      komi: Number.isFinite(komi) ? komi : null,
      rules: typeof rules === 'string' ? rules : null,
      source: {
        type: 'game-tree-node',
        id: this.state.treePosition,
      },
    })
  }

  createAnalysisWorkspace() {
    let snapshot = this.createScratchSnapshotFromCurrentPosition()
    return {
      workspaceKind: WORKSPACE_KINDS.SCRATCH_ANALYSIS,
      mutationContract: MUTATION_CONTRACTS.SCRATCH_EDIT,
      positionSource: createScratchPositionSource(
        snapshot.id,
        SCRATCH_ROLES.CURRENT,
      ),
      currentSnapshot: snapshot,
      referenceSnapshot: null,
      activeTab: 'current',
      currentAnalysis: null,
      currentOwnership: null,
      referenceAnalysis: null,
      referenceOwnership: null,
      analysisPending: false,
      currentMarkerMap: snapshot.signMap.map((row) => row.map(() => null)),
      referenceMarkerMap: null,
      currentLines: [],
      referenceLines: [],
      lineFirstVertex: null,
    }
  }

  resetAnalysisWorkspace() {
    clearTimeout(this.editAnalysisId)

    this.setState(
      {
        mode: 'analysis',
        editWorkspace: this.createAnalysisWorkspace(),
      },
      () => this.scheduleEditWorkspaceAnalysis(),
    )
    this.events.emit('modeChange')
    logger.info('analysis.workspace_reset', 'Analysis workspace reset')
  }

  setMode(mode) {
    if (this.state.mode === mode) return

    let oldMode = this.state.mode
    let stateChange = {mode}

    // Clean up edit workspace when leaving analysis mode
    if (this.state.mode === 'analysis' && mode !== 'analysis') {
      clearTimeout(this.editAnalysisId)
      stateChange.editWorkspace = null
      this.getAnalysisAreaStore().resetOnModeChange()
    }

    if (['scoring', 'estimator'].includes(mode)) {
      // Guess dead stones

      let {gameIndex, gameTrees, treePosition} = this.state
      let iterations = setting.get('score.estimator_iterations')
      let tree = gameTrees[gameIndex]

      deadstones
        .guess(gametree.getBoard(tree, treePosition).signMap, {
          finished: mode === 'scoring',
          iterations,
        })
        .then((result) => {
          this.setState({deadStones: result})
        })
    } else if (mode === 'analysis') {
      // Seed analysis workspace from current board position
      stateChange.editWorkspace = this.createAnalysisWorkspace()

      this.waitForRender().then(() => {
        let textarea = document.querySelector('#properties .edit textarea')

        if (textarea == null) return

        textarea.selectionStart = textarea.selectionEnd = 0
        textarea.focus()
      })
    } else if (mode === 'recall') {
      const {runtimeStore} = this.getTrainingContext()
      if (!runtimeStore.getState().recallView) return
    }
    // mode='review' is no longer a board mode — review items open as problem tabs

    this.setState(stateChange)
    this.events.emit('modeChange')

    // Let overlayStore react to mode change (clear territory when leaving analysis)
    this.getOverlayStore().onModeChange(mode)

    logger.info(
      'mode.changed',
      'Mode changed',
      {from: oldMode, to: mode},
      {mode},
    )

    if (mode === 'analysis') {
      this.scheduleEditWorkspaceAnalysis()
      // Auto-enable territory overlay when entering analysis mode
      this.getOverlayStore().setTerritoryEnabled(true)
    } else if (
      mode !== 'analysis' &&
      this.state.territoryCompareEnabled &&
      !this.getTerritoryCompareAvailable()
    ) {
      this.toggleTerritoryCompareEnabled()
    }
  }

  openHub(section, params) {
    hubStore.open(section, params)
  }

  openDrawer(drawer) {
    this.setState({openDrawer: drawer})
  }

  getHubStore() {
    return hubStore
  }

  closeDrawer() {
    this.openDrawer(null)
  }

  setThirdPartyPanelState(change) {
    this.setState(change)
  }

  toggleThirdPartyPanel(tab = null) {
    this.setState((state) => ({
      showThirdPartyPanel: tab !== null ? true : !state.showThirdPartyPanel,
      thirdPartyPanelTab: tab !== null ? tab : state.thirdPartyPanelTab,
    }))
  }

  // Engine Game Training Integration

  async startEngineGameTraining() {
    return this.getTrainingContext().legacyTrainingFlowController.startEngineGameTraining()
  }

  async stopEngineGameTraining() {
    return this.getTrainingContext().legacyTrainingFlowController.stopEngineGameTraining()
  }

  // Recall Mode

  async startRecallSession(gameId, options = {}) {
    return this.getTrainingContext()
      .legacyTrainingFlowController.startRecallSession(gameId, options)
  }

  handleRecallMove(vertex) {
    return this.getTrainingContext()
      .legacyTrainingFlowController.handleRecallMove(vertex)
  }

  skipRecallMove() {
    return this.getTrainingContext().legacyTrainingFlowController.skipRecallMove()
  }

  showRecallHint() {
    return this.getTrainingContext().legacyTrainingFlowController.showRecallHint()
  }

  async endRecallSession() {
    return this.getTrainingContext().legacyTrainingFlowController.endRecallSession()
  }

  recallNavigateNext() {
    let {gameTrees, gameIndex, gameCurrents, treePosition} = this.state
    let tree = gameTrees[gameIndex]
    let currents = gameCurrents[gameIndex]
    let nextNode = tree.navigate(treePosition, 1, currents)
    if (nextNode) {
      this.setCurrentTreePosition(tree, nextNode.id)
    }
  }

  checkRecallComplete() {
    return this.getTrainingContext().legacyTrainingFlowController.checkRecallComplete()
  }

  async saveCurrentGame() {
    let sgfStr = this.getSGF()
    let tree = this.state.gameTrees[this.state.gameIndex]
    let root = tree.get(tree.root.id)
    let result = root.data.RE?.[0] || null
    let game = {sgf: sgfStr, source: 'play', result}
    let saved = await window.sabaki.db.saveGame(game)
    if (saved) {
      logger.info('game.saved', 'Game saved', {
        gameId: saved.id,
      })
    }
    return saved
  }

  // Problem Snapshot

  snapshotAsProblem() {
    if (this.state.mode !== 'analysis') return
    this.openDrawer('problemEditor')
  }

  async createProblemFromSnapshot(options) {
    let tree = this.state.gameTrees[this.state.gameIndex]
    let board = gametree.getBoard(tree, this.state.treePosition)
    let currentPlayer = this.getPlayer(this.state.treePosition)
    let snapshot = createSnapshotFromBoard(board, currentPlayer)

    let sgfStr = sgf.stringify([snapshotToGameTree(snapshot, {moveNumber: 0})])

    let problem = {
      sourceGameId: null,
      sourceMoveNumber: null,
      type: options.type || 'best_move',
      positionSgf: sgfStr,
      sideToMove: options.sideToMove || (currentPlayer > 0 ? 'black' : 'white'),
      title: options.title || null,
      positionDescription: options.positionDescription || '',
      taskGoal: options.taskGoal || '',
      referenceLines: options.referenceLines || [],
      passRule: options.passRule || {
        evalDropThreshold: 5,
        requireNoSevereBadMove: true,
        compareWithReference: true,
      },
      tags: options.tags || [],
      difficulty: options.difficulty || null,
      status: options.status || 'inbox',
    }

    let saved = await window.sabaki.db.saveProblem(problem)
    this.closeDrawer()
    return saved
  }

  // Problem Mode — thin proxy to workbenchTabService

  async startProblem(problemId) {
    return this.getTrainingContext().tabService.openProblemTab(problemId, {
      legacyCompatibility: true,
    })
  }

  async handleProblemMove(vertex) {
    return this.getTrainingContext()
      .legacyTrainingFlowController.handleProblemMove(vertex)
  }

  async submitProblemAttempt() {
    return this.getTrainingContext()
      .legacyTrainingFlowController.submitProblemAttempt()
  }

  undoProblemMove() {
    return this.getTrainingContext().legacyTrainingFlowController.undoProblemMove()
  }

  exitProblemMode() {
    return this.getTrainingContext().legacyTrainingFlowController.exitProblemMode()
  }

  // Review Mode — queue/inbox only, NOT a board mode

  async startReviewSession() {
    return this.getTrainingContext()
      .legacyTrainingFlowController.startReviewSession()
  }

  async advanceReview() {
    return this.getTrainingContext().legacyTrainingFlowController.advanceReview()
  }

  setBusy(busy) {
    let diff = busy ? 1 : -1
    this.setState((s) => ({busy: Math.max(s.busy + diff, 0)}))
  }

  showInfoOverlay(text) {
    this.setState({
      infoOverlayText: text,
      showInfoOverlay: true,
    })
  }

  hideInfoOverlay() {
    this.setState({showInfoOverlay: false})
  }

  flashInfoOverlay(text, duration = null) {
    if (duration == null) duration = setting.get('infooverlay.duration')

    this.showInfoOverlay(text)

    clearTimeout(this.hideInfoOverlayId)
    this.hideInfoOverlayId = setTimeout(() => this.hideInfoOverlay(), duration)
  }

  clearConsole() {
    logger.clear()
    if (this._playServices) {
      this.getPlayServices().engineService.clearConsoleLog()
    }
  }

  getOwnershipCacheKey(syncerId, tree, treePosition) {
    if (syncerId == null || tree == null || treePosition == null) return null
    return [syncerId, tree.root.id, treePosition].join(':')
  }

  cacheOwnership(syncerId, tree, treePosition, ownership) {
    return this.getPlayServices().analysisService.cacheOwnership(
      syncerId,
      tree,
      treePosition,
      ownership,
    )
  }

  getCachedOwnership(syncerId, tree, treePosition) {
    return this.getPlayServices().analysisService.getCachedOwnership(
      syncerId,
      tree,
      treePosition,
    )
  }

  cacheScratchOwnership(syncerId, snapshot, ownership) {
    this.getPlayServices().analysisService.cacheScratchOwnership(
      syncerId,
      snapshot,
      ownership,
    )
  }

  getCachedScratchOwnership(syncerId, snapshot) {
    return this.getPlayServices().analysisService.getCachedScratchOwnership(
      syncerId,
      snapshot,
    )
  }

  cachePreviewOwnership(syncerId, tree, treePosition, moves, ownership) {
    return this.getPlayServices().analysisService.cachePreviewOwnership(
      syncerId,
      tree,
      treePosition,
      moves,
      ownership,
    )
  }

  getCachedPreviewOwnership(syncerId, tree, treePosition, moves) {
    return this.getPlayServices().analysisService.getCachedPreviewOwnership(
      syncerId,
      tree,
      treePosition,
      moves,
    )
  }

  getCurrentOwnership(syncer = this.inferredState.analyzingEngineSyncer) {
    return this.getPlayServices().analysisService.getCurrentOwnership(syncer)
  }

  getEditWorkspaceTabKeys(tab) {
    let prefix = tab === 'reference' ? 'reference' : 'current'

    return {
      snapshotKey: `${prefix}Snapshot`,
      analysisKey: `${prefix}Analysis`,
      ownershipKey: `${prefix}Ownership`,
      markerKey: `${prefix}MarkerMap`,
      linesKey: `${prefix}Lines`,
    }
  }

  getPreviousTreePosition(
    treePosition = this.state.treePosition,
    tree = this.inferredState.gameTree,
  ) {
    return tree?.get(treePosition)?.parentId ?? null
  }

  getTerritoryCompareAvailable() {
    return this.getOverlayStore().getTerritoryCompareAvailable()
  }

  getBoardAnalysisContext({state = this.state, tab = null} = {}) {
    return this.getPlayServices().analysisService.getBoardAnalysisContext({
      state,
      tab,
    })
  }

  getActivePositionSource(tab = null) {
    return getPositionSourceFromState(this.state, tab)
  }

  getActiveMutationContract() {
    return getMutationContractFromState(this.state)
  }

  refreshActiveBoardAnalysis() {
    return this.getPlayServices().analysisService.refreshActiveBoardAnalysis()
  }

  syncEditWorkspaceToCurrentPosition() {
    let ws = this.state.editWorkspace
    if (ws == null) return

    let snapshot = this.createScratchSnapshotFromCurrentPosition()

    this.setState({
      editWorkspace: {
        ...ws,
        positionSource: createScratchPositionSource(
          snapshot.id,
          SCRATCH_ROLES.CURRENT,
        ),
        currentSnapshot: snapshot,
        currentAnalysis: null,
        currentOwnership: null,
        currentMarkerMap: snapshot.signMap.map((row) => row.map(() => null)),
        currentLines: [],
        lineFirstVertex: null,
      },
    })
  }

  async ensureAnalysisReady({requireOwnership = false} = {}) {
    return this.getPlayServices().analysisService.ensureAnalysisReady({
      requireOwnership,
    })
  }

  async attachDefaultAnalysisEngine({requireOwnership = false} = {}) {
    return this.getPlayServices().analysisService.attachDefaultAnalysisEngine({
      requireOwnership,
    })
  }

  waitForEngineCommands(syncer, {timeout = 10000} = {}) {
    if (syncer == null) return Promise.resolve(false)
    if (syncer.commands.length > 0) return Promise.resolve(true)

    if (syncer.engine.enableHumanSL === true) {
      timeout = Math.max(timeout, 300000)
    }

    return new Promise((resolve) => {
      let done = false
      let intervalId = null
      let timeoutId = null

      let finish = (ready) => {
        if (done) return
        done = true

        clearInterval(intervalId)
        clearTimeout(timeoutId)
        syncer.removeListener('suspended-changed', check)
        syncer.controller.removeListener('response-received', check)
        syncer.controller.removeListener('stopped', handleStopped)
        resolve(ready)
      }

      let check = () => {
        if (syncer.commands.length > 0) {
          finish(true)
        }
      }

      let handleStopped = () => {
        finish(false)
      }

      intervalId = setInterval(check, 50)
      timeoutId = setTimeout(() => {
        finish(syncer.commands.length > 0)
      }, timeout)

      syncer.on('suspended-changed', check)
      syncer.controller.on('response-received', check)
      syncer.controller.on('stopped', handleStopped)

      check()
    })
  }

  // Phase 8: Play Interaction Services

  _playServices = null
  _overlayStore = null
  _trainingServices = null

  getTrainingContext() {
    if (this._trainingServices == null) {
      const workbenchStore = createWorkbenchStore()
      const runtimeStore = createTrainingRuntimeStore()
      const repository = createTrainingRepository(window.sabaki.db)
      const legacyAdapter = createLegacySabakiAdapter(this)

      const analysisResultAdapter = createAnalysisResultAdapter(this)
      const positionSnapshotAdapter = createPositionSnapshotAdapter(this)

      const attemptService = createAttemptService({ repository, runtimeStore, logger })
      const monitor = createPlayTrainingMonitor({ attemptService, analysisResultAdapter, repository, runtimeStore, logger })
      const tabService = createWorkbenchTabService({
        workbenchStore,
        repository,
        legacyAdapter,
        sgfParser: fileformats.sgf,
        runtimeStore,
        attemptService,
        monitor,
        logger,
      })
      const checkpointService = createRecallCheckpointService({ repository, runtimeStore, logger })
      const recallService = createRecallService({ repository, runtimeStore, checkpointService, logger })
      const snapshotService = createSnapshotService({ repository, positionSnapshotAdapter, workbenchStore, logger })
      const phaseService = createWorkbenchPhaseService({
        workbenchStore,
        repository,
        snapshotService,
        tabService,
        logger,
      })
      const flowService = createWorkbenchFlowService({
        workbenchStore,
        repository,
        attemptService,
        recallService,
        snapshotService,
        tabService,
        evaluationRules: { evaluateAttempt },
        runtimeStore,
        logger,
      })

      const reviewService = createReviewService({ repository, workbenchTabService: tabService, logger })
      const problemService = createProblemService({ repository, reviewService, logger })
      const problemFlowService = createProblemFlowService({
        runtimeStore,
        repository,
        attemptService,
        monitor,
        problemService,
        reviewService,
        logger,
      })

      this._trainingServices = {
        workbenchStore,
        runtimeStore,
        repository,
        legacyAdapter,
        analysisResultAdapter,
        tabService,
        flowService,
        phaseService,
        attemptService,
        monitor,
        recallService,
        checkpointService,
        snapshotService,
        reviewService,
        problemService,
        problemFlowService,
        projectTrainingState: () => projectTrainingState({
          trainingRuntimeState: runtimeStore.getState(),
        }),
      }

      // Controller must be created after all other services are set,
      // but does NOT call getTrainingContext() at create time.
      const legacyTrainingFlowController = createLegacyTrainingFlowController({
        sabaki: this,
        db: window.sabaki.db,
        getTrainingContext: () => this._trainingServices,
      })
      this._trainingServices.legacyTrainingFlowController =
        legacyTrainingFlowController
      // Compatibility alias for call sites that have not been renamed yet.
      this._trainingServices.controller = legacyTrainingFlowController
    }
    return this._trainingServices
  }

  getTrainingServices() {
    return this.getTrainingContext()
  }

  getOverlayStore() {
    if (this._overlayStore == null) {
      this._overlayStore = createOverlayStore({
        getAppState: () => ({
          mode: this.state.mode,
          editWorkspace: this.state.editWorkspace,
          treePosition: this.state.treePosition,
          analysisTreePosition: this.state.analysisTreePosition,
          currentOwnership: (syncer) => this.getCurrentOwnership(syncer),
        }),
        ensureAnalysisReady: (opts) => this.ensureAnalysisReady(opts),
        analyzeMove: (tp) => this.analyzeMove(tp),
        scheduleEditWorkspaceAnalysis: () =>
          this.scheduleEditWorkspaceAnalysis(),
        captureEditReference: () => this.captureEditReference(),
        getInfoOverlayDuration: () => setting.get('infooverlay.duration'),
        notifyChange: () => this.setState({}),
        logger,
      })
    }
    return this._overlayStore
  }

  getAnalysisAreaStore() {
    if (this._analysisAreaStore == null) {
      this._analysisAreaStore = createAnalysisAreaStore()
      this._analysisAreaStore.subscribe(() => this.setState({}))
    }
    return this._analysisAreaStore
  }

  getPlayServices() {
    if (this._playServices == null) {
      let documentStore = createDocumentStore(this, {
        getSetting: (key) => setting.get(key),
        setSetting: (key, value) => setting.set(key, value),
        closeDrawer: () => this.closeDrawer(),
        setMode: (mode) => this.setMode(mode),
        getTerritoryCompareAvailable: (state) =>
          this.getTerritoryCompareAvailable(state),
        syncEditWorkspaceToCurrentPosition: () =>
          this.syncEditWorkspaceToCurrentPosition(),
        scheduleEditWorkspaceAnalysis: () =>
          this.scheduleEditWorkspaceAnalysis(),
        scheduleLiveAnalysis: (treePosition) =>
          this.scheduleLiveAnalysis(treePosition),
        showMessageBox: (message, type, buttons, defaultId) =>
          dialog.showMessageBox(message, type, buttons, defaultId),
        boardFromSnapshot: (snapshot) => boardFromSnapshot(snapshot),
      })

      // Phase 12C: analysisService created before engineService.
      // engineService is late-bound via setEngineService() after creation.
      let analysisService = createAnalysisService(this, {
        analysisAreaStore: this.getAnalysisAreaStore(),
        showInfoOverlay: (text) => this.showInfoOverlay(text),
        hideInfoOverlay: () => this.hideInfoOverlay(),
        detectEngines: () => detectEngines(),
        waitForEngineCommands: (syncer, opts) =>
          this.waitForEngineCommands(syncer, opts),
        showMessageBox: (msg, type) => dialog.showMessageBox(msg, type),
        logger,
        getSetting: (key) => setting.get(key),
        scheduleEditWorkspaceAnalysis: (tab) =>
          this.scheduleEditWorkspaceAnalysis(tab),
        i18n,
      })

      let engineService = createEngineService({
        getSetting: (key) => setting.get(key),
        getPlayer: (tp) => this.getPlayer(tp),
        getGameTree: () => this.inferredState.gameTree,
        getTreePosition: () => this.state.treePosition,
        getMode: () => this.state.mode,
        getEditWorkspace: () => this.state.editWorkspace,
        getGameIndex: () => this.state.gameIndex,
        getGameTrees: () => this.state.gameTrees,
        setCurrentTreePosition: (tree, pos, opts) =>
          documentStore.setCurrentTreePosition(tree, pos, opts),
        analyzeMove: (tp) => analysisService.analyzeGameTreePosition(tp),
        scheduleEditWorkspaceAnalysis: (tab) =>
          this.scheduleEditWorkspaceAnalysis(tab),
        scheduleLiveAnalysis: (tp) =>
          analysisService.scheduleGameTreeAnalysis(tp),
        syncEditWorkspaceToCurrentPosition: () =>
          this.syncEditWorkspaceToCurrentPosition(),
        cacheOwnership: (syncerId, tree, tp, ownership) =>
          analysisService.cacheOwnership(syncerId, tree, tp, ownership),
        saveCurrentGame: () => this.saveCurrentGame(),
        startRecallSession: (gameId) => this.startRecallSession(gameId),
        stopEngineGameTraining: () => this.stopEngineGameTraining(),
        setBusy: (busy) => this.setBusy(busy),
        showInfoOverlay: (text) => this.showInfoOverlay(text),
        hideInfoOverlay: () => this.hideInfoOverlay(),
        showMessageBox: (msg, type) => dialog.showMessageBox(msg, type),
        notifyChange: () => this.setState({}),
        getUserDataDirectory: () => window.sabaki.setting.userDataDirectory,
        notifyAnalysisUpdate: (positionKey) => {
          let adapter = this._trainingServices?.analysisResultAdapter
          adapter?.notifyAnalysisUpdate(positionKey)
        },
      })

      // Late-bind engineService into analysisService (breaks circular creation ordering).
      analysisService.setEngineService(engineService)

      this._playServices = {documentStore, engineService, analysisService}
    }
    return this._playServices
  }

  async executePlayMove(result) {
    let services = this.getPlayServices()
    let currentPlayer = this.getPlayer(this.state.treePosition)
    let controller = this.getTrainingContext().legacyTrainingFlowController
    let training = controller.getEngineGameTraining()
    let positionBefore = training ? this.state.treePosition : null

    let playResult = await executePlayInteraction(result, {player: currentPlayer}, services)

    // Training: notify monitor of human move in engine games
    if (training && playResult?.changed && !playResult?.pass) {
      let move = result.payload?.vertex
        ? sgf.stringifyVertex(result.payload.vertex)
        : ''
      controller.notifyEngineGamePlayMove(positionBefore, playResult.treePosition, move)
    }
  }

  // Phase 5: Edit-Analysis Click Redirect

  handleEditAnalysisClick(vertex, {button = 0, ctrlKey = false} = {}) {
    let ws = this.state.editWorkspace
    if (ws == null) return false

    let tab = ws.activeTab
    let {snapshotKey} = this.getEditWorkspaceTabKeys(tab)
    let snapshot = ws[snapshotKey]
    if (snapshot == null) return false

    let workingBoard = boardFromSnapshot(snapshot)
    if (workingBoard == null) return false

    let context = createBoardInteractionContext({
      state: this.state,
      board: workingBoard,
      vertex,
      event: {button, ctrlKey, metaKey: false},
      isMac: helper.isMac,
    })
    if (context == null) return false

    let result = resolveBoardInteraction(context)

    let execContext = createScratchEditExecutionContext(ws)
    if (execContext == null) return false

    let execResult = executeBoardInteraction(result, execContext)

    if (!execResult.handled) return false

    if (execResult.changed || execResult.lineFirstVertex !== undefined) {
      this.commitEditResult(execResult)
    }

    return true
  }

  commitEditResult({
    tab,
    snapshot,
    markerMap,
    lines,
    lineFirstVertex,
    newTab,
    capturedSnapshot,
  }) {
    let ws = this.state.editWorkspace
    if (ws == null) return

    let effectiveTab = newTab ?? tab ?? ws.activeTab
    let {snapshotKey, analysisKey, ownershipKey, markerKey, linesKey} =
      this.getEditWorkspaceTabKeys(effectiveTab)

    // Snapshot write: invalidates analysis and ownership
    if (snapshot != null) {
      // Phase 10: generation tracking moved into scratchAnalysis.ts
      this.setState({
        editWorkspace: {
          ...ws,
          positionSource: createScratchPositionSource(
            snapshot.id,
            snapshot.role ?? effectiveTab,
          ),
          [snapshotKey]: snapshot,
          [analysisKey]: null,
          [ownershipKey]: null,
        },
      })
      this.scheduleEditWorkspaceAnalysis(effectiveTab)
      return
    }

    // Marker write
    if (markerMap != null) {
      this.setState({
        editWorkspace: {
          ...ws,
          [markerKey]: markerMap,
        },
      })
      return
    }

    // Line write or line-first-vertex state update
    if (lines != null || lineFirstVertex !== undefined) {
      let updates = {...ws}
      if (lines != null) updates[linesKey] = lines
      if (lineFirstVertex !== undefined)
        updates.lineFirstVertex = lineFirstVertex
      this.setState({editWorkspace: updates})
      return
    }

    // Tab switch without snapshot change
    if (newTab != null) {
      this.setState({
        editWorkspace: {
          ...ws,
          activeTab: newTab,
        },
      })
      this.scheduleEditWorkspaceAnalysis(newTab)
      return
    }

    // Capture reference
    if (capturedSnapshot != null) {
      let targetTab = effectiveTab
      let targetSnapshotKey =
        this.getEditWorkspaceTabKeys(targetTab).snapshotKey
      // Phase 10: generation tracking moved into scratchAnalysis.ts
      this.setState({
        editWorkspace: {
          ...ws,
          activeTab: targetTab,
          [targetSnapshotKey]: capturedSnapshot,
        },
      })
      this.scheduleEditWorkspaceAnalysis(targetTab)
    }
  }

  // Scratch Edit Contract

  scratchEdit(vertex, {button = 0, ctrlKey = false, x = 0, y = 0} = {}) {
    let ws = this.state.editWorkspace
    if (ws == null) return

    let tab = ws.activeTab
    let {snapshotKey, markerKey, linesKey, analysisKey, ownershipKey} =
      this.getEditWorkspaceTabKeys(tab)
    let snapshot = ws[snapshotKey]
    if (snapshot == null) return

    let tool = this.state.selectedTool
    let [vx, vy] = vertex

    // Right-click stone toggle
    let isRightClick = button === 2 || (helper.isMac && button === 0 && ctrlKey)
    if (isRightClick && ['stone_1', 'stone_-1'].includes(tool)) {
      tool = tool === 'stone_1' ? 'stone_-1' : 'stone_1'
    } else if (isRightClick && ['number', 'label'].includes(tool)) {
      let t = i18n.context('sabaki.play')
      helper.popupMenu(
        [
          {
            label: t('&Edit Label'),
            click: async () => {
              let value = await dialog.showInputBox(t('Enter label text'))
              if (value == null) return

              let currentWs = this.state.editWorkspace
              if (currentWs == null) return
              let markerMap = currentWs[markerKey].map((row) => [...row])
              markerMap[vy][vx] = {type: 'label', label: value}
              this.setState({
                editWorkspace: {...currentWs, [markerKey]: markerMap},
              })
            },
          },
        ],
        x,
        y,
      )
      return
    }

    if (
      button !== 0 &&
      button !== 2 &&
      !(helper.isMac && button === 0 && ctrlKey)
    )
      return

    if (['stone_1', 'stone_-1'].includes(tool)) {
      let sign = tool === 'stone_1' ? 1 : -1
      let nextSnapshot = cloneSnapshot(snapshot)
      let current = nextSnapshot.signMap[vy]?.[vx] ?? 0
      nextSnapshot.signMap[vy][vx] = current === sign ? 0 : sign

      // Auto-capture: remove opponent groups with no liberties
      if (nextSnapshot.signMap[vy][vx] !== 0) {
        let tempBoard = boardFromSnapshot(snapshot)
        let resultBoard = tempBoard.makeMove(sign, [vx, vy])

        for (let y = 0; y < resultBoard.height; y++) {
          for (let x = 0; x < resultBoard.width; x++) {
            if (
              tempBoard.get([x, y]) === -sign &&
              resultBoard.get([x, y]) === 0
            ) {
              nextSnapshot.signMap[y][x] = 0
            }
          }
        }
      }

      // Phase 10: generation tracking moved into scratchAnalysis.ts
      this.setState({
        editWorkspace: {
          ...ws,
          positionSource: createScratchPositionSource(
            nextSnapshot.id,
            nextSnapshot.role ?? tab,
          ),
          [snapshotKey]: nextSnapshot,
          [analysisKey]: null,
          [ownershipKey]: null,
        },
      })
      this.scheduleEditWorkspaceAnalysis(tab)
      logger.debug('analysis.stone_toggled', 'Stone toggled', {
        sign,
        vertex,
        tab,
      })
    } else if (tool === 'play') {
      let sign = snapshot.nextPlayer
      let current = snapshot.signMap[vy]?.[vx] ?? 0
      if (current !== 0) return

      let nextSnapshot = cloneSnapshot(snapshot)
      nextSnapshot.signMap[vy][vx] = sign

      // Auto-capture: remove opponent groups with no liberties
      let tempBoard = boardFromSnapshot(snapshot)
      let resultBoard = tempBoard.makeMove(sign, [vx, vy])

      for (let y = 0; y < resultBoard.height; y++) {
        for (let x = 0; x < resultBoard.width; x++) {
          if (
            tempBoard.get([x, y]) === -sign &&
            resultBoard.get([x, y]) === 0
          ) {
            nextSnapshot.signMap[y][x] = 0
          }
        }
      }

      // Switch player for next move
      nextSnapshot.nextPlayer = -sign

      // Phase 10: generation tracking moved into scratchAnalysis.ts
      this.setState({
        editWorkspace: {
          ...ws,
          positionSource: createScratchPositionSource(
            nextSnapshot.id,
            nextSnapshot.role ?? tab,
          ),
          [snapshotKey]: nextSnapshot,
          [analysisKey]: null,
          [ownershipKey]: null,
        },
      })
      this.scheduleEditWorkspaceAnalysis(tab)
      logger.debug('analysis.play_move', 'Play move in analysis', {
        sign,
        vertex,
        tab,
      })
    } else if (tool === 'eraser') {
      let nextSnapshot = cloneSnapshot(snapshot)
      nextSnapshot.signMap[vy][vx] = 0
      // Phase 10: generation tracking moved into scratchAnalysis.ts
      this.setState({
        editWorkspace: {
          ...ws,
          positionSource: createScratchPositionSource(
            nextSnapshot.id,
            nextSnapshot.role ?? tab,
          ),
          [snapshotKey]: nextSnapshot,
          [analysisKey]: null,
          [ownershipKey]: null,
        },
      })
      this.scheduleEditWorkspaceAnalysis(tab)
    } else if (['cross', 'triangle', 'square', 'circle'].includes(tool)) {
      let markerMap = ws[markerKey].map((row) => [...row])
      let typeMap = {
        cross: 'cross',
        triangle: 'triangle',
        square: 'square',
        circle: 'circle',
      }
      let existing = markerMap[vy]?.[vx]
      markerMap[vy][vx] =
        existing?.type === typeMap[tool] ? null : {type: typeMap[tool]}
      this.setState({
        editWorkspace: {...ws, [markerKey]: markerMap},
      })
    } else if (['line', 'arrow'].includes(tool)) {
      if (!this.editVertexData || this.editVertexData[0] !== tool) {
        this.editVertexData = [tool, vertex]
      } else {
        let lines = [
          ...ws[linesKey],
          {v1: this.editVertexData[1], v2: vertex, type: tool},
        ]
        this.editVertexData = null
        this.setState({
          editWorkspace: {...ws, [linesKey]: lines},
        })
      }
    } else if (tool === 'label') {
      let alpha = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'
      let markerMap = ws[markerKey].map((row) => [...row])
      let coordLabel = alpha[vx] + (snapshot.height - vy)
      let existing = markerMap[vy]?.[vx]
      markerMap[vy][vx] =
        existing?.type === 'label' && existing.label === coordLabel
          ? null
          : {type: 'label', label: coordLabel}
      this.setState({
        editWorkspace: {...ws, [markerKey]: markerMap},
      })
    } else if (tool === 'number') {
      let markerMap = ws[markerKey].map((row) => [...row])
      let existing = markerMap[vy]?.[vx]
      let currentNum =
        existing?.type === 'label' ? parseInt(existing.label, 10) : 0
      if (currentNum > 0 && Number.isFinite(currentNum)) {
        markerMap[vy][vx] = null
      } else {
        // Find next available number
        let usedNums = new Set()
        for (let row of markerMap) {
          for (let cell of row) {
            if (cell?.type === 'label') {
              let n = parseInt(cell.label, 10)
              if (Number.isFinite(n) && n > 0) usedNums.add(n)
            }
          }
        }
        let next = 1
        while (usedNums.has(next)) next++
        markerMap[vy][vx] = {type: 'label', label: `${next}`}
      }
      this.setState({
        editWorkspace: {...ws, [markerKey]: markerMap},
      })
    }
  }

  clickEditWorkspaceVertex(vertex, options = {}) {
    return this.scratchEdit(vertex, options)
  }

  captureEditReference() {
    let ws = this.state.editWorkspace
    if (ws == null) return

    let sourceTab =
      ws.activeTab === 'reference' && ws.referenceSnapshot != null
        ? 'reference'
        : 'current'
    let targetTab = sourceTab === 'reference' ? 'current' : 'reference'
    let {snapshotKey: sourceSnapshotKey} =
      this.getEditWorkspaceTabKeys(sourceTab)
    let {
      snapshotKey: targetSnapshotKey,
      analysisKey: targetAnalysisKey,
      ownershipKey: targetOwnershipKey,
      markerKey: targetMarkerKey,
      linesKey: targetLinesKey,
    } = this.getEditWorkspaceTabKeys(targetTab)
    let sourceSnapshot = ws[sourceSnapshotKey]
    if (sourceSnapshot == null) return
    let targetRole =
      targetTab === 'reference'
        ? SCRATCH_ROLES.REFERENCE
        : SCRATCH_ROLES.CURRENT
    let targetSnapshot = createScratchPositionFromSnapshot(sourceSnapshot, {
      id: uuid(),
      role: targetRole,
      source: sourceSnapshot.source ?? {
        type: 'manual',
      },
    })

    this.setState({
      editWorkspace: {
        ...ws,
        positionSource: createScratchPositionSource(
          targetSnapshot.id,
          targetRole,
        ),
        [targetSnapshotKey]: targetSnapshot,
        [targetAnalysisKey]: null,
        [targetOwnershipKey]: null,
        [targetMarkerKey]: sourceSnapshot.signMap.map((row) =>
          row.map(() => null),
        ),
        [targetLinesKey]: [],
      },
    })
    this.scheduleEditWorkspaceAnalysis()
    logger.debug('analysis.reference_captured', 'Reference captured', {
      sourceTab,
      targetTab,
    })
  }

  toggleEditTab(tab) {
    let ws = this.state.editWorkspace
    if (ws == null) return
    if (tab !== 'current' && tab !== 'reference') return
    if (tab === 'reference' && ws.referenceSnapshot == null) return

    let {snapshotKey} = this.getEditWorkspaceTabKeys(tab)
    let snapshot = ws[snapshotKey]

    this.setState({
      editWorkspace: {
        ...ws,
        activeTab: tab,
        ...(snapshot?.id == null
          ? null
          : {
              positionSource: createScratchPositionSource(
                snapshot.id,
                snapshot.role ?? tab,
              ),
            }),
      },
    })

    let {analysisKey} = this.getEditWorkspaceTabKeys(tab)
    if (ws[analysisKey] == null) {
      this.scheduleEditWorkspaceAnalysis(tab)
    }
  }

  setEditWorkspacePlayer(sign) {
    let ws = this.state.editWorkspace
    if (ws == null) return

    let {
      snapshotKey: key,
      analysisKey,
      ownershipKey,
    } = this.getEditWorkspaceTabKeys(ws.activeTab)
    let snapshot = ws[key]
    if (snapshot == null) return

    let nextSnapshot = {
      ...cloneSnapshot(snapshot),
      nextPlayer: sign > 0 ? 1 : -1,
    }

    // Phase 10: generation tracking moved into scratchAnalysis.ts

    this.setState({
      editWorkspace: {
        ...ws,
        positionSource: createScratchPositionSource(
          nextSnapshot.id,
          nextSnapshot.role ?? ws.activeTab,
        ),
        [key]: nextSnapshot,
        [analysisKey]: null,
        [ownershipKey]: null,
      },
    })
    this.scheduleEditWorkspaceAnalysis(ws.activeTab)
  }

  scheduleEditWorkspaceAnalysis(targetTab = null) {
    this.getPlayServices().analysisService.scheduleScratchAnalysis(targetTab)
  }

  async refreshEditWorkspaceAnalysis(targetTab = null) {
    return this.getPlayServices().analysisService.refreshScratchAnalysis(
      targetTab,
    )
  }

  handleEditDragEnd({source, target}) {
    let ws = this.state.editWorkspace
    if (ws == null) return

    let {snapshotKey} = this.getEditWorkspaceTabKeys(ws.activeTab)
    let snapshot = ws[snapshotKey]
    if (snapshot == null) return

    let workingBoard = boardFromSnapshot(snapshot)
    if (workingBoard == null) return

    let context = createBoardInteractionContext({
      state: this.state,
      board: workingBoard,
      vertex: target,
      sourceVertex: source,
      event: {button: 0, ctrlKey: false, metaKey: false},
      isMac: helper.isMac,
    })
    if (context == null) return

    let result = resolveBoardInteraction(context)

    let execContext = createScratchEditExecutionContext(ws)
    if (execContext == null) return

    let execResult = executeBoardInteraction(result, execContext)
    if (!execResult.handled) return

    if (execResult.changed || execResult.lineFirstVertex !== undefined) {
      this.commitEditResult(execResult)
    }
  }

  async runBoardAnalysis(opts) {
    return this.getPlayServices().analysisService.runBoardAnalysis(opts)
  }

  async runOwnershipAnalysis(opts) {
    return this.getPlayServices().analysisService.runOwnershipAnalysis(opts)
  }

  getAnalysisSyncerId({requireOwnership = false} = {}) {
    return this.getPlayServices().analysisService.getAnalysisSyncerId({
      requireOwnership,
    })
  }

  toggleTerritoryEnabled() {
    return this.getOverlayStore().toggleTerritoryEnabled()
  }

  toggleTerritoryCompareEnabled() {
    return this.getOverlayStore().toggleTerritoryCompareEnabled()
  }

  getOwnershipForTreePosition(syncer, treePosition) {
    return this.getPlayServices().analysisService.getOwnershipForTreePosition(
      syncer,
      treePosition,
    )
  }

  // History Management

  recordHistory({prevGameIndex, prevTreePosition} = {}) {
    this.getPlayServices().documentStore.recordHistory({
      prevGameIndex,
      prevTreePosition,
    })
  }

  clearHistory() {
    this.getPlayServices().documentStore.clearHistory()
  }

  checkoutHistory(historyPointer) {
    this.getPlayServices().documentStore.checkoutHistory(historyPointer)
  }

  undo() {
    this.getPlayServices().documentStore.undo()
  }

  redo() {
    this.getPlayServices().documentStore.redo()
  }

  // File Management

  getEmptyGameTree() {
    let handicap = setting.get('game.default_handicap')
    let size = setting
      .get('game.default_board_size')
      .toString()
      .split(':')
      .map((x) => +x)
    let [width, height] = [size[0], size.slice(-1)[0]]
    let handicapStones = Board.fromDimensions(width, height)
      .getHandicapPlacement(handicap)
      .map(sgf.stringifyVertex)

    let sizeInfo = width === height ? width.toString() : `${width}:${height}`
    let date = new Date()
    let dateInfo = sgf.stringifyDates([
      [date.getFullYear(), date.getMonth() + 1, date.getDate()],
    ])

    return gametree.new().mutate((draft) => {
      let rootData = {
        GM: ['1'],
        FF: ['4'],
        CA: ['UTF-8'],
        AP: [`${this.appName}:${this.version}`],
        KM: [setting.get('game.default_komi')],
        SZ: [sizeInfo],
        DT: [dateInfo],
      }

      if (handicapStones.length > 0) {
        Object.assign(rootData, {
          HA: [handicap.toString()],
          AB: handicapStones,
        })
      }

      for (let prop in rootData) {
        draft.updateProperty(draft.root.id, prop, rootData[prop])
      }
    })
  }

  normalizeEngineConfig(engine, index = 0) {
    return this.getPlayServices().engineService.normalizeEngineConfig(
      engine,
      index,
    )
  }

  getConfiguredEngine(engineIndex) {
    return this.getPlayServices().engineService.getConfiguredEngine(engineIndex)
  }

  getOrAttachEngine(engineIndex) {
    return this.getPlayServices().engineService.getOrAttachEngine(engineIndex)
  }

  getEngineService() {
    return this.getPlayServices().engineService
  }

  async startConfiguredGame({
    black = {type: 'human'},
    white = {type: 'human'},
    boardSize = '19',
    komi = setting.get('game.default_komi'),
    handicap = setting.get('game.default_handicap'),
    rules = 'chinese',
  } = {}) {
    if (!(await this.askForSave())) return

    setting
      .set('game.default_board_size', boardSize.toString())
      .set('game.default_komi', isNaN(komi) ? 0 : +komi)
      .set('game.default_handicap', isNaN(handicap) ? 0 : +handicap)

    logger.info('game.configuring', 'Configuring new game', {
      black: black.type,
      white: white.type,
      boardSize,
      komi,
      handicap,
      rules,
    })

    let blackSyncer =
      black.type === 'engine' ? this.getOrAttachEngine(black.engineIndex) : null
    let whiteSyncer =
      white.type === 'engine' ? this.getOrAttachEngine(white.engineIndex) : null

    logger.info('game.engines_resolved', 'Engines resolved', {
      blackSyncer: blackSyncer
        ? {
            id: blackSyncer.id,
            name: blackSyncer.engine.name,
            commands: blackSyncer.commands.length,
          }
        : null,
      whiteSyncer: whiteSyncer
        ? {
            id: whiteSyncer.id,
            name: whiteSyncer.engine.name,
            commands: whiteSyncer.commands.length,
          }
        : null,
    })

    let emptyTree = gametree.setGameInfo(this.getEmptyGameTree(), {
      blackName: blackSyncer?.engine.name || null,
      whiteName: whiteSyncer?.engine.name || null,
      rules,
      komi,
      handicap,
      size: boardSize
        .toString()
        .split(':')
        .map((x) => +x),
    })

    await this.loadGameTrees([emptyTree], {suppressAskForSave: true})

    this.closeDrawer()
    this.getPlayServices().engineService.setBlackWhiteSyncerIds(
      blackSyncer?.id || null,
      whiteSyncer?.id || null,
    )

    if (blackSyncer != null || whiteSyncer != null) {
      logger.info('engine.waiting', 'Waiting for engines to be ready', {
        engines: [blackSyncer, whiteSyncer]
          .filter((s) => s != null)
          .map((s) => ({name: s.engine.name, commands: s.commands.length})),
      })

      let results = await Promise.all(
        [blackSyncer, whiteSyncer]
          .filter((syncer) => syncer != null)
          .map((syncer) => this.waitForEngineCommands(syncer, {timeout: 5000})),
      )

      logger.info('engine.ready_results', 'Engine readiness results', {
        results,
        engines: [blackSyncer, whiteSyncer]
          .filter((s) => s != null)
          .map((s) => ({
            name: s.engine.name,
            commands: s.commands.length,
            busy: s.busy,
            suspended: s._suspended,
          })),
      })
    }

    let treePosition = this.state.treePosition
    let nextPlayer = this.getPlayer(treePosition)

    logger.info('game.starting', 'Starting game play', {
      nextPlayer: nextPlayer > 0 ? 'black' : 'white',
      treePosition,
      engineGame: blackSyncer != null && whiteSyncer != null,
    })

    if (blackSyncer != null && whiteSyncer != null) {
      this.getPlayServices().engineService.startEngineGame(treePosition)
    } else if (nextPlayer > 0 && blackSyncer != null) {
      this.getPlayServices().engineService.generateMove(
        blackSyncer.id,
        treePosition,
      )
    } else if (nextPlayer < 0 && whiteSyncer != null) {
      this.getPlayServices().engineService.generateMove(
        whiteSyncer.id,
        treePosition,
      )
    }

    sound.playNewGame()
    logger.info('game.started', 'New game started', {
      black: blackSyncer?.engine.name || 'Human',
      white: whiteSyncer?.engine.name || 'Human',
      boardSize,
    })

    // Start training monitor when playing against an engine
    if (blackSyncer != null || whiteSyncer != null) {
      this.startEngineGameTraining().catch((err) => {
        logger.info('engineGame.training.start.error', 'Failed to start training', {
          error: String(err),
        })
      })
    }
  }

  async newFile({
    playSound = false,
    showInfo = false,
    suppressAskForSave = false,
  } = {}) {
    if (!suppressAskForSave && !(await this.askForSave())) return

    logger.info('file.new', 'New file created')

    let [blackName, whiteName] = [
      this.getPlayServices().engineService.getBlackSyncerId(),
      this.getPlayServices().engineService.getWhiteSyncerId(),
    ]
      .map((id) =>
        this.getPlayServices()
          .engineService.getAttachedSyncers()
          .find((syncer) => syncer.id === id),
      )
      .map((syncer) => (syncer == null ? null : syncer.engine.name))

    let emptyTree = gametree.setGameInfo(this.getEmptyGameTree(), {
      blackName,
      whiteName,
    })

    await this.loadGameTrees([emptyTree], {suppressAskForSave: true})

    if (showInfo) this.openDrawer('info')
    if (playSound) sound.playNewGame()
  }

  async loadFile(
    filename = null,
    {suppressAskForSave = false, clearHistory = true} = {},
  ) {
    if (!suppressAskForSave && !(await this.askForSave())) return

    logger.info('file.loading', 'Loading file', {filename})

    let t = i18n.context('sabaki.file')

    if (!filename) {
      let result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          ...fileformats.meta,
          {name: t('All Files'), extensions: ['*']},
        ],
      })

      if (result) filename = result[0]
      if (filename)
        this.loadFile(filename, {suppressAskForSave: true, clearHistory})

      return
    }

    this.setBusy(true)

    let extension = extname(filename).slice(1)
    let gameTrees = []
    let success = true
    let lastProgress = -1

    try {
      let fileFormatModule = fileformats.getModuleByExtension(extension)

      gameTrees = fileFormatModule.parseFile(filename, (evt) => {
        if (evt.progress - lastProgress < 0.1) return
        this.window.setProgressBar(evt.progress)
        lastProgress = evt.progress
      })

      if (gameTrees.length == 0) throw true
    } catch (err) {
      await dialog.showMessageBox(t('This file is unreadable.'), 'warning')
      success = false
    }

    if (success) {
      await this.loadGameTrees(gameTrees, {
        suppressAskForSave: true,
        clearHistory,
      })

      this.setState({representedFilename: filename})
      this.fileHash = this.generateFileHash()

      if (setting.get('game.goto_end_after_loading')) {
        this.goToEnd()
      }
    }

    this.setBusy(false)
  }

  async loadContent(content, extension, options = {}) {
    this.setBusy(true)

    let t = i18n.context('sabaki.file')
    let gameTrees = []
    let success = true
    let lastProgress = -1

    try {
      let fileFormatModule = fileformats.getModuleByExtension(extension)

      gameTrees = fileFormatModule.parse(content, (evt) => {
        if (evt.progress - lastProgress < 0.1) return
        this.window.setProgressBar(evt.progress)
        lastProgress = evt.progress
      })

      if (gameTrees.length == 0) throw true
    } catch (err) {
      await dialog.showMessageBox(t('This file is unreadable.'), 'warning')
      success = false
    }

    if (success) {
      await this.loadGameTrees(gameTrees, options)
    }

    this.setBusy(false)
  }

  async loadGameTrees(
    gameTrees,
    {suppressAskForSave = false, clearHistory = true} = {},
  ) {
    if (!suppressAskForSave && !(await this.askForSave())) return

    this.setBusy(true)
    if (this.state.openDrawer !== 'gamechooser') this.closeDrawer()
    this.setMode('play')

    await helper.wait(setting.get('app.loadgame_delay'))

    if (gameTrees.length > 0) {
      this.setState({
        representedFilename: null,
        gameIndex: 0,
        gameTrees,
        gameCurrents: gameTrees.map((_) => ({})),
        boardTransformation: '',
      })

      let [firstTree] = gameTrees
      this.setCurrentTreePosition(firstTree, firstTree.root.id, {
        clearCache: true,
      })

      this.treeHash = this.generateTreeHash()
      this.fileHash = this.generateFileHash()

      if (clearHistory) this.clearHistory()
    }

    this.setBusy(false)
    this.window.setProgressBar(-1)
    this.events.emit('fileLoad')

    logger.info('file.loaded', 'File loaded', {
      filename: this.state.representedFilename,
      count: gameTrees.length,
    })

    if (gameTrees.length > 1) {
      await helper.wait(setting.get('gamechooser.show_delay'))
      this.openDrawer('gamechooser')
    }
  }

  async saveFile(filename = null, confirmExtension = true) {
    let t = i18n.context('sabaki.file')

    if (!filename || (confirmExtension && extname(filename) !== '.sgf')) {
      let cancel = false
      let result = await dialog.showSaveDialog({
        filters: [
          fileformats.sgf.meta,
          {name: t('All Files'), extensions: ['*']},
        ],
      })

      if (result) await this.saveFile(result, false)
      cancel = !result

      return !cancel
    }

    this.setBusy(true)
    fs.writeFileSync(filename, this.getSGF())

    this.setBusy(false)
    this.setState({representedFilename: filename})

    this.treeHash = this.generateTreeHash()
    this.fileHash = this.generateFileHash()

    return true
  }

  getSGF() {
    let {gameTrees} = this.state

    gameTrees = gameTrees.map((tree) =>
      tree.mutate((draft) => {
        draft.updateProperty(draft.root.id, 'AP', [
          `${this.appName}:${this.version}`,
        ])
        draft.updateProperty(draft.root.id, 'CA', ['UTF-8'])
      }),
    )

    this.setState({gameTrees})
    this.recordHistory()

    return sgf.stringify(
      gameTrees.map((tree) => tree.root),
      {
        linebreak: setting.get('sgf.format_code') ? helper.linebreak : '',
      },
    )
  }

  getBoardAscii() {
    let {boardTransformation} = this.state
    let tree = this.state.gameTrees[this.state.gameIndex]
    let board = gametree.getBoard(tree, this.state.treePosition)
    let signMap = gobantransformer.transformMap(
      board.signMap,
      boardTransformation,
    )
    let markerMap = gobantransformer.transformMap(
      board.markers,
      boardTransformation,
    )
    let lines = board.lines.map((l) =>
      gobantransformer.transformLine(
        l,
        boardTransformation,
        board.width,
        board.height,
      ),
    )

    let height = signMap.length
    let width = height === 0 ? 0 : signMap[0].length
    let result = []
    let lb = helper.linebreak

    let getIndexFromVertex = ([x, y]) => {
      let rowLength = 4 + width * 2
      return rowLength + rowLength * y + 1 + x * 2 + 1
    }

    // Make empty board

    result.push('+')
    for (let x = 0; x < width; x++) result.push('-', '-')
    result.push('-', '+', lb)

    for (let y = 0; y < height; y++) {
      result.push('|')
      for (let x = 0; x < width; x++) result.push(' ', '.')
      result.push(' ', '|', lb)
    }

    result.push('+')
    for (let x = 0; x < width; x++) result.push('-', '-')
    result.push('-', '+', lb)

    for (let vertex of board.getHandicapPlacement(9)) {
      result[getIndexFromVertex(vertex)] = ','
    }

    // Place markers & stones

    let data = {
      plain: ['O', null, 'X'],
      circle: ['W', 'C', 'B'],
      square: ['@', 'S', '#'],
      triangle: ['Q', 'T', 'Y'],
      cross: ['P', 'M', 'Z'],
      label: ['O', null, 'X'],
    }

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let i = getIndexFromVertex([x, y])
        let s = signMap[y][x]

        if (!markerMap[y][x] || !(markerMap[y][x].type in data)) {
          if (s !== 0) result[i] = data.plain[s + 1]
        } else {
          let {type, label} = markerMap[y][x]

          if (type !== 'label' || s !== 0) {
            result[i] = data[type][s + 1]
          } else if (
            s === 0 &&
            label.length === 1 &&
            isNaN(parseFloat(label))
          ) {
            result[i] = label.toLowerCase()
          }
        }
      }
    }

    result = result.join('')

    // Add lines & arrows

    for (let {v1, v2, type} of lines) {
      result += `{${type === 'arrow' ? 'AR' : 'LN'} ${board.stringifyVertex(
        v1,
      )} ${board.stringifyVertex(v2)}}${lb}`
    }

    return (lb + result.trim())
      .split(lb)
      .map((l) => `$$ ${l}`)
      .join(lb)
  }

  generateTreeHash() {
    return this.state.gameTrees.map((tree) => tree.getHash()).join('-')
  }

  generateFileHash() {
    let {representedFilename} = this.state
    if (!representedFilename) return null

    try {
      let content = fs.readFileSync(representedFilename, 'utf8')
      return helper.hash(content)
    } catch (err) {}

    return null
  }

  async askForSave() {
    let t = i18n.context('sabaki.file')
    let hash = this.generateTreeHash()

    if (hash !== this.treeHash) {
      let answer = await dialog.showMessageBox(
        t('Your changes will be lost if you close this file without saving.'),
        'warning',
        [t('Save'), t("Don't Save"), t('Cancel')],
        2,
      )

      if (answer === 0) return this.saveFile(this.state.representedFilename)
      else if (answer === 2) return false
    }

    return true
  }

  async askForReload() {
    let t = i18n.context('sabaki.file')
    let hash = this.generateFileHash()

    if (hash != null && hash !== this.fileHash) {
      let answer = await dialog.showMessageBox(
        t(
          (p) =>
            [
              `This file has been changed outside of ${p.appName}.`,
              'Do you want to reload the file? Your changes will be lost.',
            ].join('\n'),
          {appName: this.appName},
        ),
        'warning',
        [t('Reload'), t("Don't Reload")],
        1,
      )

      if (answer === 0) {
        this.loadFile(this.state.representedFilename, {
          suppressAskForSave: true,
          clearHistory: false,
        })
      } else {
        this.treeHash = null
      }

      this.fileHash = hash
    }
  }

  // Playing

  playMove(vertex, options = {}) {
    return this.makeMove(vertex, options)
  }

  variationMove(vertex, options = {}) {
    return this.makeMove(vertex, {...options, generateEngineMove: false})
  }

  recallAnswer(vertex) {
    return this.handleRecallMove(vertex)
  }

  clickVertex(
    vertex,
    {button = 0, ctrlKey = false, metaKey = false, x = 0, y = 0} = {},
  ) {
    this.closeDrawer()

    let t = i18n.context('sabaki.play')
    let {gameTrees, gameIndex, gameCurrents, treePosition} = this.state
    let tree = gameTrees[gameIndex]
    let board = gametree.getBoard(tree, treePosition)
    let node = tree.get(treePosition)

    if (typeof vertex == 'string') {
      vertex = board.parseVertex(vertex)
    }

    let [vx, vy] = vertex

    if (['play', 'autoplay'].includes(this.state.mode)) {
      // Problem tab intercept: if problemView is active, route to problem move handler
      if (this.state.mode === 'play' && button === 0) {
        let pv = this.getTrainingContext().runtimeStore.getState().problemView
        if (pv && !pv.submitted && board.get(vertex) === 0) {
          this.handleProblemMove(vertex)
          return
        }
      }

      // Phase 8: async play router for play mode left-click empty point
      if (this.state.mode === 'play') {
        let playCtx = createBoardInteractionContext({
          state: this.state,
          board,
          vertex,
          event: {button, ctrlKey, metaKey},
          isMac: helper.isMac,
        })

        if (playCtx != null) {
          let playResult = resolveBoardInteraction(playCtx)

          if (
            playResult.status === RESOLVE_STATUSES.RESOLVED &&
            playResult.intent === 'play-stone' &&
            playResult.mutationContract === 'playMove'
          ) {
            this.executePlayMove(playResult)
            return
          }
        }

        // noop/deferred: fall through to legacy play handling
      }

      if (button === 0 && !(helper.isMac && ctrlKey)) {
        if (board.get(vertex) === 0) {
          this.playMove(vertex, {
            generateEngineMove:
              !this.getPlayServices().engineService.isEngineGameRunning(),
          })
        } else if (
          board.markers[vy][vx] != null &&
          board.markers[vy][vx].type === 'point' &&
          setting.get('edit.click_currentvertex_to_remove')
        ) {
          this.removeNode(treePosition)
        }
      } else if (button === 2 || (helper.isMac && button === 0 && ctrlKey)) {
        if (
          board.markers[vy][vx] != null &&
          board.markers[vy][vx].type === 'point'
        ) {
          // Show annotation context menu

          this.openCommentMenu(treePosition, {x, y})
        } else if (
          this.getPlayServices().engineService.getAnalysisForPosition(
            this.state.treePosition,
          ) != null
        ) {
          // Show analysis context menu

          let {sign, variations} =
            this.getPlayServices().engineService.getAnalysisForPosition(
              this.state.treePosition,
            )
          let variation = variations.find((x) =>
            helper.vertexEquals(x.vertex, vertex),
          )

          if (variation != null) {
            let maxVisitsWin = Math.max(
              ...variations.map((x) => x.visits * x.winrate),
            )
            let strength =
              Math.round(
                (variation.visits * variation.winrate * 8) / maxVisitsWin,
              ) + 1
            let annotationProp =
              strength >= 8
                ? 'TE'
                : strength >= 5
                  ? 'IT'
                  : strength >= 3
                    ? 'DO'
                    : 'BM'
            let annotationValues = {BM: '1', DO: '', IT: '', TE: '1'}
            let winrate =
              Math.round(
                (sign > 0 ? variation.winrate : 100 - variation.winrate) * 100,
              ) / 100

            this.openVariationMenu(sign, variation.moves, {
              x,
              y,
              startNodeProperties: {
                [annotationProp]: [annotationValues[annotationProp]],
                SBKV: [winrate.toString()],
              },
            })
          }
        }
      }
    } else if (this.state.mode === 'analysis') {
      if (this.state.editWorkspace != null) {
        if (this.handleEditAnalysisClick(vertex, {button, ctrlKey})) {
          return
        }

        this.scratchEdit(vertex, {button, ctrlKey, x, y})
        return
      }

      // Legacy edit path (fallback when no workspace)
      if (helper.isMac ? metaKey : ctrlKey) {
        // Add coordinates to comment

        let coord = board.stringifyVertex(vertex)
        let commentText = node.data.C ? node.data.C[0] : ''

        let newTree = tree.mutate((draft) => {
          draft.updateProperty(
            node.id,
            'C',
            commentText !== '' ? [commentText.trim() + ' ' + coord] : [coord],
          )
        })

        this.setCurrentTreePosition(newTree, node.id)
        return
      }

      let tool = this.state.selectedTool

      if (button === 2 || (helper.isMac && button === 0 && ctrlKey)) {
        // Right mouse click

        if (['stone_1', 'stone_-1'].includes(tool)) {
          // Switch stone tool

          tool = tool === 'stone_1' ? 'stone_-1' : 'stone_1'
        } else if (['number', 'label'].includes(tool)) {
          // Show label editing context menu

          helper.popupMenu(
            [
              {
                label: t('&Edit Label'),
                click: async () => {
                  let value = await dialog.showInputBox(t('Enter label text'))
                  if (value == null) return

                  this.useTool('label', vertex, value)
                },
              },
            ],
            x,
            y,
          )

          return
        }
      }

      if (['line', 'arrow'].includes(tool)) {
        // Remember clicked vertex and pass as an argument the second time

        if (!this.editVertexData || this.editVertexData[0] !== tool) {
          this.useTool(tool, vertex)
          this.editVertexData = [tool, vertex]
        } else {
          this.useTool(tool, this.editVertexData[1], vertex)
          this.editVertexData = null
        }
      } else {
        this.useTool(tool, vertex)
        this.editVertexData = null
      }
    } else if (['scoring', 'estimator'].includes(this.state.mode)) {
      if (button !== 0 || board.get(vertex) === 0) return

      let {mode, deadStones} = this.state
      let dead = deadStones.some((v) => helper.vertexEquals(v, vertex))
      let stones =
        mode === 'estimator'
          ? board.getChain(vertex)
          : board.getRelatedChains(vertex)

      if (!dead) {
        deadStones = [...deadStones, ...stones]
      } else {
        deadStones = deadStones.filter(
          (v) => !stones.some((w) => helper.vertexEquals(v, w)),
        )
      }

      this.setState({deadStones})
    } else if (this.state.mode === 'find') {
      if (button !== 0) return

      if (helper.vertexEquals(this.state.findVertex || [-1, -1], vertex)) {
        this.setState({findVertex: null})
      } else {
        this.setState({findVertex: vertex})
        this.findMove(1, {vertex, text: this.state.findText})
      }
    } else if (this.state.mode === 'recall') {
      if (button !== 0) return
      if (board.get(vertex) === 0) {
        this.handleRecallMove(vertex)
      }
    }

    this.events.emit('vertexClick')
  }

  async makeMove(vertex, {player = null, generateEngineMove = null} = {}) {
    if (!['play', 'autoplay'].includes(this.state.mode)) {
      this.closeDrawer()
      this.setMode('play')
    }

    if (generateEngineMove == null) {
      generateEngineMove =
        !this.getPlayServices().engineService.isEngineGameRunning()
    }

    let t = i18n.context('sabaki.play')
    let {gameTrees, gameIndex, treePosition} = this.state
    let tree = gameTrees[gameIndex]
    let node = tree.get(treePosition)
    let board = gametree.getBoard(tree, treePosition)

    if (!player) player = this.getPlayer(treePosition)
    if (typeof vertex == 'string') vertex = board.parseVertex(vertex)

    let {pass, overwrite, capturing, suicide} = board.analyzeMove(
      player,
      vertex,
    )
    if (!pass && overwrite) return

    let prev = tree.get(node.parentId)
    let color = player > 0 ? 'B' : 'W'
    let ko = false

    if (!pass) {
      if (prev != null && setting.get('game.show_ko_warning')) {
        let nextBoard = board.makeMove(player, vertex)
        let prevBoard = gametree.getBoard(tree, prev.id)

        ko = helper.equals(prevBoard.signMap, nextBoard.signMap)

        if (ko) {
          let answer = await dialog.showMessageBox(
            t(
              [
                'You are about to play a move which repeats a previous board position.',
                'This is invalid in some rulesets.',
              ].join('\n'),
            ),
            'info',
            [t('Play Anyway'), t("Don't Play")],
            1,
          )
          if (answer !== 0) return
        }
      }

      if (suicide && setting.get('game.show_suicide_warning')) {
        let answer = await dialog.showMessageBox(
          t(
            [
              'You are about to play a suicide move.',
              'This is invalid in some rulesets.',
            ].join('\n'),
          ),
          'info',
          [t('Play Anyway'), t("Don't Play")],
          1,
        )
        if (answer !== 0) return
      }
    }

    // Update data

    let nextTreePosition
    let newTree = tree.mutate((draft) => {
      nextTreePosition = draft.appendNode(treePosition, {
        [color]: [sgf.stringifyVertex(vertex)],
      })
    })

    let createNode = tree.get(nextTreePosition) == null

    this.setCurrentTreePosition(newTree, nextTreePosition)

    // Play sounds

    if (!pass) {
      sound.playPachi()
      if (capturing || suicide) sound.playCapture()
      logger.debug('game.move', 'Stone placed', {
        color,
        vertex: sgf.stringifyVertex(vertex),
      })
    } else {
      sound.playPass()
      logger.debug('game.pass', 'Pass', {color})
    }

    // Enter scoring mode after two consecutive passes

    let enterScoring = false

    if (pass && createNode && prev != null) {
      let prevColor = color === 'B' ? 'W' : 'B'
      let prevPass =
        node.data[prevColor] != null && node.data[prevColor][0] === ''

      if (prevPass) {
        enterScoring = false
        logger.info(
          'game.double_pass',
          'Double pass detected, saving and entering recall',
        )
        this.stopEngineGame()
        await this.stopEngineGameTraining()
        let saved = await this.saveCurrentGame()
        if (saved?.id) {
          this.startRecallSession(saved.id)
        }
        return
      }
    }

    // Emit event

    this.events.emit('moveMake', {pass, capturing, suicide, ko, enterScoring})

    // Generate move

    if (generateEngineMove && !enterScoring) {
      this.getPlayServices().engineService.generateMove(
        player > 0
          ? this.getPlayServices().engineService.getWhiteSyncerId()
          : this.getPlayServices().engineService.getBlackSyncerId(),
        nextTreePosition,
      )
    }
  }

  async makeResign({player = null} = {}) {
    let {gameTrees, gameIndex, treePosition} = this.state
    let {currentPlayer} = this.inferredState
    if (player == null) player = currentPlayer
    let color = player > 0 ? 'W' : 'B'
    let tree = gameTrees[gameIndex]

    logger.info('game.resign', `${color} resigned`, {
      color,
      player,
    })

    let newTree = tree.mutate((draft) => {
      draft.updateProperty(draft.root.id, 'RE', [`${color}+Resign`])
    })

    this.makeMainVariation(treePosition)
    this.makeMove([-1, -1], {player, generateEngineMove: false})

    this.events.emit('resign', {player})

    await this.stopEngineGameTraining()
    let saved = await this.saveCurrentGame()
    if (saved?.id) {
      this.startRecallSession(saved.id)
    }
  }

  useTool(tool, vertex, argument = null) {
    let {gameTrees, gameIndex, treePosition} = this.state
    let {currentPlayer} = this.inferredState
    let tree = gameTrees[gameIndex]
    let board = gametree.getBoard(tree, treePosition)
    let node = tree.get(treePosition)

    if (typeof vertex == 'string') {
      vertex = board.parseVertex(vertex)
    }

    let data = {
      cross: 'MA',
      triangle: 'TR',
      circle: 'CR',
      square: 'SQ',
      number: 'LB',
      label: 'LB',
    }

    let newTree = tree.mutate((draft) => {
      if (['stone_-1', 'stone_1'].includes(tool)) {
        if (
          node.data.B != null ||
          node.data.W != null ||
          node.children.length > 0
        ) {
          // New child needed

          let id = draft.appendNode(treePosition, {
            PL: currentPlayer > 0 ? ['B'] : ['W'],
          })
          node = draft.get(id)
        }

        let sign = tool === 'stone_1' ? 1 : -1
        let oldSign = board.get(vertex)
        let properties = ['AW', 'AE', 'AB']
        let point = sgf.stringifyVertex(vertex)

        for (let prop of properties) {
          if (node.data[prop] == null) continue

          // Resolve compressed lists

          if (node.data[prop].some((x) => x.includes(':'))) {
            draft.updateProperty(
              node.id,
              prop,
              node.data[prop]
                .map((value) =>
                  sgf.parseCompressedVertices(value).map(sgf.stringifyVertex),
                )
                .reduce((list, x) => [...list, x]),
            )
          }

          // Remove residue

          draft.removeFromProperty(node.id, prop, point)
        }

        let prop = oldSign !== sign ? properties[sign + 1] : 'AE'
        draft.addToProperty(node.id, prop, point)
      } else if (['line', 'arrow'].includes(tool)) {
        let endVertex = argument
        if (!endVertex || helper.vertexEquals(vertex, endVertex)) return

        // Check whether to remove a line

        let toDelete = board.lines.findIndex((x) =>
          helper.equals([x.v1, x.v2], [vertex, endVertex]),
        )

        if (toDelete === -1) {
          toDelete = board.lines.findIndex((x) =>
            helper.equals([x.v1, x.v2], [endVertex, vertex]),
          )

          if (
            toDelete >= 0 &&
            tool !== 'line' &&
            board.lines[toDelete].type === 'arrow'
          ) {
            // Do not delete after all
            toDelete = -1
          }
        }

        // Mutate board first, then apply changes to actual game tree

        if (toDelete >= 0) {
          board.lines.splice(toDelete, 1)
        } else {
          board.lines.push({v1: vertex, v2: endVertex, type: tool})
        }

        draft.removeProperty(node.id, 'AR')
        draft.removeProperty(node.id, 'LN')

        for (let {v1, v2, type} of board.lines) {
          let [p1, p2] = [v1, v2].map(sgf.stringifyVertex)
          if (p1 === p2) continue

          draft.addToProperty(
            node.id,
            type === 'arrow' ? 'AR' : 'LN',
            [p1, p2].join(':'),
          )
        }
      } else {
        // Mutate board first, then apply changes to actual game tree

        let [x, y] = vertex

        if (tool === 'number') {
          if (
            board.markers[y][x] != null &&
            board.markers[y][x].type === 'label'
          ) {
            board.markers[y][x] = null
          } else {
            let number =
              node.data.LB == null
                ? 1
                : node.data.LB.map((x) => parseFloat(x.slice(3)))
                    .filter((x) => !isNaN(x))
                    .sort((a, b) => a - b)
                    .filter((x, i, arr) => i === 0 || x !== arr[i - 1])
                    .concat([null])
                    .findIndex((x, i) => i + 1 !== x) + 1

            argument = number.toString()
            board.markers[y][x] = {type: tool, label: number.toString()}
          }
        } else if (tool === 'label') {
          let label = argument

          if (
            (label != null && label.trim() === '') ||
            (label == null &&
              board.markers[y][x] != null &&
              board.markers[y][x].type === 'label')
          ) {
            board.markers[y][x] = null
          } else {
            if (label == null) {
              let alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
              let letterIndex = Math.max(
                node.data.LB == null
                  ? 0
                  : node.data.LB.filter((x) => x.length === 4)
                      .map((x) => alpha.indexOf(x[3]))
                      .filter((x) => x >= 0)
                      .sort((a, b) => a - b)
                      .filter((x, i, arr) => i === 0 || x !== arr[i - 1])
                      .concat([null])
                      .findIndex((x, i) => i !== x),
                node.data.L == null ? 0 : node.data.L.length,
              )

              label = alpha[Math.min(letterIndex, alpha.length - 1)]
              argument = label
            }

            board.markers[y][x] = {type: tool, label}
          }
        } else {
          if (
            board.markers[y][x] != null &&
            board.markers[y][x].type === tool
          ) {
            board.markers[y][x] = null
          } else {
            board.markers[y][x] = {type: tool}
          }
        }

        draft.removeProperty(node.id, 'L')
        for (let id in data) draft.removeProperty(node.id, data[id])

        // Now apply changes to game tree

        for (let x = 0; x < board.width; x++) {
          for (let y = 0; y < board.height; y++) {
            let v = [x, y]
            if (board.markers[y][x] == null) continue

            let prop = data[board.markers[y][x].type]
            let value = sgf.stringifyVertex(v)
            if (prop === 'LB') value += ':' + board.markers[y][x].label

            draft.addToProperty(node.id, prop, value)
          }
        }
      }
    })

    this.setCurrentTreePosition(newTree, node.id)

    this.events.emit('toolUse', {tool, vertex, argument})
  }

  // Navigation

  setCurrentTreePosition(tree, treePosition, options) {
    this.getPlayServices().documentStore.setCurrentTreePosition(
      tree,
      treePosition,
      options,
    )
  }

  goStep(step) {
    this.getPlayServices().documentStore.goStep(step)
  }

  goToMoveNumber(number) {
    this.getPlayServices().documentStore.goToMoveNumber(number)
  }

  goToNextFork() {
    this.getPlayServices().documentStore.goToNextFork()
  }

  goToPreviousFork() {
    this.getPlayServices().documentStore.goToPreviousFork()
  }

  goToComment(step) {
    this.getPlayServices().documentStore.goToComment(step)
  }

  goToBeginning() {
    this.getPlayServices().documentStore.goToBeginning()
  }

  goToEnd() {
    this.getPlayServices().documentStore.goToEnd()
  }

  goToSiblingVariation(step) {
    this.getPlayServices().documentStore.goToSiblingVariation(step)
  }

  changeDownstreamVariation(step) {
    this.getPlayServices().documentStore.changeDownstreamVariation(step)
  }

  goToMainVariation() {
    this.getPlayServices().documentStore.goToMainVariation()
  }

  goToSiblingGame(step) {
    this.getPlayServices().documentStore.goToSiblingGame(step)
  }

  startAutoscrolling(step) {
    this.getPlayServices().documentStore.startAutoscrolling(step)
  }

  stopAutoscrolling() {
    this.getPlayServices().documentStore.stopAutoscrolling()
  }

  // Engine Management — delegated to engineService (state owned there)
  // Callers should access engineService directly via getPlayServices().engineService

  async analyzeMove(treePosition) {
    return this.getPlayServices().analysisService.analyzeGameTreePosition(
      treePosition,
    )
  }

  scheduleLiveAnalysis(treePosition) {
    this.getPlayServices().analysisService.scheduleGameTreeAnalysis(
      treePosition,
    )
  }

  async quickAnalyzeAllNodes() {
    return this.getPlayServices().engineService.quickAnalyzeAllNodes()
  }

  stopQuickAnalysis() {
    this.getPlayServices().engineService.stopQuickAnalysis()
  }

  // Find Methods

  async findPosition(step, condition) {
    if (isNaN(step)) step = 1
    else step = step >= 0 ? 1 : -1

    this.setBusy(true)
    await helper.wait(setting.get('find.delay'))

    let {gameTrees, gameIndex, treePosition} = this.state
    let tree = gameTrees[gameIndex]
    let node = tree.get(treePosition)

    function* listNodes() {
      let iterator = tree.listNodesHorizontally(treePosition, step)
      iterator.next()

      yield* iterator

      let node =
        step > 0
          ? tree.root
          : [...tree.getSection(tree.getHeight() - 1)].slice(-1)[0]

      yield* tree.listNodesHorizontally(node.id, step)
    }

    for (node of listNodes()) {
      if (node.id === treePosition || condition(node)) break
    }

    this.setCurrentTreePosition(tree, node.id)
    this.setBusy(false)
  }

  async findHotspot(step) {
    await this.findPosition(step, (node) => node.data.HO != null)
  }

  async findMove(step, {vertex = null, text = ''}) {
    if (vertex == null && text.trim() === '') return
    let point = vertex ? sgf.stringifyVertex(vertex) : null

    await this.findPosition(step, (node) => {
      let cond = (prop, value) =>
        node.data[prop] != null &&
        node.data[prop][0].toLowerCase().includes(value.toLowerCase())

      return (
        (!point || ['B', 'W'].some((x) => cond(x, point))) &&
        (!text || cond('C', text) || cond('N', text))
      )
    })
  }

  // View

  setBoardTransformation(transformation) {
    this.setState({
      boardTransformation: gobantransformer.normalize(transformation),
    })
  }

  pushBoardTransformation(transformation) {
    this.setState(({boardTransformation}) => ({
      boardTransformation: gobantransformer.normalize(
        boardTransformation + transformation,
      ),
    }))
  }

  // Node Actions

  getGameInfo() {
    return this.getPlayServices().documentStore.getGameInfo()
  }

  setGameInfo(data) {
    return this.getPlayServices().documentStore.setGameInfo(data)
  }

  getPlayer(treePosition) {
    return this.getPlayServices().documentStore.getPlayer(treePosition)
  }

  setAnalysisArea(vertices) {
    this.getAnalysisAreaStore().setAnalysisArea(vertices)
    this.setState({highlightVertices: []})
  }

  setAnalysisAreaRects(rects, vertices) {
    this.getAnalysisAreaStore().setAnalysisAreaRects(rects, vertices)
    this.setState({highlightVertices: []})
  }

  clearAnalysisArea() {
    this.getAnalysisAreaStore().clearAnalysisArea()
    this.setState({highlightVertices: []})
  }

  toggleAreaSelectMode() {
    if (this.state.mode !== 'analysis') return
    this.getAnalysisAreaStore().toggleAreaSelectMode()
  }

  async toggleShowAISuggestions() {
    if (this.state.mode !== 'analysis') return

    let value = !this.state.showAISuggestions
    setting.set('board.show_ai_suggestions', value)
    let analysisValue = value || this.state.showHumanPreference
    setting.set('board.show_analysis', analysisValue)
    this.setState({
      showAISuggestions: value,
      showAnalysis: analysisValue,
    })

    if (value) {
      await this.ensureAnalysisReady()
    }
  }

  async toggleShowHumanPreference() {
    if (this.state.mode !== 'analysis') return

    let value = !this.state.showHumanPreference
    setting.set('board.show_human_preference', value)
    let analysisValue = value || this.state.showAISuggestions
    setting.set('board.show_analysis', analysisValue)
    this.setState({
      showHumanPreference: value,
      showAnalysis: analysisValue,
    })

    if (value) {
      await this.ensureAnalysisReady()
    }
  }

  setSelectedAnalysisVertex(vertex) {
    this.setState({selectedAnalysisVertex: vertex})
  }

  playAnalysisVariation(sign, moves) {
    return this.getPlayServices().documentStore.playAnalysisVariation(
      sign,
      moves,
    )
  }

  setPlayer(treePosition, sign) {
    return this.getPlayServices().documentStore.setPlayer(treePosition, sign)
  }

  getComment(treePosition) {
    return this.getPlayServices().documentStore.getComment(treePosition)
  }

  setComment(treePosition, data) {
    return this.getPlayServices().documentStore.setComment(treePosition, data)
  }

  copyVariation(treePosition) {
    return this.getPlayServices().documentStore.copyVariation(treePosition)
  }

  cutVariation(treePosition) {
    return this.getPlayServices().documentStore.cutVariation(treePosition)
  }

  pasteVariation(treePosition) {
    return this.getPlayServices().documentStore.pasteVariation(treePosition)
  }

  flattenVariation(treePosition) {
    return this.getPlayServices().documentStore.flattenVariation(treePosition)
  }

  snapshotAsNewGame() {
    return this.getPlayServices().documentStore.snapshotAsNewGame()
  }

  makeMainVariation(treePosition) {
    return this.getPlayServices().documentStore.makeMainVariation(treePosition)
  }

  shiftVariation(treePosition, step) {
    return this.getPlayServices().documentStore.shiftVariation(
      treePosition,
      step,
    )
  }

  async removeNode(treePosition, opts) {
    return this.getPlayServices().documentStore.removeNode(treePosition, opts)
  }

  async removeOtherVariations(treePosition, opts) {
    return this.getPlayServices().documentStore.removeOtherVariations(
      treePosition,
      opts,
    )
  }

  // Menus

  openNodeMenu(treePosition, {x, y} = {}) {
    let t = i18n.context('menu.edit')
    let template = [
      {
        label: t('&Copy Variation'),
        click: () => this.copyVariation(treePosition),
      },
      {
        label: t('Cu&t Variation'),
        click: () => this.cutVariation(treePosition),
      },
      {
        label: t('&Paste Variation'),
        click: () => this.pasteVariation(treePosition),
      },
      {type: 'separator'},
      {
        label: t('Make Main &Variation'),
        click: () => this.makeMainVariation(treePosition),
      },
      {
        label: t('Shift &Left'),
        click: () => this.shiftVariation(treePosition, -1),
      },
      {
        label: t('Shift Ri&ght'),
        click: () => this.shiftVariation(treePosition, 1),
      },
      {type: 'separator'},
      {
        label: t('&Flatten'),
        click: () => this.flattenVariation(treePosition),
      },
      {
        label: t('&Remove Node'),
        click: () => this.removeNode(treePosition),
      },
      {
        label: t('Remove &Other Variations'),
        click: () => this.removeOtherVariations(treePosition),
      },
    ]

    helper.popupMenu(template, x, y)
  }

  openCommentMenu(treePosition, {x, y} = {}) {
    let t = i18n.context('menu.comment')
    let node = this.inferredState.gameTree.get(treePosition)

    let template = [
      {
        label: t('&Clear Annotations'),
        click: () => {
          this.setComment(treePosition, {
            positionAnnotation: null,
            moveAnnotation: null,
          })
        },
      },
      {type: 'separator'},
      {
        label: t('Good for &Black'),
        type: 'checkbox',
        data: {positionAnnotation: 'GB'},
      },
      {
        label: t('&Unclear Position'),
        type: 'checkbox',
        data: {positionAnnotation: 'UC'},
      },
      {
        label: t('&Even Position'),
        type: 'checkbox',
        data: {positionAnnotation: 'DM'},
      },
      {
        label: t('Good for &White'),
        type: 'checkbox',
        data: {positionAnnotation: 'GW'},
      },
    ]

    if (node.data.B != null || node.data.W != null) {
      template.push(
        {type: 'separator'},
        {
          label: t('&Good Move'),
          type: 'checkbox',
          data: {moveAnnotation: 'TE'},
        },
        {
          label: t('&Interesting Move'),
          type: 'checkbox',
          data: {moveAnnotation: 'IT'},
        },
        {
          label: t('&Doubtful Move'),
          type: 'checkbox',
          data: {moveAnnotation: 'DO'},
        },
        {
          label: t('B&ad Move'),
          type: 'checkbox',
          data: {moveAnnotation: 'BM'},
        },
      )
    }

    template.push(
      {type: 'separator'},
      {
        label: t('&Hotspot'),
        type: 'checkbox',
        data: {hotspot: true},
      },
    )

    for (let item of template) {
      if (!('data' in item)) continue

      let [key] = Object.keys(item.data)
      let prop = key === 'hotspot' ? 'HO' : item.data[key]

      item.checked = node.data[prop] != null
      if (item.checked) item.data[key] = null

      item.click = () => this.setComment(treePosition, item.data)
    }

    helper.popupMenu(template, x, y)
  }

  openVariationMenu(
    sign,
    moves,
    {x, y, appendSibling = false, startNodeProperties = {}} = {},
  ) {
    let t = i18n.context('menu.variation')
    let {treePosition} = this.state
    let tree = this.inferredState.gameTree

    helper.popupMenu(
      [
        {
          label: t('&Add Variation'),
          click: async () => {
            let isRootNode = tree.get(treePosition).parentId == null

            if (appendSibling && isRootNode) {
              await dialog.showMessageBox(
                t('The root node cannot have sibling nodes.'),
                'warning',
              )
              return
            }

            let [color, opponent] = sign > 0 ? ['B', 'W'] : ['W', 'B']

            let newTree = tree.mutate((draft) => {
              let parentId = !appendSibling
                ? treePosition
                : tree.get(treePosition).parentId
              let variationData = moves.map((vertex, i) =>
                Object.assign(
                  {
                    [i % 2 === 0 ? color : opponent]: [
                      sgf.stringifyVertex(vertex),
                    ],
                  },
                  i === 0 ? startNodeProperties : {},
                ),
              )

              for (let data of variationData) {
                parentId = draft.appendNode(parentId, data)
              }
            })

            this.setCurrentTreePosition(newTree, treePosition)
          },
        },
      ],
      x,
      y,
    )
  }

  openEnginesMenu({x, y} = {}) {
    let t = i18n.context('menu.engines')
    let engines = setting.get('engines.list')

    helper.popupMenu(
      [
        ...engines.map((engine, i) => ({
          label: engine.name || t('(Unnamed Engine)'),
          click: () => {
            this.getPlayServices().engineService.attachEngines([
              this.normalizeEngineConfig(engine, i),
            ])
          },
        })),
        engines.length > 0 && {type: 'separator'},
        {
          label: t('Manage &Engines…'),
          click: () => {
            this.openDrawer('enginemanagement')
          },
        },
      ].filter((x) => !!x),
      x,
      y,
    )
  }

  openEngineActionMenu(syncerId, {x, y} = {}) {
    let t = i18n.context('menu.engineAction')
    let attachedSyncers =
      this.getPlayServices().engineService.getAttachedSyncers()
    let syncer = attachedSyncers.find((syncer) => syncer.id === syncerId)
    if (syncer == null) return

    helper.popupMenu(
      [
        {
          label: syncer.suspended ? t('&Start') : t('&Stop'),
          click: () => {
            if (syncer.suspended) syncer.start()
            else syncer.stop()
          },
        },
        {
          label: t('&Detach'),
          click: () => {
            this.getPlayServices().engineService.detachEngines([syncerId])
          },
        },
        {type: 'separator'},
        {
          label: t('S&ynchronize'),
          click: () => {
            this.getPlayServices().engineService.syncEngine(
              syncerId,
              this.state.treePosition,
            )
          },
        },
        {
          label: t('&Generate Move'),
          enabled:
            !this.getPlayServices().engineService.isEngineGameRunning() ||
            (this.getPlayServices().engineService.getBlackSyncerId() !==
              syncerId &&
              this.getPlayServices().engineService.getWhiteSyncerId() !==
                syncerId),
          click: async () => {
            this.getPlayServices().engineService.generateMove(
              syncerId,
              this.state.treePosition,
            )
          },
        },
        {type: 'separator'},
        {
          label: t('Set as &Analyzer'),
          type: 'checkbox',
          checked: this.getPlayServices().engineService.isAnalyzing(syncerId),
          click: () => {
            if (this.getPlayServices().engineService.isAnalyzing(syncerId)) {
              this.getPlayServices().engineService.stopAnalysis()
            } else {
              this.getPlayServices().engineService.startAnalysis(syncerId)
            }
          },
        },
        {
          label: t('Set as &Black Player'),
          type: 'checkbox',
          checked:
            this.getPlayServices().engineService.getBlackSyncerId() ===
            syncerId,
          click: () => {
            let es = this.getPlayServices().engineService
            es.setBlackWhiteSyncerIds(
              es.getBlackSyncerId() === syncerId ? null : syncerId,
              es.getWhiteSyncerId(),
            )
          },
        },
        {
          label: t('Set as &White Player'),
          type: 'checkbox',
          checked:
            this.getPlayServices().engineService.getWhiteSyncerId() ===
            syncerId,
          click: () => {
            let es = this.getPlayServices().engineService
            es.setBlackWhiteSyncerIds(
              es.getBlackSyncerId(),
              es.getWhiteSyncerId() === syncerId ? null : syncerId,
            )
          },
        },
        {type: 'separator'},
        {
          label: t('&Go to Engine'),
          click: () => {
            if (syncer.treePosition != null) {
              this.setCurrentTreePosition(
                this.state.gameTrees[this.state.gameIndex],
                syncer.treePosition,
              )
            }
          },
        },
      ],
      x,
      y,
    )
  }
}

export default new Sabaki()
