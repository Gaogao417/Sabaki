import {h, Component} from 'preact'

import Goban from './Goban.js'
import BoardToolbar from './BoardToolbar.js'
import WorkspaceDock from './WorkspaceDock.js'
import EditBar from './bars/EditBar.js'
import GuessBar from './bars/GuessBar.js'
import AutoplayBar from './bars/AutoplayBar.js'
import ScoringBar from './bars/ScoringBar.js'
import FindBar from './bars/FindBar.js'
import StudyBar from './bars/StudyBar.js'
import BoardOverlayStack from './overlays/BoardOverlayStack.js'

import sabaki from '../modules/sabaki.js'
import * as gametree from '../modules/gametree.js'

export default class MainView extends Component {
  constructor(props) {
    super(props)

    this.state = {
      gobanCrosshair: false,
      overlayStatusProps: null,
    }

    this.handleTogglePlayer = () => {
      let {gameTree, treePosition, currentPlayer, studyEnabled, studyPhase} =
        this.props
      if (studyEnabled && studyPhase === 'baseline') {
        sabaki.setStudyPlayer(-currentPlayer)
      } else if (studyEnabled && studyPhase === 'trial') {
        return
      } else {
        sabaki.setPlayer(treePosition, -currentPlayer)
      }
    }

    this.handleToolButtonClick = (evt) => {
      sabaki.setState({selectedTool: evt.tool})
    }

    this.handleFindButtonClick = (evt) =>
      sabaki.findMove(evt.step, {
        vertex: this.props.findVertex,
        text: this.props.findText,
      })

    this.handleOverlayStatusChange = (overlayStatusProps) => {
      this.setState(({overlayStatusProps: currentStatusProps}) => {
        let nextStatus = overlayStatusProps ?? null
        if (JSON.stringify(currentStatusProps) === JSON.stringify(nextStatus)) {
          return null
        }

        return {overlayStatusProps: nextStatus}
      })
    }

    this.handleGobanVertexClick = this.handleGobanVertexClick.bind(this)
    this.handleGobanLineDraw = this.handleGobanLineDraw.bind(this)
    this.handleGobanAreaSelect = this.handleGobanAreaSelect.bind(this)
    this.handleGobanAreaSelectPreview = this.handleGobanAreaSelectPreview.bind(this)
  }

  computeRectangleVertices(start, end, width, height) {
    let minX = Math.min(start[0], end[0])
    let maxX = Math.max(start[0], end[0])
    let minY = Math.min(start[1], end[1])
    let maxY = Math.max(start[1], end[1])
    let vertices = []

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x >= 0 && y >= 0 && x < width && y < height) {
          vertices.push([x, y])
        }
      }
    }

    return vertices
  }

  handleGobanAreaSelect({start, end}) {
    let {gameTree, treePosition} = this.props
    let board = gametree.getBoard(gameTree, treePosition)
    let vertices = this.computeRectangleVertices(start, end, board.width, board.height)
    if (vertices.length > 0) {
      sabaki.setAnalysisArea(vertices)
    }
  }

  handleGobanAreaSelectPreview({start, end}) {
    let {gameTree, treePosition} = this.props
    let board = gametree.getBoard(gameTree, treePosition)
    let vertices = this.computeRectangleVertices(start, end, board.width, board.height)
    sabaki.setState({highlightVertices: vertices})
  }

  componentDidMount() {
    // Pressing Ctrl/Cmd should show crosshair cursor on Goban in edit mode

    document.addEventListener('keydown', (evt) => {
      if (evt.key !== 'Control' || evt.key !== 'Meta') return

      if (this.props.mode === 'edit') {
        this.setState({gobanCrosshair: true})
      }
    })

    document.addEventListener('keyup', (evt) => {
      if (evt.key !== 'Control' || evt.key !== 'Meta') return

      if (this.props.mode === 'edit') {
        this.setState({gobanCrosshair: false})
      }
    })
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.mode !== 'edit') {
      this.setState({gobanCrosshair: false})
    }

    if (!nextProps.territoryMode && this.state.overlayStatusProps != null) {
      this.setState({overlayStatusProps: null})
    }
  }

  handleGobanVertexClick(evt) {
    sabaki.clickVertex(evt.vertex, evt)
  }

  handleGobanLineDraw(evt) {
    let {v1, v2} = evt.line
    sabaki.useTool(this.props.selectedTool, v1, v2)
    sabaki.editVertexData = null
  }

  buildCompareAnchorMap(board, markerMap, referenceVertex, targetVertex) {
    if (referenceVertex == null && targetVertex == null) return markerMap

    let nextMarkerMap =
      markerMap != null
        ? markerMap.map((row) => [...row])
        : board.signMap.map((row) => row.map(() => null))

    if (referenceVertex != null) {
      let [x, y] = referenceVertex
      if (nextMarkerMap[y]?.[x] != null) {
        nextMarkerMap[y][x] = null
      }

      if (nextMarkerMap[y] != null) {
        nextMarkerMap[y][x] = {type: 'point', label: '@compare-reference'}
      }
    }

    if (targetVertex != null) {
      let [x, y] = targetVertex

      if (nextMarkerMap[y] != null) {
        nextMarkerMap[y][x] = {type: 'point', label: '@compare-target'}
      }
    }

    return nextMarkerMap
  }

  render(
    {
      mode,
      gameIndex,
      gameTree,
      gameCurrents,
      treePosition,
      currentPlayer,
      studyMode,
      studyPhase,
      studyRenderBoard,
      studyCurrentPlayer,
      studyMarkerMap,
      gameInfo,

      deadStones,
      scoringMethod,
      scoreBoard,
      playVariation,
      analysis,
      analysisTreePosition,
      areaMap,
      overlayMode,
      compareMode,
      territoryMode,
      comparePending,
      compareReferenceTreePosition,
      compareTargetTreePosition,
      comparePaintMap,
      compareMarkerMap,
      compareReferenceVertex,
      compareTargetVertex,
      territoryOwnership,
      overlayUnavailableReason,
      lastMoveTerritoryDeltaMap,
      lastMoveTerritoryDiffAvailable,
      territoryStatusText,
      graphHoverTreePosition,
      blockedGuesses,

      highlightVertices,
      analysisAreaVertices,
      analysisAreaSelecting,
      analysisType,
      showAnalysis,
      showCoordinates,
      showMoveColorization,
      showMoveNumbers,
      showNextMoves,
      showSiblings,
      fuzzyStonePlacement,
      animateStonePlacement,
      boardTransformation,

      selectedTool,
      findText,
      findVertex,
      studyBaselineDirty,
      studyBaselineSnapshot,
      studyBaselineKeyPoints,
      studyBaselineOwnership,
      studyTrialOwnership,
      studyTrialDirty,
      studyTrialCommittedSignature,
      studyTrialHasSetupEdits,
      studyAnalysisPending,
    },
    {gobanCrosshair},
  ) {
    let compareReferencePosition =
      compareMode && compareReferenceTreePosition != null
        ? compareReferenceTreePosition
        : treePosition
    let node = gameTree.get(compareReferencePosition)
    let board = studyMode
      ? studyRenderBoard
      : gametree.getBoard(gameTree, compareReferencePosition)
    if (board == null) {
      board = gametree.getBoard(gameTree, compareReferencePosition)
    }
    currentPlayer = studyMode ? studyCurrentPlayer : currentPlayer
    let komi = +gametree.getRootProperty(gameTree, 'KM', 0)
    let handicap = +gametree.getRootProperty(gameTree, 'HA', 0)
    let paintMap
    let markerMap = null
    let compareSelectedVertices = []
    let dimmedStones = ['scoring', 'estimator'].includes(mode) ? deadStones : []
    let overlayGhostStoneMap = null

    if (['scoring', 'estimator'].includes(mode)) {
      paintMap = areaMap
    } else if (mode === 'guess') {
      paintMap = [...Array(board.height)].map((_) => Array(board.width).fill(0))

      for (let [x, y] of blockedGuesses) {
        paintMap[y][x] = 1
      }
    }

    if (compareMode && comparePaintMap != null) {
      paintMap = comparePaintMap
      markerMap = compareMarkerMap
    }

    if (analysisAreaVertices != null && !analysisAreaSelecting) {
      paintMap = board.signMap.map((row) => row.map(() => 0))
      let vertexSet = new Set(analysisAreaVertices.map((v) => `${v[0]},${v[1]}`))
      for (let y = 0; y < board.height; y++) {
        for (let x = 0; x < board.width; x++) {
          if (!vertexSet.has(`${x},${y}`)) {
            paintMap[y][x] = -0.3
          }
        }
      }
    }

    if (
      compareMode &&
      compareReferenceTreePosition != null &&
      compareTargetTreePosition != null &&
      gameTree.get(compareTargetTreePosition) != null
    ) {
      let referenceBoard = gametree.getBoard(
        gameTree,
        compareReferenceTreePosition,
      )
      let targetBoard = gametree.getBoard(gameTree, compareTargetTreePosition)
      let dimmedSet = new Set()

      overlayGhostStoneMap = referenceBoard.signMap.map((row) =>
        row.map(() => null),
      )

      for (let y = 0; y < referenceBoard.height; y++) {
        for (let x = 0; x < referenceBoard.width; x++) {
          let referenceSign = referenceBoard.signMap[y][x]
          let targetSign = targetBoard.signMap[y][x]

          if (targetSign !== 0) {
            compareSelectedVertices.push([x, y])
          }

          if (referenceSign !== 0) {
            dimmedSet.add(`${x},${y}`)
          }

          if (referenceSign !== 0 && referenceSign === targetSign) {
            dimmedSet.delete(`${x},${y}`)
          } else if (targetSign !== 0 && referenceSign !== targetSign) {
            overlayGhostStoneMap[y][x] = {sign: targetSign, type: 'compare'}
          }
        }
      }

      dimmedStones = [...dimmedSet].map((vertex) =>
        vertex.split(',').map(Number),
      )
      markerMap = this.buildCompareAnchorMap(
        referenceBoard,
        markerMap,
        compareReferenceVertex,
        compareTargetVertex,
      )
    }

    if (compareMode && compareReferenceTreePosition != null) {
      markerMap = this.buildCompareAnchorMap(
        board,
        markerMap,
        compareReferenceVertex,
        compareTargetVertex,
      )
    }

    if (
      !(compareMode && compareTargetTreePosition != null) &&
      graphHoverTreePosition != null &&
      graphHoverTreePosition !== compareReferencePosition &&
      gameTree.get(graphHoverTreePosition) != null
    ) {
      let hoverBoard = gametree.getBoard(gameTree, graphHoverTreePosition)
      overlayGhostStoneMap = board.signMap.map((row) => row.map(() => null))

      for (let y = 0; y < board.height; y++) {
        for (let x = 0; x < board.width; x++) {
          let currentSign = board.signMap[y][x]
          let hoverSign = hoverBoard.signMap[y][x]

          if (currentSign === 0 && hoverSign !== 0) {
            overlayGhostStoneMap[y][x] = {sign: hoverSign}
          } else if (currentSign !== hoverSign) {
            dimmedStones = [...dimmedStones, [x, y]]
          }
        }
      }
    }

    let gobanProps = {
      gameTree,
      treePosition: compareReferencePosition,
      board,
      highlightVertices:
        findVertex && mode === 'find' ? [findVertex] : highlightVertices,
      analysisType,
      analysis:
        !studyMode &&
        !compareMode &&
        showAnalysis &&
        analysisTreePosition != null &&
        analysisTreePosition === treePosition
          ? analysis
          : null,
      paintMap,
      markerMap:
        studyMode && studyMarkerMap != null ? studyMarkerMap : markerMap,
      compareSelectedVertices,
      dimmedStones,
      overlayGhostStoneMap,
      comparePending,
      compareMode,

      crosshair: gobanCrosshair || analysisAreaSelecting,
      showCoordinates,
      showMoveColorization,
      showMoveNumbers: mode !== 'edit' && showMoveNumbers,
      showNextMoves: mode !== 'guess' && showNextMoves,
      showSiblings: mode !== 'guess' && showSiblings,
      fuzzyStonePlacement,
      animateStonePlacement,

      playVariation,
      drawLineMode:
        mode === 'edit' && ['arrow', 'line'].includes(selectedTool)
          ? selectedTool
          : null,
      transformation: boardTransformation,

      onVertexClick: this.handleGobanVertexClick,
      onLineDraw: this.handleGobanLineDraw,

      areaSelectMode: analysisAreaSelecting,
      onAreaSelect: this.handleGobanAreaSelect,
      onAreaSelectPreview: this.handleGobanAreaSelectPreview,
    }

    let engineSyncers = [
      this.props.blackEngineSyncerId,
      this.props.whiteEngineSyncerId,
    ].map((id) =>
      this.props.attachedEngineSyncers.find((syncer) => syncer.id === id),
    )

    let workspaceSummary = studyMode
      ? studyPhase === 'trial'
        ? 'Trial workspace'
        : 'Baseline workspace'
      : territoryStatusText

    return h(
      'section',
      {id: 'main'},
      h(BoardToolbar, {
        mode,
        studyMode,
        territoryMode,
        currentPlayer,
        playerNames: gameInfo.playerNames,
        playerRanks: gameInfo.playerRanks,
        playerCaptures: [1, -1].map((sign) => board.getCaptures(sign)),
        engineSyncers,
        areaSelectActive: analysisAreaSelecting || analysisAreaVertices != null,
        onCurrentPlayerClick: this.handleTogglePlayer,
      }),

      h(
        'main',
        {
          ref: (el) => (this.mainElement = el),
          class: 'board-stage',
        },

        territoryMode
          ? h(BoardOverlayStack, {
              territoryMode,
              baselineOwnership: territoryOwnership,
              unavailableReason: overlayUnavailableReason,
              gobanProps,
              analysis: gobanProps.analysis,
              lastMoveDeltaMap: lastMoveTerritoryDeltaMap,
              lastMoveDiffAvailable: lastMoveTerritoryDiffAvailable,
              keyPointSummary: this.props.studyKeyPointSummary,
              onStatusChange: this.handleOverlayStatusChange,
            })
          : h(Goban, gobanProps),
      ),

      h(
        WorkspaceDock,
        {
          mode,
          studyMode,
          overlayStatusProps: this.state.overlayStatusProps,
          summaryText: workspaceSummary,
        },
        !studyMode &&
        h(EditBar, {
          mode,
          selectedTool,
          onToolButtonClick: this.handleToolButtonClick,
        }),

        !studyMode &&
          h(GuessBar, {
            mode,
            treePosition,
          }),

        !studyMode &&
          h(AutoplayBar, {
            mode,
            gameTree,
            gameCurrents: gameCurrents[gameIndex],
            treePosition,
          }),

        !studyMode &&
          h(ScoringBar, {
            type: 'scoring',
            mode,
            method: scoringMethod,
            scoreBoard,
            areaMap,
            komi,
            handicap,
          }),

        !studyMode &&
          h(ScoringBar, {
            type: 'estimator',
            mode,
            method: scoringMethod,
            scoreBoard,
            areaMap,
            komi,
            handicap,
          }),

        !studyMode &&
          h(FindBar, {
            mode,
            findText,
            onButtonClick: this.handleFindButtonClick,
          }),

        studyMode &&
          h(StudyBar, {
            mode,
            studyPhase,
            selectedTool,
            dirty: studyBaselineDirty,
            hasBaseline: studyBaselineSnapshot != null,
            keyPointCount: studyBaselineKeyPoints.length,
            moveCount: sabaki.getStudyTrialMoveCount(),
            analysisPending: studyAnalysisPending,
            ownershipReady: studyBaselineOwnership != null,
            trialReady:
              sabaki.hasStudyTrialMeaningfulChange() &&
              studyTrialOwnership != null &&
              !studyAnalysisPending,
            trialDirty: sabaki.hasStudyTrialMeaningfulChange(),
            committed:
              studyTrialCommittedSignature != null &&
              studyTrialCommittedSignature === sabaki.getStudyTrialSignature(),
            usingSetupEdits: studyTrialHasSetupEdits,
          }),
      ),
    )
  }
}
