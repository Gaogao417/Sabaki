import fs from 'fs'
import EventEmitter from 'events'
import {basename, extname} from 'path'
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
import * as helper from './helper.js'
import {getAnalysisPreviewCacheKey} from './overlays/analysisPreview.js'
import {
  boardFromSnapshot,
  cloneSnapshot,
  createSnapshotFromBoard,
  snapshotToGameTree,
} from './study.js'
import * as sound from './sound.js'

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
      blockedGuesses: [],

      // Goban

      analysisAreaRects: null,
      analysisAreaVertices: null,
      territoryEnabled: false,
      territoryCompareEnabled: false,
      highlightVertices: [],
      playVariation: null,
      analysisType: null,
      coordinatesType: null,
      showAnalysis: null,
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

      consoleLog: [],
      showLeftSidebar: setting.get('view.show_leftsidebar'),
      leftSidebarWidth: setting.get('view.leftsidebar_width'),
      showWinrateGraph: setting.get('view.show_winrategraph'),
      showGameGraph: setting.get('view.show_graph'),
      showCommentBox: setting.get('view.show_comments'),
      sidebarWidth: setting.get('view.sidebar_width'),
      graphGridSize: null,
      graphNodeSize: null,

      // Engines

      engines: null,
      attachedEngineSyncers: [],
      analyzingEngineSyncerId: null,
      blackEngineSyncerId: null,
      whiteEngineSyncerId: null,
      engineGameOngoing: null,
      analysisTreePosition: null,
      analysis: null,
      quickAnalysisId: null,
      quickAnalysisSyncerId: null,

      // Drawers

      preferencesTab: 'general',

      // Input Box

      showInputBox: false,
      inputBoxText: '',
      onInputBoxSubmit: helper.noop,
      onInputBoxCancel: helper.noop,

      // Recall Mode

      recallSession: null,
      recallMoveIndex: 0,
      recallExpectedMoves: [],
      recallUserAttempts: [],
      recallShowHint: false,
      recallCompleted: false,

      // Problem Mode

      problemSession: null,
      problemAttempt: null,
      problemWorkspace: null,
      problemEvalCache: [],
      problemBadMoves: [],
      problemSubmitted: false,
      problemResult: null,

      // Review Mode

      reviewQueue: [],
      reviewCurrentIndex: 0,
      reviewTotalDue: 0,

      // Info Overlay

      infoOverlayText: '',
      showInfoOverlay: false,
    }

    this.events = new EventEmitter()
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
    this.ownershipCache = {}
    this.previewOwnershipCache = {}
    this.auxAnalysisRequestId = 0
    this.analysisRequestId = 0
    this.historyPointer = 0
    this.history = []
    this.recordHistory()

    // Bind state to settings
    window.sabaki.setting.onDidChange(({key, value}) => {
      this.updateSettingState(key)
    })

    this.updateSettingState()
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
        return state.attachedEngineSyncers.find(
          (syncer) => syncer.id === state.analyzingEngineSyncerId,
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

  createAnalysisWorkspace() {
    let tree = this.state.gameTrees[this.state.gameIndex]
    let board = gametree.getBoard(tree, this.state.treePosition)
    let currentPlayer = this.getPlayer(this.state.treePosition)
    let snapshot = createSnapshotFromBoard(board, currentPlayer)

    return {
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
  }

  setMode(mode) {
    if (this.state.mode === mode) return

    let stateChange = {mode}

    // Clean up edit workspace when leaving analysis mode
    if (this.state.mode === 'analysis' && mode !== 'analysis') {
      clearTimeout(this.editAnalysisId)
      stateChange.editWorkspace = null
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
      if (this.state.recallSession == null) return
    } else if (mode === 'problem') {
      if (this.state.problemSession == null) return
      if (this.state.analyzingEngineSyncerId == null && this.state.attachedEngineSyncers.length > 0) {
        stateChange.analyzingEngineSyncerId = this.state.attachedEngineSyncers[0].id
      }
    } else if (mode === 'review') {
      if (this.state.problemSession == null) return
    }

    this.setState(stateChange)
    this.events.emit('modeChange')

    if (mode === 'analysis') {
      this.scheduleEditWorkspaceAnalysis()
    } else if (
      mode !== 'analysis' &&
      this.state.territoryCompareEnabled &&
      !this.getTerritoryCompareAvailable()
    ) {
      this.setState({territoryCompareEnabled: false})
    }
  }

  openDrawer(drawer) {
    this.setState({openDrawer: drawer})
  }

  closeDrawer() {
    this.openDrawer(null)
  }

  // Recall Mode

  async startRecallSession(gameId, options = {}) {
    let game = await window.sabaki.db.getGame(gameId)
    if (!game) {
      console.warn('[startRecallSession] game not found for gameId:', gameId)
      return
    }

    console.log('[startRecallSession] gameId:', gameId, 'sgf length:', game.sgf?.length, 'sgf preview:', game.sgf?.slice(0, 100))

    let trees = fileformats.sgf.parse(game.sgf)
    console.log('[startRecallSession] parsed trees count:', trees?.length, 'trees type:', typeof trees, 'isArray:', Array.isArray(trees))
    if (!trees || trees.length === 0) {
      console.warn('[startRecallSession] no trees returned from sgf.parse, trees:', trees)
      return
    }
    let tree = trees[0]
    console.log('[startRecallSession] tree type:', tree?.constructor?.name, 'has root:', !!tree?.root, 'root:', tree?.root, 'root.id:', tree?.root?.id)

    // Extract the move sequence from the game tree
    let moves = []
    let nodeId = tree.root.id
    if (nodeId == null) {
      console.error('[startRecallSession] tree.root.id is null/undefined! root:', JSON.stringify(tree?.root)?.slice(0, 500))
    }
    let innerTree = tree
    while (true) {
      let node = innerTree.get(nodeId)
      if (!node) break
      let sign = 0
      let vertex = null
      if (node.data.B && node.data.B[0] != null) {
        sign = 1
        vertex = node.data.B[0] === '' ? 'pass' : node.data.B[0]
      } else if (node.data.W && node.data.W[0] != null) {
        sign = -1
        vertex = node.data.W[0] === '' ? 'pass' : node.data.W[0]
      }
      if (vertex != null) {
        moves.push({sign, vertex: vertex === 'pass' ? null : vertex})
      }
      let children = node.children
      if (children.length === 0) break
      nodeId = children[0].id
    }

    let session = {
      gameId,
      mode: options.mode || 'full_game',
      startMove: options.startMove || 0,
    }
    session = await window.sabaki.db.saveRecallSession(session)

    this.setState({
      recallSession: session,
      recallMoveIndex: 0,
      recallExpectedMoves: moves,
      recallUserAttempts: [],
      recallShowHint: false,
      recallCompleted: false,
    })

    // Load the game tree and navigate to the start
    if (trees && trees.length > 0) {
      await this.loadGameTrees(trees, {suppressAskForSave: true})
    }

    this.setMode('recall')
  }

  handleRecallMove(vertex) {
    let {recallSession, recallMoveIndex, recallExpectedMoves, recallUserAttempts} = this.state
    if (!recallSession || this.state.recallCompleted) return

    let expected = recallExpectedMoves[recallMoveIndex]
    if (!expected) return

    // Navigate tree forward to get the board
    let {gameTrees, gameIndex, gameCurrents, treePosition} = this.state
    let tree = gameTrees[gameIndex]
    let board = gametree.getBoard(tree, treePosition)

    // Handle passes
    if (expected.vertex === null) {
      recallUserAttempts.push({
        moveNumber: recallMoveIndex,
        expectedMove: 'pass',
        userMove: 'pass',
        isCorrect: true,
        hintLevelUsed: 0,
      })
      this.recallNavigateNext()
      this.setState({recallMoveIndex: recallMoveIndex + 1, recallUserAttempts})
      this.checkRecallComplete()
      return
    }

    let expectedCoord = board.parseVertex(expected.vertex)
    let isCorrect = helper.vertexEquals(vertex, expectedCoord)

    recallUserAttempts.push({
      moveNumber: recallMoveIndex,
      expectedMove: expected.vertex,
      userMove: board.stringifyVertex(vertex),
      isCorrect,
      hintLevelUsed: this.state.recallShowHint ? 1 : 0,
    })

    if (isCorrect) {
      this.recallNavigateNext()
      this.setState({
        recallMoveIndex: recallMoveIndex + 1,
        recallUserAttempts,
        recallShowHint: false,
      })
      this.checkRecallComplete()
    } else {
      sound.playError()
      this.setState({recallUserAttempts})
    }
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
    let {recallMoveIndex, recallExpectedMoves} = this.state
    if (recallMoveIndex >= recallExpectedMoves.length) {
      this.setState({recallCompleted: true})
    }
  }

  async endRecallSession() {
    let {recallSession, recallUserAttempts} = this.state
    if (!recallSession) return

    let completedSession = {
      ...recallSession,
      completedAt: new Date().toISOString(),
    }
    await window.sabaki.db.saveRecallSession(completedSession)

    if (recallUserAttempts.length > 0) {
      await window.sabaki.db.saveRecallAttempts(
        recallUserAttempts.map((a) => ({
          ...a,
          sessionId: recallSession.id,
        })),
      )
    }

    this.setMode('analysis')
  }

  skipRecallMove() {
    let {recallMoveIndex, recallExpectedMoves, recallUserAttempts} = this.state
    let expected = recallExpectedMoves[recallMoveIndex]
    if (!expected) return

    recallUserAttempts.push({
      moveNumber: recallMoveIndex,
      expectedMove: expected.vertex || 'pass',
      userMove: 'skip',
      isCorrect: false,
      hintLevelUsed: 0,
    })

    this.recallNavigateNext()

    this.setState({
      recallMoveIndex: recallMoveIndex + 1,
      recallUserAttempts,
      recallShowHint: false,
    })
    this.checkRecallComplete()
  }

  showRecallHint() {
    this.setState({recallShowHint: true})
  }

  async saveCurrentGame() {
    let sgfStr = this.getSGF()
    let tree = this.state.gameTrees[this.state.gameIndex]
    console.log('[saveCurrentGame] tree.root.id:', tree.root.id, 'sgf length:', sgfStr?.length, 'sgf preview:', sgfStr?.slice(0, 150))
    let root = tree.get(tree.root.id)
    let result = root.data.RE?.[0] || null
    console.log('[saveCurrentGame] result:', result, 'root.id:', root?.id)
    let game = {sgf: sgfStr, source: 'play', result}
    let saved = await window.sabaki.db.saveGame(game)
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

    let sgfStr = sgf.stringify([
      snapshotToGameTree(snapshot, {moveNumber: 0}),
    ])

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
      passRule: options.passRule || {evalDropThreshold: 5, requireNoSevereBadMove: true, compareWithReference: true},
      tags: options.tags || [],
      difficulty: options.difficulty || null,
      status: options.status || 'inbox',
    }

    let saved = await window.sabaki.db.saveProblem(problem)
    this.closeDrawer()
    return saved
  }

  // Problem Mode

  async startProblem(problemId) {
    let problem = await window.sabaki.db.getProblem(problemId)
    if (!problem) return

    let trees = fileformats.sgf.parse(problem.positionSgf)
    if (!trees || trees.length === 0) return
    let tree = trees[0]

    let attempt = {
      problemId: problem.id,
      userLine: [],
      moveEvaluations: [],
      hintLevelUsed: 0,
      generatedPunishmentProblemIds: [],
    }
    attempt = await window.sabaki.db.saveProblemAttempt(attempt)

    this.setState({
      problemSession: problem,
      problemAttempt: attempt,
      problemWorkspace: tree,
      problemEvalCache: [],
      problemBadMoves: [],
      problemSubmitted: false,
      problemResult: null,
    })

    this.loadGameTrees([tree])
    this.setCurrentTreePosition(tree, tree.root.id)
    this.setMode('problem')

    if (this.inferredState.analyzingEngineSyncer != null) {
      this.analyzeMove(tree.root.id)
    }
  }

  handleProblemMove(vertex) {
    let {problemSession, problemAttempt, problemEvalCache, problemBadMoves} = this.state
    if (!problemSession || this.state.problemSubmitted) return

    let {gameTrees, gameIndex, treePosition} = this.state
    let tree = gameTrees[gameIndex]
    let board = gametree.getBoard(tree, treePosition)

    if (board.get(vertex) !== 0) return

    let player = problemSession.sideToMove === 'black' ? 1 : -1
    let currentPlayer = this.getPlayer(treePosition)

    // Capture pre-move analysis before modifying the tree
    let preMoveAnalysis = this.state.analysis

    // Place the stone
    let newTree = tree.mutate((draft) => {
      draft.appendNode(treePosition, {
        [player > 0 ? 'B' : 'W']: [sgf.stringifyVertex(vertex)],
      })
    })

    let nextId = newTree.get(treePosition).children[0]?.id
    if (nextId) {
      this.setCurrentTreePosition(newTree, nextId)
    }

    let moveStr = board.stringifyVertex(vertex)
    let userLine = [...(problemAttempt.userLine || []), moveStr]

    // Basic evaluation using analysis data if available
    let moveEval = {
      moveIndex: userLine.length - 1,
      move: moveStr,
      isBadMove: false,
      severity: 'none',
    }

    // Use pre-move analysis to check if the move was bad
    if (preMoveAnalysis) {
      let analysis = preMoveAnalysis
      let isSolverMove = (analysis.sign > 0 && player > 0) || (analysis.sign < 0 && player < 0)

      let variation = analysis.variations.find((v) => helper.vertexEquals(v.vertex, vertex))
      if (variation) {
        // Check if this is significantly worse than the top move
        let topWinrate = analysis.variations[0]?.winrate || 50
        let moveWinrate = variation.winrate
        let winrateDrop = isSolverMove ? topWinrate - moveWinrate : moveWinrate - topWinrate

        if (analysis.variations[0]?.scoreLead != null && variation.scoreLead != null) {
          let scoreDrop = isSolverMove
            ? (analysis.variations[0].scoreLead - variation.scoreLead)
            : (variation.scoreLead - analysis.variations[0].scoreLead)

          // Adjust sign based on solver's perspective
          if (player < 0) scoreDrop = -scoreDrop

          moveEval.beforeScoreLead = analysis.variations[0].scoreLead
          moveEval.afterScoreLead = variation.scoreLead
          moveEval.scoreDrop = Math.abs(scoreDrop)

          if (Math.abs(scoreDrop) > 8) {
            moveEval.isBadMove = true
            moveEval.severity = 'severe'
          } else if (Math.abs(scoreDrop) > 5) {
            moveEval.isBadMove = true
            moveEval.severity = 'major'
          } else if (Math.abs(scoreDrop) > 2) {
            moveEval.isBadMove = true
            moveEval.severity = 'minor'
          }
        }
      }
    }

    problemEvalCache.push(moveEval)

    if (moveEval.isBadMove) {
      problemBadMoves.push({
        moveIndex: moveEval.moveIndex,
        move: moveStr,
        severity: moveEval.severity,
        scoreDrop: moveEval.scoreDrop,
      })
    }

    let updatedAttempt = {...problemAttempt, userLine, moveEvaluations: problemEvalCache}
    this.setState({
      problemEvalCache,
      problemBadMoves,
      problemAttempt: updatedAttempt,
    })
  }

  async submitProblemAttempt() {
    let {problemSession, problemAttempt, problemEvalCache, problemBadMoves} = this.state
    if (!problemSession || this.state.problemSubmitted) return

    // Determine result
    let result = 'pass'
    let hasSevere = problemBadMoves.some((m) => m.severity === 'severe')
    let hasMajor = problemBadMoves.some((m) => m.severity === 'major')

    if (hasSevere) {
      result = 'fail'
    } else if (hasMajor) {
      result = 'soft_pass'
    }

    let submittedAt = new Date().toISOString()
    let updatedAttempt = {
      ...problemAttempt,
      submittedAt,
      result,
    }

    await window.sabaki.db.saveProblemAttempt(updatedAttempt)

    // Save all bad moves to bad_moves table
    let punishSide = problemSession.sideToMove === 'black' ? 'white' : 'black'
    for (let bm of problemBadMoves) {
      await window.sabaki.db.saveBadMove({
        problemId: problemSession.id,
        attemptId: updatedAttempt.id,
        moveIndex: bm.moveIndex,
        move: bm.move,
        positionBeforeMoveSgf: '',
        positionAfterMoveSgf: '',
        severity: bm.severity,
        scoreDrop: bm.scoreDrop,
        punishSide,
        generatedProblemId: null,
      })
    }

    // Generate punishment problems for major/severe bad moves
    let punishmentIds = []
    for (let badMove of problemBadMoves.filter((m) => m.severity === 'major' || m.severity === 'severe')) {
      let punishment = await this.generatePunishmentProblem(badMove, problemSession, updatedAttempt, punishSide)
      if (punishment) {
        punishmentIds.push(punishment.id)
      }
    }

    updatedAttempt.generatedPunishmentProblemIds = punishmentIds
    await window.sabaki.db.saveProblemAttempt(updatedAttempt)

    // Update review schedule
    let dueAt = new Date()
    if (result === 'fail') {
      dueAt.setDate(dueAt.getDate() + 1)
    } else if (result === 'soft_pass') {
      dueAt.setDate(dueAt.getDate() + 3)
    } else {
      dueAt.setDate(dueAt.getDate() + 7)
    }

    await window.sabaki.db.upsertReviewSchedule({
      itemId: problemSession.id,
      itemType: 'problem',
      dueAt: dueAt.toISOString(),
      intervalDays: result === 'fail' ? 1 : result === 'soft_pass' ? 3 : 7,
      lastResult: result,
      consecutivePassCount: result === 'pass' ? 1 : 0,
      totalFailCount: result === 'fail' ? 1 : 0,
    })

    this.setState({
      problemSubmitted: true,
      problemResult: result,
      problemAttempt: updatedAttempt,
    })

    // If in review mode, advance to next
    if (this.state.mode === 'review') {
      this.advanceReview()
    }
  }

  async generatePunishmentProblem(badMove, parentProblem, parentAttempt, punishSide) {
    let {gameTrees, gameIndex, treePosition} = this.state
    let tree = gameTrees[gameIndex]
    let board = gametree.getBoard(tree, treePosition)
    let snapshot = createSnapshotFromBoard(board, punishSide === 'black' ? 1 : -1)
    let positionSgf = sgf.stringify([snapshotToGameTree(snapshot, {moveNumber: 0})])

    let description = `Auto-generated from "${parentProblem.title || 'untitled'}". ` +
      `The solver played ${badMove.move}, causing a ${badMove.severity} loss of ~${Math.round(badMove.scoreDrop || 0)} points. ` +
      `Now it is ${punishSide}'s turn. Find the key punishment move.`

    let problem = {
      sourceProblemId: parentProblem.id,
      type: 'punishment',
      positionSgf,
      sideToMove: punishSide,
      title: `Punishment: ${parentProblem.title || 'Untitled'}`,
      positionDescription: description,
      taskGoal: `Find the punishment move after ${badMove.move}.`,
      status: 'inbox',
    }

    let saved = await window.sabaki.db.saveProblem(problem)
    return saved
  }

  undoProblemMove() {
    let {problemAttempt, problemEvalCache, problemBadMoves} = this.state
    if (!problemAttempt || problemEvalCache.length === 0) return

    let userLine = [...(problemAttempt.userLine || [])]
    let lastEval = problemEvalCache[problemEvalCache.length - 1]

    userLine.pop()
    problemEvalCache = problemEvalCache.slice(0, -1)
    if (lastEval.isBadMove) {
      problemBadMoves = problemBadMoves.filter((m) => m.moveIndex !== lastEval.moveIndex)
    }

    // Navigate back in tree
    let {gameTrees, gameIndex, treePosition} = this.state
    let tree = gameTrees[gameIndex]
    let node = tree.get(treePosition)
    if (node.parentId) {
      this.setCurrentTreePosition(tree, node.parentId)
    }

    this.setState({
      problemAttempt: {...problemAttempt, userLine},
      problemEvalCache,
      problemBadMoves,
    })
  }

  exitProblemMode() {
    this.setState({
      problemSession: null,
      problemAttempt: null,
      problemSubmitted: false,
      problemResult: null,
    })
    this.setMode('play')
  }

  // Review Mode

  async startReviewSession() {
    let dueItems = await window.sabaki.db.getDueReviews()
    if (dueItems.length === 0) return

    let queue = dueItems.map((item) => item.item_id)

    this.setState({
      reviewQueue: queue,
      reviewCurrentIndex: 0,
      reviewTotalDue: queue.length,
    })

    await this.startProblem(queue[0])
    this.setMode('review')
  }

  async advanceReview() {
    let {reviewQueue, reviewCurrentIndex} = this.state
    let nextIndex = reviewCurrentIndex + 1

    if (nextIndex >= reviewQueue.length) {
      this.exitProblemMode()
      return
    }

    this.setState({reviewCurrentIndex: nextIndex})
    await this.startProblem(reviewQueue[nextIndex])
    this.setMode('review')
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
    this.setState({consoleLog: []})
  }

  getOwnershipCacheKey(syncerId, tree, treePosition) {
    if (syncerId == null || tree == null || treePosition == null) return null
    return [syncerId, tree.root.id, treePosition].join(':')
  }

  cacheOwnership(syncerId, tree, treePosition, ownership) {
    let key = this.getOwnershipCacheKey(syncerId, tree, treePosition)
    if (key == null || ownership == null) return
    this.ownershipCache[key] = ownership
  }

  getCachedOwnership(syncerId, tree, treePosition) {
    let key = this.getOwnershipCacheKey(syncerId, tree, treePosition)
    return key == null ? null : this.ownershipCache[key] || null
  }

  cachePreviewOwnership(syncerId, tree, treePosition, moves, ownership) {
    let key = getAnalysisPreviewCacheKey(tree, treePosition, moves)
    if (syncerId == null || key == null || ownership == null) return
    this.previewOwnershipCache[`${syncerId}:${key}`] = ownership
  }

  getCachedPreviewOwnership(syncerId, tree, treePosition, moves) {
    let key = getAnalysisPreviewCacheKey(tree, treePosition, moves)
    return key == null || syncerId == null
      ? null
      : this.previewOwnershipCache[`${syncerId}:${key}`] || null
  }

  getCurrentOwnership(syncer = this.inferredState.analyzingEngineSyncer) {
    let tree = this.inferredState.gameTree
    let {treePosition, analysis, analysisTreePosition} = this.state

    if (
      syncer != null &&
      analysis != null &&
      analysis.ownership != null &&
      analysisTreePosition === treePosition
    ) {
      this.cacheOwnership(syncer.id, tree, treePosition, analysis.ownership)
      return analysis.ownership
    }

    return syncer == null
      ? null
      : this.getCachedOwnership(syncer.id, tree, treePosition)
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

  getTerritoryCompareAvailable(state = this.state) {
    return (
      state.mode === 'analysis' && state.editWorkspace?.referenceSnapshot != null
    )
  }

  getBoardAnalysisContext({state = this.state, tab = null} = {}) {
    if (state.mode === 'analysis' && state.editWorkspace != null) {
      let activeTab = tab ?? state.editWorkspace.activeTab
      let {snapshotKey, analysisKey, ownershipKey} =
        this.getEditWorkspaceTabKeys(activeTab)
      let snapshot = state.editWorkspace[snapshotKey]
      if (snapshot == null) return null

      let context = snapshotToGameTree(snapshot)
      if (context == null) return null

      let {tree, treePosition} = context
      return {
        source: 'analysis',
        tab: activeTab,
        tree,
        treePosition,
        analyzePlayer: snapshot.nextPlayer,
        analysis: state.editWorkspace[analysisKey],
        ownership: state.editWorkspace[ownershipKey],
      }
    }

    let inferredState = this.getInferredState(state)
    return {
      source: 'play',
      tab: null,
      tree: inferredState.gameTree,
      treePosition: state.treePosition,
      analyzePlayer: this.getPlayer(state.treePosition),
      analysis:
        state.analysisTreePosition === state.treePosition
          ? state.analysis
          : null,
      ownership: this.getCurrentOwnership(inferredState.analyzingEngineSyncer),
    }
  }

  refreshActiveBoardAnalysis() {
    if (this.state.mode === 'analysis' && this.state.editWorkspace != null) {
      this.scheduleEditWorkspaceAnalysis()
    } else {
      this.analyzeMove(this.state.treePosition)
    }
  }

  syncEditWorkspaceToCurrentPosition() {
    let ws = this.state.editWorkspace
    if (ws == null) return

    let tree = this.state.gameTrees[this.state.gameIndex]
    let board = gametree.getBoard(tree, this.state.treePosition)
    let currentPlayer = this.getPlayer(this.state.treePosition)
    let snapshot = createSnapshotFromBoard(board, currentPlayer)

    this.setState({
      editWorkspace: {
        ...ws,
        currentSnapshot: snapshot,
        currentAnalysis: null,
        currentOwnership: null,
        currentMarkerMap: snapshot.signMap.map((row) => row.map(() => null)),
        currentLines: [],
      },
    })
  }

  async ensureAnalysisReady({requireOwnership = false} = {}) {
    let syncer = this.inferredState.analyzingEngineSyncer

    if (
      syncer != null &&
      (!requireOwnership || this.engineSupportsOwnership(syncer))
    ) {
      return syncer
    }

    let syncerId = this.getAnalysisSyncerId({requireOwnership})

    if (syncerId == null) {
      syncer = await this.attachDefaultAnalysisEngine({requireOwnership})
      syncerId = syncer?.id ?? null
    }

    if (syncerId == null) {
      await dialog.showMessageBox(
        i18n.t(
          'sabaki.engine',
          requireOwnership
            ? 'Please configure or attach an analysis engine that provides ownership data first.'
            : 'Please configure or attach an analysis engine first.',
        ),
        'warning',
      )
      return null
    }

    await this.startAnalysis(syncerId)
    return (
      this.state.attachedEngineSyncers.find((x) => x.id === syncerId) || null
    )
  }

  async attachDefaultAnalysisEngine({requireOwnership = false} = {}) {
    let engines = setting
      .get('engines.list')
      .filter(
        (engine) => engine != null && engine.path != null && engine.path !== '',
      )

    // Auto-detect engines if none configured (transient — not persisted)
    if (engines.length === 0) {
      let detected = detectEngines()
      if (detected.length > 0) {
        engines = detected
      }
    }

    for (let engine of engines) {
      let [syncer] = this.attachEngines([engine])
      if (syncer == null) continue

      let ready = await this.waitForEngineCommands(syncer)
      if (
        ready &&
        this.getAnalyzeCommand(syncer) != null &&
        (!requireOwnership || this.engineSupportsOwnership(syncer))
      ) {
        return syncer
      }

      await this.detachEngines([syncer.id])
    }

    return null
  }

  waitForEngineCommands(syncer, {timeout = 10000} = {}) {
    if (syncer == null) return Promise.resolve(false)
    if (syncer.commands.length > 0) return Promise.resolve(true)

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
      timeoutId = setTimeout(() => finish(syncer.commands.length > 0), timeout)
      syncer.on('suspended-changed', check)
      syncer.controller.on('response-received', check)
      syncer.controller.on('stopped', handleStopped)
      check()
    })
  }

  // Edit Workspace Methods

  clickEditWorkspaceVertex(
    vertex,
    {button = 0, ctrlKey = false, x = 0, y = 0} = {},
  ) {
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

      this.editAnalysisGeneration = (this.editAnalysisGeneration || 0) + 1
      this.setState({
        editWorkspace: {
          ...ws,
          [snapshotKey]: nextSnapshot,
          [analysisKey]: null,
          [ownershipKey]: null,
        },
      })
      this.scheduleEditWorkspaceAnalysis(tab)
    } else if (tool === 'eraser') {
      let nextSnapshot = cloneSnapshot(snapshot)
      nextSnapshot.signMap[vy][vx] = 0
      this.editAnalysisGeneration = (this.editAnalysisGeneration || 0) + 1
      this.setState({
        editWorkspace: {
          ...ws,
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

    this.setState({
      editWorkspace: {
        ...ws,
        [targetSnapshotKey]: cloneSnapshot(sourceSnapshot),
        [targetAnalysisKey]: null,
        [targetOwnershipKey]: null,
        [targetMarkerKey]: sourceSnapshot.signMap.map((row) =>
          row.map(() => null),
        ),
        [targetLinesKey]: [],
      },
    })
    this.scheduleEditWorkspaceAnalysis()
  }

  toggleEditTab(tab) {
    let ws = this.state.editWorkspace
    if (ws == null) return
    if (tab !== 'current' && tab !== 'reference') return
    if (tab === 'reference' && ws.referenceSnapshot == null) return

    this.setState({
      editWorkspace: {...ws, activeTab: tab},
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

    this.editAnalysisGeneration = (this.editAnalysisGeneration || 0) + 1

    this.setState({
      editWorkspace: {
        ...ws,
        [key]: nextSnapshot,
        [analysisKey]: null,
        [ownershipKey]: null,
      },
    })
    this.scheduleEditWorkspaceAnalysis(ws.activeTab)
  }

  scheduleEditWorkspaceAnalysis(targetTab = null) {
    clearTimeout(this.editAnalysisId)
    this.editAnalysisId = setTimeout(() => {
      this.refreshEditWorkspaceAnalysis(targetTab)
    }, 200)
  }

  async refreshEditWorkspaceAnalysis(targetTab = null) {
    let generation = (this.editAnalysisGeneration =
      (this.editAnalysisGeneration || 0) + 1)
    let ws = this.state.editWorkspace
    if (ws == null) return

    let syncer = this.inferredState.analyzingEngineSyncer
    if (syncer == null || !this.engineSupportsOwnership(syncer)) {
      this.setState({
        editWorkspace: {
          ...ws,
          currentAnalysis: null,
          currentOwnership: null,
          referenceAnalysis: null,
          referenceOwnership: null,
          analysisPending: false,
        },
      })
      return
    }

    this.setState({
      editWorkspace: {...ws, analysisPending: true},
    })

    let analyzeTab = async (snapshot, analysisKey, ownershipKey) => {
      if (snapshot == null) return null
      let {tree, treePosition} = snapshotToGameTree(snapshot)
      return await this.runBoardAnalysis({
        syncer,
        tree,
        treePosition,
        analyzePlayer: snapshot.nextPlayer,
        requestGroup: 'study',
        onAnalysisUpdate: (analysis) => {
          if (this.editAnalysisGeneration !== generation) return
          let current = this.state.editWorkspace
          if (current != null) {
            this.setState({
              editWorkspace: {
                ...current,
                [analysisKey]: analysis,
                [ownershipKey]: analysis?.ownership ?? null,
              },
            })
          }
        },
      })
    }

    let analyzeCurrent = targetTab == null || targetTab === 'current'
    let analyzeReference = targetTab == null || targetTab === 'reference'

    let currentAnalysis = analyzeCurrent
      ? await analyzeTab(
          ws.currentSnapshot,
          'currentAnalysis',
          'currentOwnership',
        )
      : ws.currentAnalysis

    let referenceAnalysis = analyzeReference
      ? await analyzeTab(
          ws.referenceSnapshot,
          'referenceAnalysis',
          'referenceOwnership',
        )
      : ws.referenceAnalysis

    if (this.editAnalysisGeneration !== generation) {
      let pendingWs = this.state.editWorkspace
      if (pendingWs != null) {
        this.setState({
          editWorkspace: {...pendingWs, analysisPending: false},
        })
      }
      return
    }

    let finalWs = this.state.editWorkspace
    if (finalWs != null) {
      this.setState({
        editWorkspace: {
          ...finalWs,
          currentAnalysis: currentAnalysis ?? finalWs.currentAnalysis,
          currentOwnership:
            currentAnalysis?.ownership ?? finalWs.currentOwnership,
          referenceAnalysis: referenceAnalysis ?? finalWs.referenceAnalysis,
          referenceOwnership:
            referenceAnalysis?.ownership ?? finalWs.referenceOwnership,
          analysisPending: false,
        },
      })
    }
  }

  handleEditDragEnd({source, target}) {
    let ws = this.state.editWorkspace
    if (ws == null) return

    let {
      snapshotKey: key,
      analysisKey,
      ownershipKey,
    } = this.getEditWorkspaceTabKeys(ws.activeTab)
    let snapshot = ws[key]
    if (snapshot == null) return

    let [sx, sy] = source
    let [tx, ty] = target

    let sourceSign = snapshot.signMap[sy]?.[sx] ?? 0
    let targetSign = snapshot.signMap[ty]?.[tx] ?? 0

    if (sourceSign === 0 || targetSign !== 0) return
    if (helper.vertexEquals(source, target)) return

    let nextSnapshot = cloneSnapshot(snapshot)
    nextSnapshot.signMap[sy][sx] = 0
    nextSnapshot.signMap[ty][tx] = sourceSign

    this.editAnalysisGeneration = (this.editAnalysisGeneration || 0) + 1
    this.setState({
      editWorkspace: {
        ...ws,
        [key]: nextSnapshot,
        [analysisKey]: null,
        [ownershipKey]: null,
      },
    })
    this.scheduleEditWorkspaceAnalysis(ws.activeTab)
  }

  getAnalyzeCommand(syncer) {
    if (syncer == null) return null

    return (
      setting
        .get('engines.analyze_commands')
        .find((command) => syncer.commands.includes(command)) || null
    )
  }

  engineSupportsOwnership(syncer) {
    let commandName = this.getAnalyzeCommand(syncer)
    return commandName != null && commandName.includes('kata')
  }

  async configureKataAnalysis(syncer) {
    if (
      syncer == null ||
      syncer.suspended ||
      !syncer.commands.includes('kata-set-param')
    ) {
      return
    }

    try {
      let maxVisits = +setting.get('board.analysis_max_visits')
      if (Number.isFinite(maxVisits) && maxVisits > 0) {
        await syncer.queueCommand({
          name: 'kata-set-param',
          args: ['maxVisits', Math.round(maxVisits).toString()],
        })
      }

      let maxTime = +setting.get('board.analysis_max_time')
      if (Number.isFinite(maxTime) && maxTime > 0) {
        await syncer.queueCommand({
          name: 'kata-set-param',
          args: ['maxTime', maxTime.toString()],
        })
      }
    } catch (err) {}
  }

  getAnalysisVisitLimit() {
    let maxVisits = +setting.get('board.analysis_max_visits')
    return Number.isFinite(maxVisits) && maxVisits > 0
      ? Math.round(maxVisits)
      : null
  }

  async runBoardAnalysis({
    syncer,
    tree,
    treePosition,
    analyzePlayer,
    pendingStateKey = null,
    requestGroup = 'aux',
    showLoadingText = null,
    previewCacheMoves = null,
    onAnalysisUpdate = null,
  }) {
    if (
      syncer == null ||
      syncer.suspended ||
      tree == null ||
      treePosition == null
    ) {
      return null
    }

    let commandName = this.getAnalyzeCommand(syncer)
    if (commandName == null) return null

    let args = [
      analyzePlayer > 0 ? 'B' : 'W',
      setting.get('board.analysis_interval').toString(),
    ]
    if (commandName.includes('kata')) args.push('ownership', 'true')

    if (
      commandName.includes('kata') &&
      this.state.analysisAreaVertices?.length > 0
    ) {
      let gameBoard = gametree.getBoard(tree, treePosition)
      let vertexStr = this.state.analysisAreaVertices
        .map((v) => gameBoard.stringifyVertex(v))
        .join(',')
      args.push('allow', 'b', vertexStr, '999', 'allow', 'w', vertexStr, '999')
    }

    let requestId =
      requestGroup === 'analysis'
        ? ++this.analysisRequestId
        : ++this.auxAnalysisRequestId
    let visitLimit = this.getAnalysisVisitLimit()
    let maxTime = +setting.get('board.analysis_max_time')
    let timeoutMs =
      Number.isFinite(maxTime) && maxTime > 0
        ? Math.round(maxTime * 1000)
        : null
    let originTreePosition = this.state.treePosition

    if (pendingStateKey != null) {
      this.setState({[pendingStateKey]: true})
    }
    if (showLoadingText != null) {
      this.showInfoOverlay(showLoadingText)
    }

    try {
      let synced = await this.syncEngine(syncer.id, treePosition, {tree})
      if (
        !synced ||
        (requestGroup === 'analysis' && requestId !== this.analysisRequestId) ||
        (requestGroup !== 'analysis' && requestId !== this.auxAnalysisRequestId)
      ) {
        return null
      }

      if (commandName.includes('kata')) {
        await this.configureKataAnalysis(syncer)
      }

      let analysis = await new Promise((resolve) => {
        let settled = false
        let latestAnalysis = null
        let timeoutId = null

        let finish = (value) => {
          if (settled) return
          settled = true
          clearTimeout(timeoutId)
          syncer.removeListener('analysis-update', handleUpdate)
          syncer.sendAbort()
          resolve(value)
        }

        let handleUpdate = () => {
          let invalid =
            requestGroup === 'analysis'
              ? requestId !== this.analysisRequestId
              : requestId !== this.auxAnalysisRequestId

          if (invalid) {
            finish(null)
            return
          }

          if (syncer.treePosition !== treePosition || syncer.analysis == null) {
            return
          }

          let bestVisits = Math.max(
            0,
            ...syncer.analysis.variations.map(
              (variation) => variation.visits || 0,
            ),
          )
          latestAnalysis = syncer.analysis
          onAnalysisUpdate?.(latestAnalysis)

          if (visitLimit != null && bestVisits < visitLimit) {
            return
          }

          finish(latestAnalysis)
        }

        syncer.on('analysis-update', handleUpdate)
        if (timeoutMs != null) {
          timeoutId = setTimeout(() => finish(latestAnalysis), timeoutMs)
        }

        try {
          syncer.queueCommand({name: commandName, args})
        } catch (err) {
          finish(null)
        }
      })

      if (analysis?.ownership != null) {
        if (previewCacheMoves != null) {
          this.cachePreviewOwnership(
            syncer.id,
            tree,
            treePosition,
            previewCacheMoves,
            analysis.ownership,
          )
        } else {
          this.cacheOwnership(syncer.id, tree, treePosition, analysis.ownership)
        }
      }

      return analysis
    } finally {
      if (
        this.state.analyzingEngineSyncerId === syncer.id &&
        this.state.treePosition === originTreePosition &&
        requestGroup !== 'analysis' &&
        !(this.state.mode === 'analysis' && this.state.editWorkspace != null)
      ) {
        this.analyzeMove(originTreePosition)
      }

      if (pendingStateKey != null) {
        this.setState({[pendingStateKey]: false})
      }
      if (showLoadingText != null) {
        this.hideInfoOverlay()
      }
    }
  }

  async runOwnershipAnalysis({
    syncer,
    tree,
    treePosition,
    analyzePlayer,
    pendingStateKey = null,
    requestGroup = 'aux',
    showLoadingText = null,
    previewCacheMoves = null,
    onOwnershipUpdate = null,
  }) {
    if (
      syncer == null ||
      syncer.suspended ||
      tree == null ||
      treePosition == null
    ) {
      return null
    }

    let cachedOwnership =
      previewCacheMoves != null
        ? this.getCachedPreviewOwnership(
            syncer.id,
            tree,
            treePosition,
            previewCacheMoves,
          )
        : this.getCachedOwnership(syncer.id, tree, treePosition)
    if (cachedOwnership != null) {
      onOwnershipUpdate?.(cachedOwnership)
      return cachedOwnership
    }

    let analysis = await this.runBoardAnalysis({
      syncer,
      tree,
      treePosition,
      analyzePlayer,
      pendingStateKey,
      requestGroup,
      showLoadingText,
      previewCacheMoves,
      onAnalysisUpdate: (nextAnalysis) => {
        onOwnershipUpdate?.(nextAnalysis?.ownership ?? null)
      },
    })

    return analysis?.ownership ?? null
  }

  getAnalysisSyncerId({requireOwnership = false} = {}) {
    let candidates = this.state.attachedEngineSyncers.filter((syncer) => {
      if (this.getAnalyzeCommand(syncer) == null) return false
      if (!requireOwnership) return true
      return this.engineSupportsOwnership(syncer)
    })

    if (candidates.length === 0) return null

    let preferredSyncer = candidates.find(
      (syncer) => syncer.id === this.lastAnalyzingEngineSyncerId,
    )

    return (preferredSyncer || candidates[0]).id
  }

  async setTerritoryEnabled(territoryEnabled) {
    if (territoryEnabled === this.state.territoryEnabled) return true

    if (!territoryEnabled) {
      this.hideInfoOverlay()
      this.setState({
        territoryEnabled: false,
        territoryCompareEnabled: false,
      })
      return true
    }

    this.hideInfoOverlay()
    this.setState({territoryEnabled: true})

    let syncer = await this.ensureAnalysisReady({requireOwnership: true})
    if (syncer == null) {
      this.setState({
        territoryEnabled: false,
        territoryCompareEnabled: false,
      })
      return false
    }

    if (
      this.state.mode !== 'analysis' &&
      (this.state.analysisTreePosition !== this.state.treePosition ||
        this.getCurrentOwnership(syncer) == null)
    ) {
      this.analyzeMove(this.state.treePosition)
    } else if (this.state.mode === 'analysis') {
      this.scheduleEditWorkspaceAnalysis()
    }

    return true
  }

  async toggleTerritoryEnabled() {
    return await this.setTerritoryEnabled(!this.state.territoryEnabled)
  }

  async setTerritoryCompareEnabled(territoryCompareEnabled) {
    if (territoryCompareEnabled === this.state.territoryCompareEnabled)
      return true

    if (!territoryCompareEnabled) {
      this.setState({territoryCompareEnabled: false})
      return true
    }

    if (this.state.mode !== 'analysis') return false

    let territoryReady = await this.setTerritoryEnabled(true)
    if (!territoryReady || !this.getTerritoryCompareAvailable()) {
      return false
    }

    this.scheduleEditWorkspaceAnalysis()
    this.setState({territoryCompareEnabled: true})
    return true
  }

  async toggleTerritoryCompareEnabled() {
    return await this.setTerritoryCompareEnabled(
      !this.state.territoryCompareEnabled,
    )
  }

  async setOverlayMode(overlayMode) {
    if (overlayMode === 'territory') {
      return await this.setTerritoryEnabled(true)
    }

    if (overlayMode === 'off') {
      return await this.setTerritoryEnabled(false)
    }

    return false
  }

  getOwnershipForTreePosition(syncer, treePosition) {
    let analyzingSyncer = syncer || this.inferredState.analyzingEngineSyncer
    if (analyzingSyncer == null || treePosition == null) return null

    let tree = this.inferredState.gameTree
    let {analysis, analysisTreePosition} = this.state

    if (
      analysis != null &&
      analysis.ownership != null &&
      analysisTreePosition === treePosition
    ) {
      this.cacheOwnership(
        analyzingSyncer.id,
        tree,
        treePosition,
        analysis.ownership,
      )
      return analysis.ownership
    }

    return this.getCachedOwnership(analyzingSyncer.id, tree, treePosition)
  }

  // History Management

  recordHistory({prevGameIndex, prevTreePosition} = {}) {
    let currentEntry = this.history[this.historyPointer]
    let newEntry = {
      gameIndex: this.state.gameIndex,
      gameTrees: this.state.gameTrees,
      treePosition: this.state.treePosition,
      timestamp: Date.now(),
    }

    if (
      currentEntry != null &&
      helper.shallowEquals(currentEntry.gameTrees, newEntry.gameTrees)
    )
      return

    this.history = this.history.slice(
      -setting.get('edit.max_history_count'),
      this.historyPointer + 1,
    )

    if (
      currentEntry != null &&
      newEntry.timestamp - currentEntry.timestamp <
        setting.get('edit.history_batch_interval')
    ) {
      this.history[this.historyPointer] = newEntry
    } else {
      if (
        currentEntry != null &&
        prevGameIndex != null &&
        prevTreePosition != null
      ) {
        currentEntry.gameIndex = prevGameIndex
        currentEntry.treePosition = prevTreePosition
      }

      this.history.push(newEntry)
      this.historyPointer = this.history.length - 1
    }
  }

  clearHistory() {
    this.history = []
    this.recordHistory()
  }

  checkoutHistory(historyPointer) {
    let entry = this.history[historyPointer]
    if (entry == null) return

    let gameTree = entry.gameTrees[entry.gameIndex]

    this.historyPointer = historyPointer
    this.setState({
      gameIndex: entry.gameIndex,
      gameTrees: entry.gameTrees,
      gameCurrents: entry.gameTrees.map((_) => ({})),
    })

    this.setCurrentTreePosition(gameTree, entry.treePosition, {
      clearCache: true,
    })
  }

  undo() {
    if (this.state.mode === 'analysis' && this.state.editWorkspace != null) {
      return
    }
    this.checkoutHistory(this.historyPointer - 1)
  }

  redo() {
    if (this.state.mode === 'analysis' && this.state.editWorkspace != null) {
      return
    }
    this.checkoutHistory(this.historyPointer + 1)
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

  async newFile({
    playSound = false,
    showInfo = false,
    suppressAskForSave = false,
  } = {}) {
    if (!suppressAskForSave && !(await this.askForSave())) return

    let [blackName, whiteName] = [
      this.state.blackEngineSyncerId,
      this.state.whiteEngineSyncerId,
    ]
      .map((id) =>
        this.state.attachedEngineSyncers.find((syncer) => syncer.id === id),
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
      if (button === 0 && !(helper.isMac && ctrlKey)) {
        if (board.get(vertex) === 0) {
          this.makeMove(vertex, {
            generateEngineMove: this.state.engineGameOngoing == null,
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
          this.state.analysis != null &&
          this.state.analysisTreePosition === this.state.treePosition
        ) {
          // Show analysis context menu

          let {sign, variations} = this.state.analysis
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
        this.clickEditWorkspaceVertex(vertex, {button, ctrlKey, x, y})
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

      let board = gametree.getBoard(tree, treePosition)
      if (board.get(vertex) === 0) {
        this.handleRecallMove(vertex)
      }
    } else if (this.state.mode === 'problem' || this.state.mode === 'review') {
      if (button !== 0) return

      let board = gametree.getBoard(tree, treePosition)
      if (board.get(vertex) === 0) {
        this.handleProblemMove(vertex)
      }
    } else if (this.state.mode === 'guess') {
      if (button !== 0) return

      let nextNode = tree.navigate(treePosition, 1, gameCurrents[gameIndex])
      if (
        nextNode == null ||
        (nextNode.data.B == null && nextNode.data.W == null)
      ) {
        return this.setMode('play')
      }

      let nextVertex = sgf.parseVertex(
        nextNode.data[nextNode.data.B != null ? 'B' : 'W'][0],
      )
      let board = gametree.getBoard(tree, treePosition)
      if (!board.has(nextVertex)) {
        return this.setMode('play')
      }

      if (helper.vertexEquals(vertex, nextVertex)) {
        this.makeMove(vertex, {player: nextNode.data.B != null ? 1 : -1})
      } else {
        if (
          board.get(vertex) !== 0 ||
          this.state.blockedGuesses.some((v) => helper.vertexEquals(v, vertex))
        )
          return

        let blocked = []
        let [, i] = vertex
          .map((x, i) => Math.abs(x - nextVertex[i]))
          .reduce(
            ([max, i], x, j) => (x > max ? [x, j] : [max, i]),
            [-Infinity, -1],
          )

        for (let x = 0; x < board.width; x++) {
          for (let y = 0; y < board.height; y++) {
            let z = i === 0 ? x : y
            if (Math.abs(z - vertex[i]) < Math.abs(z - nextVertex[i]))
              blocked.push([x, y])
          }
        }

        let {blockedGuesses} = this.state
        blockedGuesses.push(...blocked)
        this.setState({blockedGuesses})
      }
    }

    this.events.emit('vertexClick')
  }

  async makeMove(vertex, {player = null, generateEngineMove = false} = {}) {
    if (!['play', 'autoplay', 'guess'].includes(this.state.mode)) {
      this.closeDrawer()
      this.setMode('play')
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
    } else {
      sound.playPass()
    }

    // Enter scoring mode after two consecutive passes

    let enterScoring = false

    if (pass && createNode && prev != null) {
      let prevColor = color === 'B' ? 'W' : 'B'
      let prevPass =
        node.data[prevColor] != null && node.data[prevColor][0] === ''

      if (prevPass) {
        enterScoring = true
        this.setMode('scoring')
      }
    }

    // Emit event

    this.events.emit('moveMake', {pass, capturing, suicide, ko, enterScoring})

    // Generate move

    if (generateEngineMove && !enterScoring) {
      this.generateMove(
        player > 0
          ? this.state.whiteEngineSyncerId
          : this.state.blackEngineSyncerId,
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

    console.log('[makeResign] player:', player, 'color:', color, 'tree.root.id:', tree.root.id, 'treePosition:', treePosition)

    let newTree = tree.mutate((draft) => {
      draft.updateProperty(draft.root.id, 'RE', [`${color}+Resign`])
    })

    console.log('[makeResign] newTree.root.id:', newTree.root.id, 'newTree RE:', newTree.root.data.RE, 'NOTE: newTree is created but NOT applied to state!')

    this.makeMainVariation(treePosition)
    this.makeMove([-1, -1], {player})

    this.events.emit('resign', {player})

    let saved = await this.saveCurrentGame()
    console.log('[makeResign] saveCurrentGame result:', saved)
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

  setCurrentTreePosition(tree, treePosition, {clearCache = false} = {}) {
    if (clearCache) gametree.clearBoardCache()

    let navigated = treePosition !== this.state.treePosition

    if (navigated && this.state.mode === 'analysis') {
      clearTimeout(this.editAnalysisId)
    }

    if (['scoring', 'estimator'].includes(this.state.mode) && navigated) {
      this.setState({mode: 'play'})
    }

    let {gameTrees, gameCurrents, blockedGuesses} = this.state
    let gameIndex = gameTrees.findIndex((t) => t.root.id === tree.root.id)
    let currents = gameCurrents[gameIndex]

    let n = tree.get(treePosition)
    while (n.parentId != null) {
      // Update currents

      currents[n.parentId] = n.id
      n = tree.get(n.parentId)
    }

    let prevGameIndex = this.state.gameIndex
    let prevTreePosition = this.state.treePosition
    let nextPreviewState = {
      ...this.state,
      treePosition,
    }

    this.setState({
      playVariation: null,
      blockedGuesses: navigated ? [] : blockedGuesses,
      gameTrees: gameTrees.map((t, i) => (i !== gameIndex ? t : tree)),
      gameIndex,
      treePosition,
      mode: this.state.mode,
      territoryCompareEnabled:
        this.state.territoryCompareEnabled &&
        (!navigated || this.getTerritoryCompareAvailable(nextPreviewState)),
    })

    this.recordHistory({prevGameIndex, prevTreePosition})

    if (navigated) this.events.emit('navigate')

    // Continuous analysis

    if (
      navigated &&
      this.state.mode === 'analysis' &&
      this.state.editWorkspace != null
    ) {
      this.syncEditWorkspaceToCurrentPosition()
      this.scheduleEditWorkspaceAnalysis()
    } else if (navigated) {
      this.scheduleLiveAnalysis(treePosition)
    }
  }

  goStep(step) {
    let {gameTrees, gameIndex, gameCurrents, treePosition} = this.state
    let tree = gameTrees[gameIndex]
    let node = tree.navigate(treePosition, step, gameCurrents[gameIndex])
    if (node != null) this.setCurrentTreePosition(tree, node.id)
  }

  goToMoveNumber(number) {
    number = +number

    if (isNaN(number)) return
    if (number < 0) number = 0

    let {gameTrees, gameIndex, gameCurrents} = this.state
    let tree = gameTrees[gameIndex]
    let node = tree.navigate(
      tree.root.id,
      Math.round(number),
      gameCurrents[gameIndex],
    )

    if (node != null) this.setCurrentTreePosition(tree, node.id)
    else this.goToEnd()
  }

  goToNextFork() {
    let {gameTrees, gameIndex, gameCurrents, treePosition} = this.state
    let tree = gameTrees[gameIndex]
    let next = tree.navigate(treePosition, 1, gameCurrents[gameIndex])
    if (next == null) return
    let sequence = [...tree.getSequence(next.id)]

    this.setCurrentTreePosition(tree, sequence.slice(-1)[0].id)
  }

  goToPreviousFork() {
    let {gameTrees, gameIndex, gameCurrents, treePosition} = this.state
    let tree = gameTrees[gameIndex]
    let node = tree.get(treePosition)
    let prev = tree.get(node.parentId)
    if (prev == null) return
    let newTreePosition = tree.root.id

    for (let node of tree.listNodesVertically(
      prev.id,
      -1,
      gameCurrents[gameIndex],
    )) {
      if (node.children.length > 1) {
        newTreePosition = node.id
        break
      }
    }

    this.setCurrentTreePosition(tree, newTreePosition)
  }

  goToComment(step) {
    let {gameTrees, gameIndex, gameCurrents, treePosition} = this.state
    let tree = gameTrees[gameIndex]
    let commentProps = setting.get('sgf.comment_properties')
    let newTreePosition = null

    for (let node of tree.listNodesVertically(
      treePosition,
      step,
      gameCurrents[gameIndex],
    )) {
      if (
        node.id !== treePosition &&
        commentProps.some((prop) => node.data[prop] != null)
      ) {
        newTreePosition = node.id
        break
      }
    }

    if (newTreePosition != null)
      this.setCurrentTreePosition(tree, newTreePosition)
  }

  goToBeginning() {
    let {gameTrees, gameIndex} = this.state
    let tree = gameTrees[gameIndex]

    this.setCurrentTreePosition(tree, tree.root.id)
  }

  goToEnd() {
    let {gameTrees, gameIndex, gameCurrents} = this.state
    let tree = gameTrees[gameIndex]
    let [node] = [...tree.listCurrentNodes(gameCurrents[gameIndex])].slice(-1)

    this.setCurrentTreePosition(tree, node.id)
  }

  goToSiblingVariation(step) {
    let {gameTrees, gameIndex, treePosition} = this.state
    let tree = gameTrees[gameIndex]
    let section = [...tree.getSection(tree.getLevel(treePosition))]
    let index = section.findIndex((node) => node.id === treePosition)
    let newIndex =
      (((step + index) % section.length) + section.length) % section.length

    this.setCurrentTreePosition(tree, section[newIndex].id)
  }

  changeDownstreamVariation(step) {
    // redirects gameCurrents[gameIndex] to a new stream
    let {gameTrees, gameIndex, gameCurrents, treePosition} = this.state
    let tree = gameTrees[gameIndex]
    let currents = gameCurrents[gameIndex]

    let chIdx = [-1, 0] // for + changes
    if (step < 0) {
      chIdx = [0, -1] // for - changes
    }

    // find the lowest fork node which does not point to the last child
    let sequence = [...tree.getSequence(treePosition)]
    let node = sequence.slice(-1)[0]
    let next = tree.navigate(node.id, 1, currents)
    if (next == null) return
    let lowestFork = node
    while (next != null) {
      if (next.id != node.children.slice(chIdx[0])[0].id) {
        lowestFork = node
      }
      sequence = [...tree.getSequence(next.id)]
      node = sequence.slice(-1)[0]
      next = tree.navigate(node.id, 1, currents)
    }

    // increment the currents for the lowest fork node
    next = tree.navigate(lowestFork.id, 1, currents)
    let idx = lowestFork.children.findIndex((ch) => ch.id == next.id)
    let ch_len = lowestFork.children.length
    idx = (((idx + step) % ch_len) + ch_len) % ch_len // force idx >= 0 :eyeroll:
    currents[lowestFork.id] = lowestFork.children[idx].id

    next = tree.navigate(lowestFork.id, 1, currents) //using new currents

    // then zero the downstream currents.
    while (next.id != null) {
      sequence = [...tree.getSequence(next.id)]
      node = sequence.slice(-1)[0]
      if (node.children.length > 0) {
        currents[node.id] = node.children.slice(chIdx[1])[0].id
        next = tree.navigate(node.id, 1, currents)
      } else {
        break
      }
    }
  }

  goToMainVariation() {
    let {gameTrees, gameIndex, gameCurrents, treePosition} = this.state
    let tree = gameTrees[gameIndex]

    gameCurrents[gameIndex] = {}
    this.setState({gameCurrents})

    if (tree.onMainLine(treePosition)) {
      this.setCurrentTreePosition(tree, treePosition)
    } else {
      let id = treePosition
      while (!tree.onMainLine(id)) {
        id = tree.get(id).parentId
      }

      this.setCurrentTreePosition(tree, id)
    }
  }

  goToSiblingGame(step) {
    let {gameTrees, gameIndex} = this.state
    let newIndex = Math.max(0, Math.min(gameTrees.length - 1, gameIndex + step))

    this.closeDrawer()
    this.setCurrentTreePosition(
      gameTrees[newIndex],
      gameTrees[newIndex].root.id,
    )
  }

  startAutoscrolling(step) {
    if (this.autoscrollId != null) return

    let first = true
    let maxDelay = setting.get('autoscroll.max_interval')
    let minDelay = setting.get('autoscroll.min_interval')
    let diff = setting.get('autoscroll.diff')

    let scroll = (delay = null) => {
      this.goStep(step)

      clearTimeout(this.autoscrollId)
      this.autoscrollId = setTimeout(() => {
        scroll(first ? maxDelay : Math.max(minDelay, delay - diff))
        first = false
      }, delay)
    }

    scroll(400)
  }

  stopAutoscrolling() {
    clearTimeout(this.autoscrollId)
    this.autoscrollId = null
  }

  // Engine Management

  handleCommandSent({syncer, command, subscribe, getResponse}) {
    let t = i18n.context('sabaki.engine')
    let entry = {name: syncer.engine.name, command, waiting: true}
    let maxLength = setting.get('console.max_history_count')

    this.setState(({consoleLog}) => {
      let newLog = consoleLog.slice(
        Math.max(consoleLog.length - maxLength + 1, 0),
      )
      newLog.push(entry)

      return {consoleLog: newLog}
    })

    let updateEntry = (update) => {
      Object.assign(entry, update)
      this.setState(({consoleLog}) => ({consoleLog}))
    }

    subscribe(({line, response, end}) => {
      updateEntry({
        response,
        waiting: !end,
      })

      gtplogger.write({
        type: 'stdout',
        message: line,
        engine: syncer.engine.name,
      })
    })

    getResponse().catch((_) => {
      gtplogger.write({
        type: 'meta',
        message: 'Connection Failed',
        engine: syncer.engine.name,
      })

      updateEntry({
        response: {
          internal: true,
          content: h('img', {
            class: 'icon',
            src: './node_modules/@primer/octicons/build/svg/alert.svg',
            alt: t('Connection Failed'),
            title: t('Connection Failed'),
          }),
        },
        waiting: false,
      })
    })
  }

  attachEngines(engines) {
    let attaching = []
    let getEngineName = (name) => {
      let counter = 1
      let getName = () => (counter === 1 ? name : `${name} ${counter}`)
      let hasName = (syncer) => syncer.engine.name === getName()

      while (
        attaching.some(hasName) ||
        this.state.attachedEngineSyncers.some(hasName)
      ) {
        counter++
      }

      return getName()
    }

    for (let engine of engines) {
      engine = {...engine, name: getEngineName(engine.name)}

      let syncer = new EngineSyncer(engine)

      // Handle engine path errors
      if (syncer.pathError) {
        dialog.showMessageBox(syncer.pathError, 'error')
        continue
      }

      syncer.on('error', (err) => {
        let message
        if (err.code === 'ENOENT') {
          message = t(
            'Engine binary not found. Please check the engine path in Preferences > Engines.',
          )
        } else if (err.code === 'EACCES') {
          message = t(
            'Engine binary is not executable. Please check file permissions.',
          )
        } else {
          message = t('Failed to start engine: ') + err.message
        }
        dialog.showMessageBox(message, 'error')
      })

      syncer.on('analysis-update', () => {
        if (this.state.analyzingEngineSyncerId === syncer.id) {
          // Update analysis info

          let tree = this.state.gameTrees[this.state.gameIndex]
          if (
            syncer.treePosition != null &&
            tree.get(syncer.treePosition) == null
          ) {
            return
          }

          let currentAnalysisUpdate =
            syncer.treePosition === this.state.treePosition

          if (currentAnalysisUpdate) {
            this.setState({
              analysis: syncer.analysis,
              analysisTreePosition: syncer.treePosition,
            })
          }

          if (syncer.analysis != null && syncer.treePosition != null) {
            if (syncer.analysis.ownership != null) {
              this.cacheOwnership(
                syncer.id,
                tree,
                syncer.treePosition,
                syncer.analysis.ownership,
              )
            }

            let {sign, winrate, scoreLead} = syncer.analysis
            if (sign < 0) winrate = 100 - winrate
            if (scoreLead != null && sign < 0) scoreLead = -scoreLead

            let newTree = tree.mutate((draft) => {
              if (winrate != null) {
                draft.updateProperty(syncer.treePosition, 'SBKV', [
                  (Math.round(winrate * 100) / 100).toString(),
                ])
              }

              if (scoreLead != null) {
                draft.updateProperty(syncer.treePosition, 'SBKS', [
                  (Math.round(scoreLead * 100) / 100).toString(),
                ])
              }
            })

            this.setCurrentTreePosition(newTree, this.state.treePosition)
          }

          if (
            syncer.treePosition != null &&
            syncer.treePosition !== this.state.treePosition
          ) {
            this.scheduleLiveAnalysis(this.state.treePosition)
          }
        }
      })

      syncer.controller.on('command-sent', (evt) => {
        gtplogger.write({
          type: 'stdin',
          message: gtp.Command.toString(evt.command),
          engine: engine.name,
        })

        this.handleCommandSent({syncer, ...evt})
      })

      syncer.controller.on('stderr', ({content}) => {
        gtplogger.write({
          type: 'stderr',
          message: content,
          engine: engine.name,
        })

        this.setState(({consoleLog}) => {
          let lastIndex = consoleLog.length - 1
          let lastEntry = consoleLog[lastIndex]

          if (
            lastEntry != null &&
            lastEntry.name === engine.name &&
            lastEntry.command == null &&
            lastEntry.response != null &&
            lastEntry.response.internal &&
            typeof lastEntry.response.content === 'string'
          ) {
            lastEntry.response = {
              ...lastEntry.response,
              content: `${lastEntry.response.content}\n${content}`,
            }

            return {consoleLog}
          } else {
            return {
              consoleLog: [
                ...consoleLog,
                {
                  name: engine.name,
                  command: null,
                  response: {content, internal: true},
                },
              ],
            }
          }
        })
      })

      syncer.controller.on('started', () => {
        gtplogger.write({
          type: 'meta',
          message: 'Engine Started',
          engine: engine.name,
        })
      })

      syncer.controller.on('stopped', () => {
        gtplogger.write({
          type: 'meta',
          message: 'Engine Stopped',
          engine: engine.name,
        })
      })

      syncer.controller.start()

      attaching.push(syncer)
    }

    this.setState(({attachedEngineSyncers}) => ({
      attachedEngineSyncers: [...attachedEngineSyncers, ...attaching],
    }))

    return attaching
  }

  async detachEngines(syncerIds) {
    let detachEngineSyncers = this.state.attachedEngineSyncers.filter(
      (syncer) => syncerIds.includes(syncer.id),
    )

    await Promise.all(
      detachEngineSyncers.map(async (syncer) => {
        await this.stopEngineGame()
        await syncer.stop()

        let unset = (syncerId) => (syncerId === syncer.id ? null : syncerId)

        if (this.lastAnalyzingEngineSyncerId === syncer.id) {
          this.lastAnalyzingEngineSyncerId = null
        }

        this.setState((state) => ({
          attachedEngineSyncers: state.attachedEngineSyncers.filter(
            (s) => s.id !== syncer.id,
          ),
          engineGameOngoing:
            state.engineGameOngoing &&
            [state.blackEngineSyncerId, state.whiteEngineSyncerId].includes(
              syncer.id,
            )
              ? false
              : state.engineGameOngoing,
          blackEngineSyncerId: unset(state.blackEngineSyncerId),
          whiteEngineSyncerId: unset(state.whiteEngineSyncerId),
          analyzingEngineSyncerId: unset(state.analyzingEngineSyncerId),
        }))
      }),
    )
  }

  async syncEngine(
    syncerId,
    treePosition,
    {tree = this.inferredState.gameTree} = {},
  ) {
    let syncer = this.state.attachedEngineSyncers.find(
      (syncer) => syncer.id === syncerId,
    )

    if (syncer != null) {
      try {
        await syncer.sync(tree, treePosition)
        return true
      } catch (err) {
        await dialog.showMessageBox(err.message, 'error')
      }
    }

    return false
  }

  async generateMove(syncerId, treePosition, {commit = () => true} = {}) {
    let t = i18n.context('sabaki.engine')
    let sign = this.getPlayer(treePosition)
    let color = sign > 0 ? 'B' : 'W'
    let syncer = this.state.attachedEngineSyncers.find(
      (syncer) => syncer.id === syncerId,
    )
    if (syncer == null) return

    let synced = await this.syncEngine(syncerId, treePosition)
    if (!synced) return

    let {gameTree: tree, board} = this.inferredState
    let coord
    try {
      let commandName =
        setting
          .get('engines.gemove_analyze_commands')
          .find((x) => syncer.commands.includes(x)) || 'genmove'

      if (commandName === 'genmove') {
        let response = await syncer.queueCommand({
          name: commandName,
          args: [color],
        })

        if (response == null || response.error) throw new Error()

        coord = response.content
      } else {
        let interval = setting.get('board.analysis_interval').toString()

        coord = await new Promise(async (resolve) => {
          await syncer.queueCommand(
            {name: commandName, args: [color, interval]},
            ({line}) => {
              if (!line.startsWith('play ')) return
              resolve(line.slice('play '.length))
            },
          )

          resolve()
        })
      }
    } catch (err) {
      await dialog.showMessageBox(
        t((p) => `${p.engine} has failed to generate a move.`, {
          engine: syncer.engine.name,
        }),
        'error',
      )
    }

    if (coord == null) return
    coord = coord.toLowerCase().trim()

    if (coord === 'resign') {
      await dialog.showMessageBox(
        t((p) => `${p.engine} has resigned.`, {
          engine: syncer.engine.name,
        }),
        'info',
      )
    }

    let vertex = ['resign', 'pass'].includes(coord)
      ? [-1, -1]
      : board.parseVertex(coord)
    let currentTree = this.inferredState.gameTree
    let currentTreePosition = this.state.treePosition
    let positionMoved =
      currentTree.root.id !== tree.root.id ||
      currentTreePosition !== treePosition
    let resign = coord === 'resign'
    let {pass, capturing, suicide} = board.analyzeMove(sign, vertex)

    let newTreePosition
    let newTree = currentTree.mutate((draft) => {
      newTreePosition = draft.appendNode(treePosition, {
        [color]: [sgf.stringifyVertex(vertex)],
      })

      if (coord === 'resign') {
        draft.updateProperty(draft.root.id, 'RE', [
          `${sign > 0 ? 'W' : 'B'}+Resign`,
        ])

        let id2 = treePosition
        while (id2 != null) {
          draft.shiftNode(id2, 'main')
          id2 = draft.get(id2).parentId
        }
      }
    })

    if (newTreePosition == null || !commit()) return

    if (pass) {
      sound.playPass()
    } else {
      sound.playPachi()
      if (capturing || suicide) sound.playCapture()
    }

    this.setCurrentTreePosition(
      newTree,
      !positionMoved ? newTreePosition : currentTreePosition,
    )

    syncer.treePosition = newTreePosition

    return {
      tree: newTree,
      treePosition: newTreePosition,
      resign,
      pass,
    }
  }

  async startEngineGame(treePosition) {
    let t = i18n.context('sabaki.engine')
    let {engineGameOngoing, attachedEngineSyncers} = this.state
    let engineCount = attachedEngineSyncers.length
    if (engineGameOngoing != null) return

    if (engineCount === 0) {
      await dialog.showMessageBox(
        t('Please attach one or more engines first.'),
        'info',
      )

      return
    } else {
      this.setState((state) => ({
        blackEngineSyncerId:
          state.blackEngineSyncerId == null
            ? state.attachedEngineSyncers[0].id
            : state.blackEngineSyncerId,
        whiteEngineSyncerId:
          state.whiteEngineSyncerId == null
            ? state.attachedEngineSyncers[1 % engineCount].id
            : state.whiteEngineSyncerId,
      }))
    }

    let gameId = uuid()
    this.setState({engineGameOngoing: gameId})

    let consecutivePasses = 0

    while (this.state.engineGameOngoing === gameId) {
      let syncerId =
        this.getPlayer(treePosition) > 0
          ? this.state.blackEngineSyncerId
          : this.state.whiteEngineSyncerId

      let move = await this.generateMove(syncerId, treePosition, {
        commit: () => this.state.engineGameOngoing,
      })

      if (move == null || move.resign) {
        break
      }

      if (move.pass) {
        consecutivePasses++
      } else {
        consecutivePasses = 0
      }

      if (consecutivePasses >= 2) {
        break
      }

      treePosition = move.treePosition
    }

    this.stopEngineGame(gameId)
  }

  async stopEngineGame(gameId = null) {
    if (this.state.engineGameOngoing == null) return

    this.setState((state) => ({
      engineGameOngoing:
        gameId == null || state.engineGameOngoing === gameId
          ? null
          : state.engineGameOngoing,
    }))

    let syncer = this.inferredState.analyzingEngineSyncer
    if (syncer == null) return
  }

  async startStopEngineGame(treePosition) {
    if (this.state.engineGameOngoing != null) {
      this.stopEngineGame()
    } else {
      this.startEngineGame(treePosition)
    }
  }

  async analyzeMove(treePosition) {
    let sign = this.getPlayer(treePosition)
    let syncer = this.inferredState.analyzingEngineSyncer
    if (syncer == null || syncer.suspended) return

    await this.runBoardAnalysis({
      syncer,
      tree: this.inferredState.gameTree,
      treePosition,
      analyzePlayer: sign,
      requestGroup: 'analysis',
    })
  }

  scheduleLiveAnalysis(treePosition) {
    let syncer = this.inferredState.analyzingEngineSyncer
    if (syncer == null || syncer.suspended) return

    if (
      this.state.engineGameOngoing != null &&
      [this.state.blackEngineSyncerId, this.state.whiteEngineSyncerId].includes(
        this.state.analyzingEngineSyncerId,
      )
    ) {
      return
    }

    if (this.state.mode === 'analysis' && this.state.editWorkspace != null) return

    clearTimeout(this.continuousAnalysisId)

    this.continuousAnalysisId = setTimeout(() => {
      this.analyzeMove(treePosition)
    }, setting.get('game.navigation_analysis_delay'))
  }

  async startAnalysis(syncerId) {
    if (this.state.analyzingEngineSyncerId === syncerId) return

    let t = i18n.context('sabaki.engine')
    let syncer = this.state.attachedEngineSyncers.find(
      (syncer) => syncer.id === syncerId,
    )

    if (syncer == null) return

    if (this.getAnalyzeCommand(syncer) == null) {
      await dialog.showMessageBox(
        t('The selected engine does not support analysis.'),
        'warning',
      )
      return
    }

    this.lastAnalyzingEngineSyncerId = syncerId
    this.setState({
      analyzingEngineSyncerId: syncerId,
    })

    if (
      !this.state.engineGameOngoing ||
      (this.state.blackEngineSyncerId !== syncerId &&
        this.state.whiteEngineSyncerId !== syncerId)
    ) {
      if (this.state.mode === 'analysis' && this.state.editWorkspace != null) {
        this.syncEditWorkspaceToCurrentPosition()
        this.scheduleEditWorkspaceAnalysis()
      } else {
        this.analyzeMove(this.state.treePosition)
      }
    }
  }

  stopAnalysis() {
    let syncer = this.inferredState.analyzingEngineSyncer

    if (syncer != null) {
      syncer.sendAbort()
    }

    this.setState({
      analysis: null,
      analysisTreePosition: null,
      analyzingEngineSyncerId: null,
      editWorkspace:
        this.state.editWorkspace == null
          ? null
          : {
              ...this.state.editWorkspace,
              currentAnalysis: null,
              currentOwnership: null,
              referenceAnalysis: null,
              referenceOwnership: null,
              analysisPending: false,
            },
    })
  }

  waitForQuickAnalysis(
    syncer,
    treePosition,
    analysisId,
    visitLimit,
    timeoutMs,
  ) {
    return new Promise((resolve) => {
      let settled = false
      let timeoutId = null
      let latestAnalysis = null

      let finish = (value) => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        syncer.removeListener('analysis-update', handleUpdate)
        syncer.sendAbort()
        resolve(value)
      }

      let handleUpdate = () => {
        // Cancellation check
        if (this.state.quickAnalysisId !== analysisId) {
          finish(null)
          return
        }

        if (syncer.treePosition !== treePosition || syncer.analysis == null) {
          return
        }

        // Track the latest valid analysis for this position
        latestAnalysis = syncer.analysis

        let bestVisits = Math.max(
          0,
          ...syncer.analysis.variations.map((v) => v.visits || 0),
        )

        if (bestVisits >= visitLimit) {
          finish(latestAnalysis)
        }
      }

      syncer.on('analysis-update', handleUpdate)
      timeoutId = setTimeout(() => finish(latestAnalysis), timeoutMs)
    })
  }

  async quickAnalyzeAllNodes() {
    if (this.state.quickAnalysisId != null) return

    let syncer = await this.ensureAnalysisReady()
    if (syncer == null) return

    let commandName = this.getAnalyzeCommand(syncer)
    if (commandName == null) {
      await dialog.showMessageBox(
        i18n.t(
          'sabaki.engine',
          'The selected engine does not support analysis.',
        ),
        'warning',
      )
      return
    }

    let analysisId = Date.now()
    this.setState({
      quickAnalysisId: analysisId,
      quickAnalysisSyncerId: syncer.id,
    })
    this.setBusy(true)

    let tree = this.inferredState.gameTree
    let nodes = [...tree.listMainNodes()]
    let results = []

    // Override KataGo maxVisits for quick mode
    let isKata =
      commandName.includes('kata') && syncer.commands.includes('kata-set-param')

    try {
      if (isKata) {
        await syncer.queueCommand({
          name: 'kata-set-param',
          args: ['maxVisits', '50'],
        })
      }

      for (let i = 0; i < nodes.length; i++) {
        // Cancellation check
        if (this.state.quickAnalysisId !== analysisId) break

        let node = nodes[i]
        this.showInfoOverlay(`Analyzing ${i + 1}/${nodes.length}...`)

        let synced = await this.syncEngine(syncer.id, node.id, {tree})
        if (!synced || this.state.quickAnalysisId !== analysisId) break

        let sign = this.getPlayer(node.id)
        let args = [
          sign > 0 ? 'B' : 'W',
          setting.get('board.analysis_interval').toString(),
        ]
        if (commandName.includes('kata')) args.push('ownership', 'true')

        // Must await: ensures command is queued before listener checks
        await syncer.queueCommand({name: commandName, args})

        let analysis = await this.waitForQuickAnalysis(
          syncer,
          node.id,
          analysisId,
          50,
          3000,
        )

        if (analysis == null) continue
        if (this.state.quickAnalysisId !== analysisId) break

        // Convert to Black's perspective
        let winrate = analysis.winrate
        let scoreLead = analysis.scoreLead
        if (analysis.sign < 0) winrate = 100 - winrate
        if (analysis.sign < 0 && scoreLead != null) scoreLead = -scoreLead

        results.push({nodeId: node.id, winrate, scoreLead})
      }

      // Batch write all results in one mutation
      if (results.length > 0) {
        let newTree = tree.mutate((draft) => {
          for (let {nodeId, winrate, scoreLead} of results) {
            if (winrate != null) {
              draft.updateProperty(nodeId, 'SBKV', [
                (Math.round(winrate * 100) / 100).toString(),
              ])
            }
            if (scoreLead != null) {
              draft.updateProperty(nodeId, 'SBKS', [
                (Math.round(scoreLead * 100) / 100).toString(),
              ])
            }
          }
        })
        this.setCurrentTreePosition(newTree, this.state.treePosition)
      }
    } finally {
      // Restore KataGo params to user settings
      if (isKata) {
        await this.configureKataAnalysis(syncer).catch(() => {})
      }

      this.hideInfoOverlay()
      this.setState({quickAnalysisId: null, quickAnalysisSyncerId: null})
      this.setBusy(false)

      // Resume normal analysis if active
      if (this.state.analyzingEngineSyncerId != null) {
        this.analyzeMove(this.state.treePosition)
      }
    }
  }

  stopQuickAnalysis() {
    let syncer = this.state.attachedEngineSyncers.find(
      (s) => s.id === this.state.quickAnalysisSyncerId,
    )
    if (syncer != null) {
      syncer.sendAbort()
    }
    this.hideInfoOverlay()
    this.setState({quickAnalysisId: null, quickAnalysisSyncerId: null})
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
    return gametree.getGameInfo(this.inferredState.gameTree)
  }

  setGameInfo(data) {
    let newTree = gametree.setGameInfo(this.inferredState.gameTree, data)

    if (data.size) {
      setting.set('game.default_board_size', data.size.join(':'))
    }

    if (data.komi && data.komi.toString() !== '') {
      setting.set('game.default_komi', isNaN(data.komi) ? 0 : +data.komi)
    }

    if (data.handicap && data.handicap.toString() !== '') {
      setting.set(
        'game.default_handicap',
        isNaN(data.handicap) ? 0 : +data.handicap,
      )
    }

    this.setCurrentTreePosition(newTree, this.state.treePosition)
  }

  getPlayer(treePosition) {
    let {data} = this.inferredState.gameTree.get(treePosition)

    return data.PL != null
      ? data.PL[0] === 'W'
        ? -1
        : 1
      : data.B != null || (data.HA != null && +data.HA[0] >= 1)
        ? -1
        : 1
  }

  setAnalysisArea(vertices) {
    this.setState({
      analysisAreaRects: null,
      analysisAreaVertices: vertices,
      highlightVertices: [],
    })
    this.refreshActiveBoardAnalysis()
  }

  setAnalysisAreaRects(rects, vertices) {
    let hasVertices = vertices != null && vertices.length > 0

    this.setState({
      analysisAreaRects: hasVertices && rects != null ? rects : null,
      analysisAreaVertices: hasVertices ? vertices : null,
      highlightVertices: [],
    })
    this.refreshActiveBoardAnalysis()
  }

  clearAnalysisArea() {
    this.setState({
      analysisAreaRects: null,
      analysisAreaVertices: null,
      highlightVertices: [],
    })
    this.refreshActiveBoardAnalysis()
  }

  setPlayer(treePosition, sign) {
    let newTree = this.inferredState.gameTree.mutate((draft) => {
      let node = draft.get(treePosition)
      let intendedSign =
        node.data.B != null || (node.data.HA != null && +node.data.HA[0] >= 1)
          ? -1
          : +(node.data.W != null)

      if (intendedSign === sign || sign === 0) {
        draft.removeProperty(treePosition, 'PL')
      } else {
        draft.updateProperty(treePosition, 'PL', [sign > 0 ? 'B' : 'W'])
      }
    })

    this.setCurrentTreePosition(newTree, treePosition)
  }

  getComment(treePosition) {
    let {data} = this.inferredState.gameTree.get(treePosition)

    return {
      title: data.N != null ? data.N[0].trim() : null,
      comment: data.C != null ? data.C[0] : null,
      hotspot: data.HO != null,
      moveAnnotation:
        data.BM != null
          ? 'BM'
          : data.TE != null
            ? 'TE'
            : data.DO != null
              ? 'DO'
              : data.IT != null
                ? 'IT'
                : null,
      positionAnnotation:
        data.UC != null
          ? 'UC'
          : data.GW != null
            ? 'GW'
            : data.DM != null
              ? 'DM'
              : data.GB != null
                ? 'GB'
                : null,
    }
  }

  setComment(treePosition, data) {
    let newTree = this.inferredState.gameTree.mutate((draft) => {
      for (let [key, prop] of [
        ['title', 'N'],
        ['comment', 'C'],
      ]) {
        if (key in data) {
          if (data[key] && data[key] !== '') {
            draft.updateProperty(treePosition, prop, [data[key]])
          } else {
            draft.removeProperty(treePosition, prop)
          }
        }
      }

      if ('hotspot' in data) {
        if (data.hotspot) {
          draft.updateProperty(treePosition, 'HO', ['1'])
        } else {
          draft.removeProperty(treePosition, 'HO')
        }
      }

      let clearProperties = (properties) =>
        properties.forEach((p) => draft.removeProperty(treePosition, p))

      if ('moveAnnotation' in data) {
        let moveProps = {BM: '1', DO: '', IT: '', TE: '1'}
        clearProperties(Object.keys(moveProps))

        if (data.moveAnnotation != null) {
          draft.updateProperty(treePosition, data.moveAnnotation, [
            moveProps[data.moveAnnotation],
          ])
        }
      }

      if ('positionAnnotation' in data) {
        let positionProps = {UC: '1', GW: '1', GB: '1', DM: '1'}
        clearProperties(Object.keys(positionProps))

        if (data.positionAnnotation != null) {
          draft.updateProperty(treePosition, data.positionAnnotation, [
            positionProps[data.positionAnnotation],
          ])
        }
      }
    })

    this.setCurrentTreePosition(newTree, treePosition)
  }

  copyVariation(treePosition) {
    let node = this.inferredState.gameTree.get(treePosition)
    let copy = {
      id: node.id,
      data: Object.assign({}, node.data),
      parentId: null,
      children: node.children,
    }

    let stripProperties = setting.get('edit.copy_variation_strip_props')

    for (let prop of stripProperties) {
      delete copy.data[prop]
    }

    this.copyVariationData = copy
  }

  cutVariation(treePosition) {
    this.copyVariation(treePosition)
    this.removeNode(treePosition, {suppressConfirmation: true})
  }

  pasteVariation(treePosition) {
    if (this.copyVariationData == null) return

    this.closeDrawer()
    this.setMode('play')

    let newPosition
    let copied = this.copyVariationData
    let newTree = this.inferredState.gameTree.mutate((draft) => {
      let inner = (id, children) => {
        let childIds = []

        for (let child of children) {
          let childId = draft.appendNode(id, child.data)
          childIds.push(childId)

          inner(childId, child.children)
        }

        return childIds
      }

      newPosition = inner(treePosition, [copied])[0]
    })

    this.setCurrentTreePosition(newTree, newPosition)
  }

  flattenVariation(treePosition) {
    this.closeDrawer()
    this.setMode('play')

    let {gameTrees} = this.state
    let {gameTree: tree} = this.inferredState
    let gameIndex = gameTrees.findIndex((t) => t.root.id === tree.root.id)
    if (gameIndex < 0) return

    let board = gametree.getBoard(tree, treePosition)
    let playerSign = this.getPlayer(treePosition)
    let inherit = setting.get('edit.flatten_inherit_root_props')

    let newTree = tree.mutate((draft) => {
      draft.makeRoot(treePosition)

      for (let prop of ['AB', 'AW', 'AE', 'B', 'W']) {
        draft.removeProperty(treePosition, prop)
      }

      for (let prop of inherit) {
        draft.updateProperty(treePosition, prop, tree.root.data[prop])
      }

      for (let x = 0; x < board.width; x++) {
        for (let y = 0; y < board.height; y++) {
          let sign = board.get([x, y])
          if (sign == 0) continue

          draft.addToProperty(
            treePosition,
            sign > 0 ? 'AB' : 'AW',
            sgf.stringifyVertex([x, y]),
          )
        }
      }
    })

    this.setState({
      gameTrees: gameTrees.map((t, i) => (i === gameIndex ? newTree : t)),
    })
    this.setCurrentTreePosition(newTree, newTree.root.id)
    this.setPlayer(treePosition, playerSign)
  }

  snapshotAsNewGame() {
    this.closeDrawer()

    // Capture board before switching mode (edit workspace is destroyed on mode change)
    let board
    let playerSign
    if (this.state.mode === 'analysis' && this.state.editWorkspace != null) {
      let snapshot = this.state.editWorkspace.currentSnapshot
      board = boardFromSnapshot(snapshot)
      playerSign = snapshot.nextPlayer
    } else {
      let {gameTree: tree} = this.inferredState
      let treePosition = this.state.treePosition
      board = gametree.getBoard(tree, treePosition)
      playerSign = this.getPlayer(treePosition)
    }

    this.setMode('play')

    let {gameTrees, gameCurrents} = this.state
    let {gameTree: tree} = this.inferredState
    let gameIndex = gameTrees.findIndex((t) => t.root.id === tree.root.id)
    if (gameIndex < 0) return

    let inherit = setting.get('edit.flatten_inherit_root_props')

    let newTree = gametree.new().mutate((draft) => {
      let size =
        board.width === board.height
          ? board.width.toString()
          : [board.width, board.height].join(':')
      draft.updateProperty(draft.root.id, 'SZ', [size])
      draft.updateProperty(draft.root.id, 'PL', [playerSign > 0 ? 'B' : 'W'])

      for (let x = 0; x < board.width; x++) {
        for (let y = 0; y < board.height; y++) {
          let sign = board.get([x, y])
          if (sign === 0) continue

          draft.addToProperty(
            draft.root.id,
            sign > 0 ? 'AB' : 'AW',
            sgf.stringifyVertex([x, y]),
          )
        }
      }

      for (let prop of inherit) {
        if (tree.root.data[prop] != null) {
          draft.updateProperty(draft.root.id, prop, tree.root.data[prop])
        }
      }
    })

    let newGameIndex = gameIndex + 1
    let newGameTrees = [...gameTrees]
    newGameTrees.splice(newGameIndex, 0, newTree)
    let newGameCurrents = [...gameCurrents]
    newGameCurrents.splice(newGameIndex, 0, {})

    this.setState({
      gameTrees: newGameTrees,
      gameCurrents: newGameCurrents,
    })

    this.setCurrentTreePosition(newTree, newTree.root.id)
  }

  makeMainVariation(treePosition) {
    this.closeDrawer()
    this.setMode('play')

    let {gameCurrents, gameTrees} = this.state
    let {gameTree: tree} = this.inferredState
    let gameIndex = gameTrees.findIndex((t) => t.root.id === tree.root.id)
    if (gameIndex < 0) return

    let newTree = tree.mutate((draft) => {
      let id = treePosition

      while (id != null) {
        draft.shiftNode(id, 'main')
        id = draft.get(id).parentId
      }
    })

    gameCurrents[gameIndex] = {}
    this.setState({gameCurrents})
    this.setCurrentTreePosition(newTree, treePosition)
  }

  shiftVariation(treePosition, step) {
    this.closeDrawer()
    this.setMode('play')

    let shiftNode = null
    let {gameTree: tree} = this.inferredState

    for (let node of tree.listNodesVertically(treePosition, -1, {})) {
      let parent = tree.get(node.parentId)

      if (parent.children.length >= 2) {
        shiftNode = node
        break
      }
    }

    if (shiftNode == null) return

    let newTree = tree.mutate((draft) => {
      draft.shiftNode(shiftNode.id, step >= 0 ? 'right' : 'left')
    })

    this.setCurrentTreePosition(newTree, treePosition)
  }

  async removeNode(treePosition, {suppressConfirmation = false} = {}) {
    let t = i18n.context('sabaki.node')
    let {gameTree: tree} = this.inferredState
    let node = tree.get(treePosition)
    let noParent = node.parentId == null

    if (
      suppressConfirmation !== true &&
      setting.get('edit.show_removenode_warning')
    ) {
      let answer = await dialog.showMessageBox(
        t('Do you really want to remove this node?'),
        'warning',
        [t('Remove Node'), t('Cancel')],
        1,
      )
      if (answer === 1) return
    }

    this.closeDrawer()
    this.setMode('play')

    // Remove node

    let newTree = tree.mutate((draft) => {
      if (!noParent) {
        draft.removeNode(treePosition)
      } else {
        for (let child of node.children) {
          draft.removeNode(child.id)
        }

        for (let prop of ['AB', 'AW', 'AE', 'B', 'W']) {
          draft.removeProperty(node.id, prop)
        }
      }
    })

    this.setState(({gameCurrents, gameIndex}) => {
      if (!noParent) {
        if (gameCurrents[gameIndex][node.parentId] === node.id) {
          delete gameCurrents[gameIndex][node.parentId]
        }
      } else {
        delete gameCurrents[gameIndex][node.id]
      }

      return {gameCurrents}
    })

    this.setCurrentTreePosition(newTree, noParent ? node.id : node.parentId)
  }

  async removeOtherVariations(
    treePosition,
    {suppressConfirmation = false} = {},
  ) {
    let t = i18n.context('sabaki.node')

    if (
      suppressConfirmation !== true &&
      setting.get('edit.show_removeothervariations_warning')
    ) {
      let answer = await dialog.showMessageBox(
        t('Do you really want to remove all other variations?'),
        'warning',
        [t('Remove Variations'), t('Cancel')],
        1,
      )
      if (answer === 1) return
    }

    this.closeDrawer()
    this.setMode('play')

    let {gameCurrents, gameTrees} = this.state
    let {gameTree: tree} = this.inferredState
    let gameIndex = gameTrees.findIndex((t) => t.root.id === tree.root.id)
    if (gameIndex < 0) return

    let newTree = tree.mutate((draft) => {
      // Remove all subsequent variations

      for (let node of tree.listNodesVertically(
        treePosition,
        1,
        gameCurrents[gameIndex],
      )) {
        if (node.children.length <= 1) continue

        let next = tree.navigate(node.id, 1, gameCurrents[gameIndex])

        for (let child of node.children) {
          if (child.id === next.id) continue
          draft.removeNode(child.id)
        }
      }

      // Remove all precedent variations

      let prevId = treePosition

      for (let node of tree.listNodesVertically(treePosition, -1, {})) {
        if (node.id !== prevId && node.children.length > 1) {
          gameCurrents[gameIndex][node.id] = prevId

          for (let child of node.children) {
            if (child.id === prevId) continue
            draft.removeNode(child.id)
          }
        }

        prevId = node.id
      }
    })

    this.setState({gameCurrents})
    this.setCurrentTreePosition(newTree, treePosition)
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
        ...engines.map((engine) => ({
          label: engine.name || t('(Unnamed Engine)'),
          click: () => {
            this.attachEngines([engine])
          },
        })),
        engines.length > 0 && {type: 'separator'},
        {
          label: t('Manage &Engines…'),
          click: () => {
            this.setState({preferencesTab: 'engines'})
            this.openDrawer('preferences')
          },
        },
      ].filter((x) => !!x),
      x,
      y,
    )
  }

  openEngineActionMenu(syncerId, {x, y} = {}) {
    let t = i18n.context('menu.engineAction')
    let syncer = this.state.attachedEngineSyncers.find(
      (syncer) => syncer.id === syncerId,
    )
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
            this.detachEngines([syncerId])
          },
        },
        {type: 'separator'},
        {
          label: t('S&ynchronize'),
          click: () => {
            this.syncEngine(syncerId, this.state.treePosition)
          },
        },
        {
          label: t('&Generate Move'),
          enabled:
            !this.state.engineGameOngoing ||
            (this.state.blackEngineSyncerId !== syncerId &&
              this.state.whiteEngineSyncerId !== syncerId),
          click: async () => {
            this.generateMove(syncerId, this.state.treePosition)
          },
        },
        {type: 'separator'},
        {
          label: t('Set as &Analyzer'),
          type: 'checkbox',
          checked: this.state.analyzingEngineSyncerId === syncerId,
          click: () => {
            if (this.state.analyzingEngineSyncerId === syncerId) {
              this.stopAnalysis()
            } else {
              this.startAnalysis(syncerId)
            }
          },
        },
        {
          label: t('Set as &Black Player'),
          type: 'checkbox',
          checked: this.state.blackEngineSyncerId === syncerId,
          click: () => {
            this.setState((state) => ({
              blackEngineSyncerId:
                state.blackEngineSyncerId === syncerId ? null : syncerId,
            }))
          },
        },
        {
          label: t('Set as &White Player'),
          type: 'checkbox',
          checked: this.state.whiteEngineSyncerId === syncerId,
          click: () => {
            this.setState((state) => ({
              whiteEngineSyncerId:
                state.whiteEngineSyncerId === syncerId ? null : syncerId,
            }))
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
