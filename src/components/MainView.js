import {h, Component} from 'preact'

import Goban from './Goban.js'
import BoardToolbar from './BoardToolbar.js'
import WorkspaceDock from './WorkspaceDock.js'
import EditBar from './bars/EditBar.js'
import GuessBar from './bars/GuessBar.js'
import AutoplayBar from './bars/AutoplayBar.js'
import ScoringBar from './bars/ScoringBar.js'
import FindBar from './bars/FindBar.js'
import BoardOverlayStack from './overlays/BoardOverlayStack.js'

import sabaki from '../modules/sabaki.js'
import * as gametree from '../modules/gametree.js'

export default class MainView extends Component {
  constructor(props) {
    super(props)

    this.state = {
      gobanCrosshair: false,
      areaModifierActive: false,
    }

    this.handleTogglePlayer = () => {
      let {
        treePosition,
        currentPlayer,
        editWorkspaceActive,
        editCurrentPlayer,
      } = this.props
      let player = editWorkspaceActive ? editCurrentPlayer : currentPlayer
      if (editWorkspaceActive) {
        sabaki.setEditWorkspacePlayer(-player)
      } else {
        sabaki.setPlayer(treePosition, -player)
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

    this.handleGobanVertexClick = this.handleGobanVertexClick.bind(this)
    this.handleGobanLineDraw = this.handleGobanLineDraw.bind(this)
    this.handleGobanAreaSelect = this.handleGobanAreaSelect.bind(this)
    this.handleGobanAreaSelectPreview =
      this.handleGobanAreaSelectPreview.bind(this)
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

  normalizeAreaRect(start, end) {
    return {
      start: [Math.min(start[0], end[0]), Math.min(start[1], end[1])],
      end: [Math.max(start[0], end[0]), Math.max(start[1], end[1])],
    }
  }

  getActiveBoard() {
    let {gameTree, treePosition, editWorkspaceActive, editRenderBoard} =
      this.props

    return editWorkspaceActive && editRenderBoard != null
      ? editRenderBoard
      : gametree.getBoard(gameTree, treePosition)
  }

  computeAreaVerticesFromRects(rects, board) {
    let vertexSet = new Set()

    for (let {start, end} of rects || []) {
      for (let vertex of this.computeRectangleVertices(
        start,
        end,
        board.width,
        board.height,
      )) {
        let key = vertex.join(',')
        if (vertexSet.has(key)) vertexSet.delete(key)
        else vertexSet.add(key)
      }
    }

    return [...vertexSet].map((vertex) => vertex.split(',').map(Number))
  }

  rectContainsVertex(rect, vertex) {
    return (
      vertex[0] >= rect.start[0] &&
      vertex[0] <= rect.end[0] &&
      vertex[1] >= rect.start[1] &&
      vertex[1] <= rect.end[1]
    )
  }

  handleGobanAreaSelect({start, end, operation}) {
    if (operation === 'clearAll') {
      sabaki.clearAnalysisArea()
      return
    }

    let board = this.getActiveBoard()
    let rects = [...(this.props.analysisAreaRects || [])]

    if (operation === 'removeRect') {
      let index = rects
        .map((rect, index) => ({rect, index}))
        .reverse()
        .find(({rect}) => this.rectContainsVertex(rect, start))?.index

      if (index == null) return

      rects.splice(index, 1)
    } else {
      rects.push(this.normalizeAreaRect(start, end))
    }

    sabaki.setAnalysisAreaRects(
      rects,
      this.computeAreaVerticesFromRects(rects, board),
    )
  }

  handleGobanAreaSelectPreview({start, end, operation}) {
    if (start == null || end == null) {
      sabaki.setState({highlightVertices: []})
      return
    }

    if (operation !== 'add') {
      sabaki.setState({highlightVertices: []})
      return
    }

    let board = this.getActiveBoard()
    let rects = [
      ...(this.props.analysisAreaRects || []),
      this.normalizeAreaRect(start, end),
    ]

    sabaki.setState({
      highlightVertices: this.computeAreaVerticesFromRects(rects, board),
    })
  }

  componentDidMount() {
    // Pressing Ctrl/Cmd should show crosshair cursor on Goban in edit mode

    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Control' || evt.key === 'Meta') {
        if (this.props.mode === 'edit') {
          this.setState({gobanCrosshair: true})
        }
        this.setState({areaModifierActive: true})
      } else if (evt.key === 'Alt') {
        this.setState({areaModifierActive: true})
      }
    })

    document.addEventListener('keyup', (evt) => {
      if (evt.key === 'Control' || evt.key === 'Meta') {
        if (this.props.mode === 'edit') {
          this.setState({gobanCrosshair: false})
        }
        this.setState({
          areaModifierActive: evt.ctrlKey || evt.metaKey || evt.altKey,
        })
        if (!evt.ctrlKey && !evt.metaKey && !evt.altKey) {
          sabaki.setState({highlightVertices: []})
        }
      } else if (evt.key === 'Alt') {
        this.setState({
          areaModifierActive: evt.ctrlKey || evt.metaKey || evt.altKey,
        })
        if (!evt.ctrlKey && !evt.metaKey && !evt.altKey) {
          sabaki.setState({highlightVertices: []})
        }
      }
    })
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.mode !== 'edit') {
      this.setState({gobanCrosshair: false})
    }
  }

  handleGobanVertexClick(evt) {
    sabaki.clickVertex(evt.vertex, evt)
  }

  handleGobanLineDraw(evt) {
    let {v1, v2} = evt.line
    let {mode, editWorkspaceActive, selectedTool} = this.props
    if (mode === 'edit' && editWorkspaceActive) {
      let ws = sabaki.state.editWorkspace
      if (ws != null) {
        let linesKey =
          ws.activeTab === 'reference' ? 'referenceLines' : 'currentLines'
        let lines = [...ws[linesKey], {v1, v2, type: selectedTool}]
        sabaki.setState({editWorkspace: {...ws, [linesKey]: lines}})
      }
      sabaki.editVertexData = null
    } else {
      sabaki.useTool(selectedTool, v1, v2)
      sabaki.editVertexData = null
    }
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

  renderBoardSurface({
    territoryMode,
    territoryOwnership,
    overlayUnavailableReason,
    gobanProps,
    territoryDeltaMap = null,
    territoryDiffAvailable = false,
    territoryDiffSourceType = null,
    comparisonOwnership = null,
    onStatusChange = this.props.onOverlayStatusChange,
  }) {
    return territoryMode
      ? h(BoardOverlayStack, {
          territoryMode,
          baselineOwnership: territoryOwnership,
          unavailableReason: overlayUnavailableReason,
          gobanProps,
          analysis: gobanProps.analysis,
          lastMoveDeltaMap: territoryDeltaMap,
          lastMoveDiffAvailable: territoryDiffAvailable,
          diffSourceType: territoryDiffSourceType,
          comparisonOwnership,
          onStatusChange,
        })
      : h(Goban, gobanProps)
  }

  render(
    {
      mode,
      gameIndex,
      gameTree,
      gameCurrents,
      treePosition,
      currentPlayer,
      editWorkspaceActive,
      editActiveTab,
      editRenderBoard,
      editCurrentPlayer,
      editMarkerMap,
      editLines,
      gameInfo,

      deadStones,
      scoringMethod,
      scoreBoard,
      playVariation,
      analysis,
      analysisTreePosition,
      activeAnalysis,
      areaMap,
      compareMode,
      territoryMode,
      territoryCompareEnabled,
      comparePending,
      compareReferenceTreePosition,
      compareTargetTreePosition,
      comparePaintMap,
      compareMarkerMap,
      compareReferenceVertex,
      compareTargetVertex,
      territoryOwnership,
      overlayUnavailableReason,
      territoryDeltaMap,
      territoryDiffAvailable,
      territoryDiffSourceType,
      territoryStatusText,
      comparisonOwnership,
      graphHoverTreePosition,
      blockedGuesses,

      highlightVertices,
      analysisAreaRects,
      analysisAreaVertices,
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
      editWorkspace: editWs,
    },
    {gobanCrosshair, areaModifierActive},
  ) {
    let compareReferencePosition =
      compareMode && compareReferenceTreePosition != null
        ? compareReferenceTreePosition
        : treePosition
    let node = gameTree.get(compareReferencePosition)
    let board = editWorkspaceActive
      ? editRenderBoard
      : gametree.getBoard(gameTree, compareReferencePosition)
    if (board == null) {
      board = gametree.getBoard(gameTree, compareReferencePosition)
    }
    if (editWorkspaceActive && editLines != null) {
      board.lines = editLines
    }
    currentPlayer = editWorkspaceActive ? editCurrentPlayer : currentPlayer
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

    if (analysisAreaVertices != null) {
      paintMap = board.signMap.map((row) => row.map(() => 0))
      let vertexSet = new Set(
        analysisAreaVertices.map((v) => `${v[0]},${v[1]}`),
      )
      for (let y = 0; y < board.height; y++) {
        for (let x = 0; x < board.width; x++) {
          if (!vertexSet.has(`${x},${y}`)) {
            paintMap[y][x] = -0.3
          }
        }
      }
    }

    if (
      !editWorkspaceActive &&
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
      !editWorkspaceActive &&
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
      analysis: !compareMode && showAnalysis ? activeAnalysis : null,
      paintMap,
      markerMap:
        editWorkspaceActive && editMarkerMap != null
          ? editMarkerMap
          : markerMap,
      compareSelectedVertices,
      dimmedStones,
      overlayGhostStoneMap,
      comparePending,
      compareMode,

      crosshair: gobanCrosshair || areaModifierActive,
      showCoordinates,
      showMoveColorization,
      showMoveNumbers: mode !== 'edit' && showMoveNumbers,
      showNextMoves: !editWorkspaceActive && mode !== 'guess' && showNextMoves,
      showSiblings: !editWorkspaceActive && mode !== 'guess' && showSiblings,
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
      dragMode: mode === 'edit' && editWorkspaceActive,
      onStoneDragEnd:
        mode === 'edit' && editWorkspaceActive
          ? (evt) => sabaki.handleEditDragEnd(evt)
          : null,

      onAreaSelect: this.handleGobanAreaSelect,
      onAreaSelectPreview: this.handleGobanAreaSelectPreview,
    }

    let engineSyncers = [
      this.props.blackEngineSyncerId,
      this.props.whiteEngineSyncerId,
    ].map((id) =>
      this.props.attachedEngineSyncers.find((syncer) => syncer.id === id),
    )

    return h(
      'section',
      {id: 'main'},
      h(BoardToolbar, {
        mode,
        editWorkspaceActive,
        territoryEnabled: territoryMode,
        territoryCompareEnabled,
        territoryCompareAvailable: sabaki.getTerritoryCompareAvailable(),
        currentPlayer,
        playerNames: gameInfo.playerNames,
        playerRanks: gameInfo.playerRanks,
        playerCaptures: [1, -1].map((sign) => board.getCaptures(sign)),
        engineSyncers,
        onCurrentPlayerClick: this.handleTogglePlayer,
      }),

      h(
        'main',
        {
          ref: (el) => (this.mainElement = el),
          class: 'board-stage',
        },

        editWorkspaceActive
          ? h(
              'div',
              {class: 'edit-stage'},
              h(
                'section',
                {class: 'edit-board-panel edit-board-panel--primary'},
                h(
                  'div',
                  {class: 'edit-board-panel__header'},
                  h(
                    'strong',
                    {},
                    editActiveTab === 'reference'
                      ? 'Large: Reference'
                      : 'Large: Current',
                  ),
                  h(
                    'span',
                    {},
                    territoryCompareEnabled
                      ? 'Editable | Preview diff'
                      : 'Editable',
                  ),
                ),
                h(
                  'div',
                  {class: 'edit-board-panel__body'},
                  this.renderBoardSurface({
                    territoryMode,
                    territoryOwnership,
                    overlayUnavailableReason,
                    gobanProps,
                    territoryDeltaMap,
                    territoryDiffAvailable,
                    territoryDiffSourceType,
                    comparisonOwnership,
                    onStatusChange: this.handleOverlayStatusChange,
                  }),
                ),
              ),
            )
          : this.renderBoardSurface({
              territoryMode,
              territoryOwnership,
              overlayUnavailableReason,
              gobanProps,
              territoryDeltaMap,
              territoryDiffAvailable,
              territoryDiffSourceType,
              onStatusChange: this.handleOverlayStatusChange,
            }),
      ),

      h(
        WorkspaceDock,
        {
          mode,
          editWorkspaceActive,
        },
        h(EditBar, {
          mode,
          selectedTool,
          onToolButtonClick: this.handleToolButtonClick,
          editWorkspace: editWs,
        }),

        h(GuessBar, {
          mode,
          treePosition,
        }),

        h(AutoplayBar, {
          mode,
          gameTree,
          gameCurrents: gameCurrents[gameIndex],
          treePosition,
        }),

        h(ScoringBar, {
          type: 'scoring',
          mode,
          method: scoringMethod,
          scoreBoard,
          areaMap,
          komi,
          handicap,
        }),

        h(ScoringBar, {
          type: 'estimator',
          mode,
          method: scoringMethod,
          scoreBoard,
          areaMap,
          komi,
          handicap,
        }),

        h(FindBar, {
          mode,
          findText,
          onButtonClick: this.handleFindButtonClick,
        }),
      ),
    )
  }
}
