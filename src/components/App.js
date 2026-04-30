import {ipcRenderer} from 'electron'
import {h, render, Component} from 'preact'
import classNames from 'classnames'
import fixPath from 'fix-path'
import path from 'path'
import fs from 'fs'

import influence from '@sabaki/influence'

import TripleSplitContainer from './helpers/TripleSplitContainer.js'
import ThemeManager from './ThemeManager.js'
import MainMenu from './MainMenu.js'
import MainView from './MainView.js'
import LeftSidebar from './LeftSidebar.js'
import Sidebar from './Sidebar.js'
import DrawerManager from './DrawerManager.js'
import InputBox from './InputBox.js'
import BusyScreen from './BusyScreen.js'
import InfoOverlay from './InfoOverlay.js'

import i18n from '../i18n.js'
import sabaki from '../modules/sabaki.js'
import * as gametree from '../modules/gametree.js'
import * as gtplogger from '../modules/gtplogger.js'
import * as helper from '../modules/helper.js'
import {boardFromSnapshot} from '../modules/study.js'

if (process.env.SABAKI_E2E) window.__sabaki = sabaki

const setting = {
  get: (key) => window.sabaki.setting.get(key),
  set: (key, value) => {
    window.sabaki.setting.set(key, value)
    return setting
  },
}
const t = i18n.context('App')

const leftSidebarMinWidth = setting.get('view.sidebar_minwidth')
const sidebarMinWidth = setting.get('view.leftsidebar_minwidth')

fixPath()

// Ensure common binary directories are on PATH for engine discovery
const extraPathsByPlatform = {
  linux: ['/usr/local/bin', '/usr/bin', '/snap/bin', path.join(process.env.HOME || '', '.local/bin')],
  darwin: ['/usr/local/bin', '/opt/homebrew/bin'],
  win32: [],
}

const extraPaths = extraPathsByPlatform[process.platform] || []
const currentPath = (process.env.PATH || '').split(path.delimiter)
for (const p of extraPaths) {
  if (p && !currentPath.includes(p) && fs.existsSync(p)) {
    process.env.PATH = p + path.delimiter + process.env.PATH
  }
}

const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
if (portableDir) process.chdir(portableDir)

class App extends Component {
  constructor(props) {
    super(props)

    this.state = {
      ...sabaki.state,
      overlayStatusProps: null,
    }

    sabaki.on('change', ({change, callback}) => this.setState(change, callback))

    let bind = (f) => f.bind(this)
    this.handleMainLayoutSplitChange = bind(this.handleMainLayoutSplitChange)
    this.handleMainLayoutSplitFinish = bind(this.handleMainLayoutSplitFinish)

    this.handleOverlayStatusChange = (overlayStatusProps) => {
      this.setState(({overlayStatusProps: current}) => {
        let next = overlayStatusProps ?? null
        if (JSON.stringify(current) === JSON.stringify(next)) return null
        return {overlayStatusProps: next}
      })
    }
  }

  componentDidMount() {
    gtplogger.updatePath()

    window.addEventListener('contextmenu', (evt) => {
      evt.preventDefault()
    })

    window.addEventListener('load', () => {
      sabaki.events.emit('ready')
    })

    ipcRenderer.on('load-file', (evt, ...args) => {
      setTimeout(
        () => sabaki.loadFile(...args),
        setting.get('app.loadgame_delay'),
      )
    })

    sabaki.window.on('focus', () => {
      if (setting.get('file.show_reload_warning')) {
        sabaki.askForReload()
      }
    })

    sabaki.window.on('resize', () => {
      clearTimeout(this.resizeId)

      this.resizeId = setTimeout(() => {
        if (
          !sabaki.window.isMaximized() &&
          !sabaki.window.isMinimized() &&
          !sabaki.window.isFullScreen()
        ) {
          let [width, height] = sabaki.window.getContentSize()
          setting.set('window.width', width).set('window.height', height)
        }
      }, 1000)
    })

    // Handle mouse wheel

    for (let el of document.querySelectorAll(
      '#main main, #graph, #winrategraph',
    )) {
      el.addEventListener('wheel', (evt) => {
        evt.preventDefault()

        if (this.residueDeltaY == null) this.residueDeltaY = 0
        this.residueDeltaY += evt.deltaY

        if (
          Math.abs(this.residueDeltaY) >=
          setting.get('game.navigation_sensitivity')
        ) {
          sabaki.goStep(Math.sign(this.residueDeltaY))
          this.residueDeltaY = 0
        }
      })
    }

    // Handle file drag & drop

    document.body.addEventListener('dragover', (evt) => evt.preventDefault())
    document.body.addEventListener('drop', (evt) => {
      evt.preventDefault()

      if (evt.dataTransfer.files.length === 0) return
      const filePath = window.sabaki.getPathForFile(evt.dataTransfer.files[0])
      sabaki.loadFile(filePath)
    })

    // Handle keys

    document.addEventListener('keydown', (evt) => {
      let typing = helper.isTextLikeElement(document.activeElement)
      let lowerKey = evt.key.toLowerCase()

      if (!typing && !evt.ctrlKey && !evt.metaKey) {
        if (!evt.altKey && lowerKey === 't') {
          evt.preventDefault()
          if (
            evt.shiftKey &&
            sabaki.state.mode === 'analysis' &&
            sabaki.state.editWorkspace != null
          ) {
            sabaki.toggleTerritoryCompareEnabled()
          } else if (!evt.shiftKey) {
            sabaki.toggleTerritoryEnabled()
          }
          return
        }
      }

      if (
        sabaki.state.mode === 'analysis' &&
        sabaki.state.editWorkspace != null &&
        !evt.ctrlKey &&
        !evt.metaKey &&
        !evt.altKey &&
        !typing
      ) {
        let key = evt.key

        if (['1', '2', '3', '4', 'Tab'].includes(key) || lowerKey === 'r' || lowerKey === 'p') {
          evt.preventDefault()
        }

        if (lowerKey === 'p') {
          let ws = sabaki.state.editWorkspace
          let tab = ws?.activeTab ?? 'current'
          let {snapshotKey} = sabaki.getEditWorkspaceTabKeys(tab)
          let snapshot = ws?.[snapshotKey]
          if (snapshot != null) {
            sabaki.setEditWorkspacePlayer(-snapshot.nextPlayer)
          }
          return
        }

        if (key === '1') {
          sabaki.setState({selectedTool: 'stone_1'})
          return
        }

        if (key === '2') {
          sabaki.setState({selectedTool: 'stone_-1'})
          return
        }

        if (key === '3') {
          sabaki.setState({selectedTool: 'eraser'})
          return
        }

        if (key === '4') {
          sabaki.setState({selectedTool: 'label'})
          return
        }

        if (lowerKey === 'r') {
          sabaki.captureEditReference()
          return
        }

        if (key === 'Tab') {
          let ws = sabaki.state.editWorkspace
          if (ws.referenceSnapshot != null) {
            sabaki.toggleEditTab(
              ws.activeTab === 'current' ? 'reference' : 'current',
            )
          }
          return
        }
      }

      if (evt.key === 'Escape') {
        if (sabaki.state.territoryEnabled) {
          sabaki.setTerritoryEnabled(false)
        } else if (sabaki.state.openDrawer != null) {
          sabaki.closeDrawer()
        } else if (sabaki.state.mode !== 'play') {
          sabaki.setMode('play')
        } else if (sabaki.state.fullScreen) {
          sabaki.setState({fullScreen: false})
        }
      } else if (
        !evt.ctrlKey &&
        !evt.metaKey &&
        ['ArrowUp', 'ArrowDown'].includes(evt.key)
      ) {
        if (
          sabaki.state.busy > 0 ||
          helper.isTextLikeElement(document.activeElement)
        )
          return

        evt.preventDefault()

        let sign = evt.key === 'ArrowUp' ? -1 : 1
        sabaki.startAutoscrolling(sign)
      } else if (
        (evt.ctrlKey || evt.metaKey) &&
        ['z', 'y'].includes(evt.key.toLowerCase())
      ) {
        if (sabaki.state.busy > 0) return

        // Hijack browser undo/redo

        evt.preventDefault()

        let step = evt.key.toLowerCase() === 'z' ? -1 : 1
        if (evt.shiftKey) step = -step

        let action = step < 0 ? 'undo' : 'redo'

        if (action != null) {
          if (helper.isTextLikeElement(document.activeElement)) {
            sabaki.window.webContents[action]()
          } else {
            sabaki[action]()
          }
        }
      }
    })

    document.addEventListener('keyup', (evt) => {
      if (['ArrowUp', 'ArrowDown'].includes(evt.key)) {
        sabaki.stopAutoscrolling()
      }
    })

    // Handle window closing

    window.addEventListener('beforeunload', (evt) => {
      if (this.closeWindow) return

      evt.returnValue = ' '

      setTimeout(async () => {
        if (await sabaki.askForSave()) {
          sabaki.detachEngines(
            this.state.attachedEngineSyncers.map((syncer) => syncer.id),
          )

          gtplogger.close()
          this.closeWindow = true
          sabaki.window.close()
        }
      })
    })

    sabaki.newFile()
  }

  componentDidUpdate(_, prevState = {}) {
    // Update title

    let {title} = sabaki.inferredState
    if (document.title !== title) document.title = title

    // Handle full screen & show menu bar

    if (prevState.fullScreen !== sabaki.state.fullScreen) {
      if (sabaki.state.fullScreen)
        sabaki.flashInfoOverlay(t('Press Esc to exit full screen mode'))
      sabaki.window.setFullScreen(sabaki.state.fullScreen)
    }

    if (prevState.showMenuBar !== sabaki.state.showMenuBar) {
      if (!sabaki.state.showMenuBar)
        sabaki.flashInfoOverlay(t('Press Alt to show menu bar'))
      sabaki.window.setMenuBarVisibility(sabaki.state.showMenuBar)
      sabaki.window.autoHideMenuBar = !sabaki.state.showMenuBar
    }

    // Handle bars & drawers

    if (
      ['estimator', 'scoring'].includes(prevState.mode) &&
      sabaki.state.mode !== 'estimator' &&
      sabaki.state.mode !== 'scoring' &&
      sabaki.state.openDrawer === 'score'
    ) {
      sabaki.closeDrawer()
    }

    // Handle sidebar showing/hiding

    let {showSidebar: prevShowSidebar} = sabaki.getInferredState(prevState)

    if (
      prevState.showLeftSidebar !== sabaki.state.showLeftSidebar ||
      prevShowSidebar !== sabaki.inferredState.showSidebar
    ) {
      let [width, height] = sabaki.window.getContentSize()
      let widthDiff = 0

      if (prevShowSidebar !== sabaki.inferredState.showSidebar) {
        widthDiff +=
          sabaki.state.sidebarWidth *
          (sabaki.inferredState.showSidebar ? 1 : -1)
      }

      if (prevState.showLeftSidebar !== sabaki.state.showLeftSidebar) {
        widthDiff +=
          sabaki.state.leftSidebarWidth *
          (sabaki.state.showLeftSidebar ? 1 : -1)
      }

      if (
        !sabaki.window.isMaximized() &&
        !sabaki.window.isMinimized() &&
        !sabaki.window.isFullScreen()
      ) {
        sabaki.window.setContentSize(Math.floor(width + widthDiff), height)
      }

      window.dispatchEvent(new Event('resize'))
    }

    // Handle zoom factor

    if (prevState.zoomFactor !== sabaki.state.zoomFactor) {
      sabaki.window.webContents.zoomFactor = sabaki.state.zoomFactor
    }

    // Clear overlay status when territory mode turns off

    if (prevState.territoryEnabled && !sabaki.state.territoryEnabled) {
      this.setState({overlayStatusProps: null})
    }
  }

  // User Interface

  handleMainLayoutSplitChange({beginSideSize, endSideSize}) {
    sabaki.setState(
      ({leftSidebarWidth, sidebarWidth, showLeftSidebar, mode}) => {
        let workbenchMode = ['play', 'recall', 'analysis'].includes(mode)
        return {
          leftSidebarWidth:
            showLeftSidebar || workbenchMode
              ? Math.max(beginSideSize, leftSidebarMinWidth)
              : leftSidebarWidth,
          sidebarWidth:
            sabaki.inferredState.showSidebar || workbenchMode
              ? Math.max(endSideSize, sidebarMinWidth)
              : sidebarWidth,
        }
      },
      () => window.dispatchEvent(new Event('resize')),
    )
  }

  handleMainLayoutSplitFinish() {
    setting
      .set('view.sidebar_width', this.state.sidebarWidth)
      .set('view.leftsidebar_width', this.state.leftSidebarWidth)
  }

  // Render

  render(_, state) {
    // Calculate some inferred values

    let inferredState = sabaki.inferredState
    let tree = inferredState.gameTree
    let editWorkspaceActive =
      state.mode === 'analysis' && state.editWorkspace != null
    let editWs = state.editWorkspace
    let editActiveTab =
      editWorkspaceActive &&
      editWs.activeTab === 'reference' &&
      editWs.referenceSnapshot != null
        ? 'reference'
        : 'current'
    let editPreviewTab =
      editWorkspaceActive && editWs.referenceSnapshot != null
        ? editActiveTab === 'reference'
          ? 'current'
          : 'reference'
        : null
    let editActiveKeys = editWorkspaceActive
      ? sabaki.getEditWorkspaceTabKeys(editActiveTab)
      : null
    let editPreviewKeys =
      editWorkspaceActive && editPreviewTab != null
        ? sabaki.getEditWorkspaceTabKeys(editPreviewTab)
        : null
    let editRenderSnapshot = editWorkspaceActive
      ? editWs[editActiveKeys.snapshotKey]
      : null
    let editRenderBoard =
      editRenderSnapshot == null ? null : boardFromSnapshot(editRenderSnapshot)
    let editCurrentPlayer = editWorkspaceActive
      ? (editRenderSnapshot?.nextPlayer ?? inferredState.currentPlayer)
      : inferredState.currentPlayer
    let editMarkerMap = editWorkspaceActive
      ? editWs[editActiveKeys.markerKey]
      : null
    let editLines = editWorkspaceActive ? editWs[editActiveKeys.linesKey] : null
    let editAnalysis = editWorkspaceActive
      ? editWs[editActiveKeys.analysisKey]
      : null
    let editPreviewSnapshot =
      editPreviewKeys == null ? null : editWs[editPreviewKeys.snapshotKey]
    let editPreviewBoard =
      editPreviewSnapshot == null
        ? null
        : boardFromSnapshot(editPreviewSnapshot)
    let editPreviewOwnership =
      editPreviewKeys == null ? null : editWs[editPreviewKeys.ownershipKey]
    let scoreBoard, areaMap
    let territoryOwnership = null
    let overlayUnavailableReason = null
    let territoryDeltaMap = null
    let territoryDiffAvailable = false
    let territoryDiffSourceType = null
    let territoryMode = state.territoryEnabled
    let activeAnalysis = editWorkspaceActive
      ? editAnalysis
      : state.analysisTreePosition === state.treePosition
        ? state.analysis
        : null

    if (['scoring', 'estimator'].includes(state.mode)) {
      // Calculate area map

      scoreBoard = gametree.getBoard(tree, state.treePosition).clone()

      for (let vertex of state.deadStones) {
        let sign = scoreBoard.get(vertex)
        if (sign === 0) continue

        scoreBoard.setCaptures(-sign, (x) => x + 1)
        scoreBoard.set(vertex, 0)
      }

      areaMap =
        state.mode === 'estimator'
          ? influence.map(scoreBoard.signMap, {discrete: true})
          : influence.areaMap(scoreBoard.signMap)
    }

    if (territoryMode) {
      let engineSyncer = inferredState.analyzingEngineSyncer
      territoryOwnership = editWorkspaceActive
        ? editWs[editActiveKeys.ownershipKey]
        : sabaki.getCurrentOwnership(engineSyncer)

      if (['scoring', 'estimator'].includes(state.mode)) {
        overlayUnavailableReason = t(
          'Territory overlay is unavailable while scoring or estimating.',
        )
      } else if (engineSyncer == null) {
        overlayUnavailableReason = t('Start engine analysis first.')
      } else if (
        editWorkspaceActive &&
        editWs.analysisPending &&
        territoryOwnership == null
      ) {
        overlayUnavailableReason = t('Waiting for ownership data...')
      } else if (territoryOwnership == null) {
        overlayUnavailableReason =
          state.analysisTreePosition !== state.treePosition ||
          activeAnalysis == null ||
          activeAnalysis.ownership == null
            ? t('Waiting for ownership data from the analysis engine...')
            : t('The current analysis engine does not provide ownership data.')
      }

      if (
        state.territoryCompareEnabled &&
        editWorkspaceActive &&
        editPreviewOwnership != null &&
        territoryOwnership != null
      ) {
        territoryDeltaMap = helper.getOwnershipDelta(
          editPreviewOwnership,
          territoryOwnership,
        )
        territoryDiffAvailable = territoryDeltaMap != null
        territoryDiffSourceType = territoryDiffAvailable ? 'workspace' : null
      }
    }

    let territoryStatusText = !territoryMode
      ? null
      : editWorkspaceActive
        ? state.territoryCompareEnabled
          ? t('Reference vs Current Territory')
          : editActiveTab === 'reference'
            ? t('Reference Territory')
            : t('Current Territory')
        : t('Territory')

    // Calculate inspector summary for the right sidebar Inspector card
    let inspectorSidebar =
      editWorkspaceActive || ['play', 'analysis'].includes(state.mode)
    let inspectorBoard =
      editWorkspaceActive && editRenderBoard != null
        ? editRenderBoard
        : gametree.getBoard(tree, state.treePosition)
    let inspectorLevel = tree.getLevel(state.treePosition)
    let inspectorSummary = inspectorSidebar
      ? {
          moveNumber: inspectorLevel,
          currentPlayer: inferredState.currentPlayer,
          playerCaptures: [1, -1].map((sign) => inspectorBoard.getCaptures(sign)),
          boardHeight: inspectorBoard.height,
        }
      : null

    state = {
      ...state,
      ...inferredState,
      editWorkspaceActive,
      editActiveTab,
      editPreviewTab,
      editRenderBoard,
      editCurrentPlayer,
      editMarkerMap,
      editAnalysis,
      editPreviewBoard,
      editPreviewOwnership,
      activeAnalysis,
      territoryMode,
      scoreBoard,
      areaMap,
      territoryOwnership,
      overlayUnavailableReason,
      territoryDeltaMap,
      territoryDiffAvailable,
      territoryDiffSourceType,
      territoryStatusText,
      comparisonOwnership: editWorkspaceActive ? editPreviewOwnership : null,
      overlayStatusProps: this.state.overlayStatusProps,
      onOverlayStatusChange: this.handleOverlayStatusChange,
      inspectorSummary,
    }

    let workbenchMode = ['play', 'recall', 'analysis'].includes(state.mode)
    let getWorkbenchSideWidth = (size) => {
      if (!workbenchMode) return 0

      let requested = Math.min(320, Math.max(280, size || 300))
      let availableWidth =
        typeof window === 'undefined' ? 1440 : window.innerWidth
      let responsiveMax = Math.floor((availableWidth - 220) / 2)

      return Math.max(100, Math.min(requested, responsiveMax))
    }
    let effectiveLeftSidebar = state.showLeftSidebar || workbenchMode
    let effectiveSidebar = state.showSidebar || workbenchMode

    return h(
      'section',
      {
        class: classNames({
          editWorkspace: state.editWorkspaceActive,
          inspectorShell: workbenchMode || state.editWorkspaceActive,
          modeLayout: workbenchMode,
          showleftsidebar: effectiveLeftSidebar,
          showsidebar: effectiveSidebar,
          [state.mode]: true,
        }),
      },

      h(ThemeManager),
      h(MainMenu, {
        mode: state.mode,
        showMenuBar: state.showMenuBar,
        disableAll: state.busy > 0,
        analysisType: state.analysisType,
        showAnalysis: state.showAnalysis,
        showCoordinates: state.showCoordinates,
        coordinatesType: state.coordinatesType,
        showMoveNumbers: state.showMoveNumbers,
        showMoveColorization: state.showMoveColorization,
        showNextMoves: state.showNextMoves,
        showSiblings: state.showSiblings,
        territoryEnabled: state.territoryEnabled,
        territoryCompareEnabled: state.territoryCompareEnabled,
        territoryCompareAvailable: sabaki.getTerritoryCompareAvailable(),
        showWinrateGraph: state.showWinrateGraph,
        showGameGraph: state.showGameGraph,
        showCommentBox: state.showCommentBox,
        showLeftSidebar: state.showLeftSidebar,
        engineGameOngoing: state.engineGameOngoing,
        quickAnalysisId: state.quickAnalysisId,
      }),

      h(TripleSplitContainer, {
        id: 'mainlayout',
        class: workbenchMode ? 'mode-layout' : '',

        beginSideSize: effectiveLeftSidebar
          ? workbenchMode
            ? getWorkbenchSideWidth(state.leftSidebarWidth)
            : state.leftSidebarWidth
          : 0,
        endSideSize: effectiveSidebar
          ? workbenchMode
            ? getWorkbenchSideWidth(state.sidebarWidth)
            : state.sidebarWidth
          : 0,

        beginSideContent: h(LeftSidebar, state),
        mainContent: h(MainView, state),
        endSideContent: h(Sidebar, state),

        onChange: this.handleMainLayoutSplitChange,
        onFinish: this.handleMainLayoutSplitFinish,
      }),

      h(DrawerManager, state),

      h(InputBox, {
        text: state.inputBoxText,
        show: state.showInputBox,
        onSubmit: state.onInputBoxSubmit,
        onCancel: state.onInputBoxCancel,
      }),

      h(BusyScreen, {show: state.busy > 0}),
      h(InfoOverlay, {
        text: state.infoOverlayText,
        show: state.showInfoOverlay,
      }),
    )
  }
}

// Render

render(h(App), document.body)
