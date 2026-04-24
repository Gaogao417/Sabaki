import {h, Component} from 'preact'
import sabaki from '../modules/sabaki.js'

import SplitContainer from './helpers/SplitContainer.js'
import WinrateGraph from './sidebars/WinrateGraph.js'
import Slider from './sidebars/Slider.js'
import GameGraph from './sidebars/GameGraph.js'
import CommentBox from './sidebars/CommentBox.js'
import BoardOverlayStack from './overlays/BoardOverlayStack.js'

const setting = {
  get: (key) => window.sabaki.setting.get(key),
  set: (key, value) => window.sabaki.setting.set(key, value),
}

const propertiesMinHeight = setting.get('view.properties_minheight')
const winrateGraphMinHeight = setting.get('view.winrategraph_minheight')
const winrateGraphMaxHeight = setting.get('view.winrategraph_maxheight')

export default class Sidebar extends Component {
  constructor(props) {
    super(props)

    this.state = {
      winrateGraphHeight: setting.get('view.winrategraph_height'),
      sidebarSplit: setting.get('view.properties_height'),
    }

    this.handleGraphNodeClick = ({button, gameTree, treePosition, x, y}) => {
      if (button === 0) {
        if (this.props.compareMode) {
          sabaki.compareWithTreePosition(treePosition)
        } else {
          sabaki.setCurrentTreePosition(gameTree, treePosition)
        }
      } else {
        sabaki.openNodeMenu(treePosition, {x, y})
      }
    }

    this.handleGraphNodeDoubleClick = ({button, gameTree, treePosition}) => {
      if (button !== 0) return

      sabaki.setCurrentTreePosition(gameTree, treePosition)
    }

    this.handleGraphNodeHoverChange = (treePosition) => {
      sabaki.setGraphHoverTreePosition(treePosition)
    }

    this.handleSliderChange = ({percent}) => {
      let moveNumber = Math.round(
        (this.props.gameTree.getHeight() - 1) * percent,
      )
      sabaki.goToMoveNumber(moveNumber)
    }

    this.handleWinrateGraphChange = ({index}) => {
      sabaki.goToMoveNumber(index)
    }

    this.handleSidebarSplitChange = ({sideSize}) => {
      sideSize = Math.min(
        Math.max(propertiesMinHeight, sideSize),
        100 - propertiesMinHeight,
      )

      this.setState({sidebarSplit: sideSize})
    }

    this.handleSidebarSplitFinish = () => {
      setting.set('view.properties_height', this.state.sidebarSplit)
    }

    this.handleWinrateGraphSplitChange = ({sideSize}) => {
      sideSize = Math.min(
        Math.max(winrateGraphMinHeight, sideSize),
        winrateGraphMaxHeight,
      )

      this.setState({winrateGraphHeight: sideSize})
    }

    this.handleWinrateGraphSplitFinish = () => {
      setting.set('view.winrategraph_height', this.state.winrateGraphHeight)
    }

    this.handleStartAutoscrolling = ({step}) => {
      sabaki.startAutoscrolling(step)
    }

    this.handleStopAutoscrolling = () => {
      sabaki.stopAutoscrolling()
    }

    this.handleCommentInput = (evt) => {
      sabaki.setComment(this.props.treePosition, evt)
    }
  }

  shouldComponentUpdate(nextProps) {
    return (
      nextProps.showSidebar != this.props.showSidebar || nextProps.showSidebar
    )
  }

  componentDidUpdate(_, {winrateGraphHeight, showWinrateGraph}) {
    if (
      winrateGraphHeight !== this.state.winrateGraphHeight ||
      showWinrateGraph !== this.state.showWinrateGraph
    ) {
      if (this.gameGraph != null) this.gameGraph.remeasure()
    }
  }

  render(
    {
      mode,
      lastPlayer,
      gameIndex,
      gameTree,
      gameCurrents,
      treePosition,
      compareMode,
      compareReferenceTreePosition,
      compareTargetTreePosition,
      editWorkspaceActive,
      editPreviewTab,
      editPreviewBoard,
      editPreviewOwnership,
      territoryMode,
      overlayUnavailableReason,
      boardTransformation,

      showWinrateGraph,
      showGameGraph,
      showCommentBox,

      graphGridSize,
      graphNodeSize,

      winrateData,
      scoreLeadData,
    },
    {winrateGraphHeight, sidebarSplit},
  ) {
    let node = gameTree.get(treePosition)
    let winrateGraphWidth = Math.max(
      Math.ceil((gameTree.getHeight() - 1) / 50) * 50,
      1,
    )
    let level = gameTree.getLevel(treePosition)
    let showEditPreview = editWorkspaceActive && editPreviewBoard != null
    let showGraphColumn = showGameGraph || showEditPreview
    let inspectorSidebar = editWorkspaceActive || mode === 'play'
    let hasAnalysisData =
      winrateData.some((x) => x != null) || scoreLeadData.some((x) => x != null)
    showWinrateGraph = showWinrateGraph && (inspectorSidebar || hasAnalysisData)
    let editPreviewLabel =
      editPreviewTab === 'reference' ? 'Preview: Reference' : 'Preview: Current'
    let editPreviewGobanProps = showEditPreview
      ? {
          id: 'goban-edit-preview',
          gameTree,
          treePosition,
          board: editPreviewBoard,
          highlightVertices: [],
          analysisType: null,
          analysis: null,
          paintMap: null,
          markerMap: null,
          compareSelectedVertices: [],
          dimmedStones: [],
          overlayGhostStoneMap: null,
          comparePending: false,
          compareMode: false,

          crosshair: false,
          showCoordinates: false,
          showMoveColorization: false,
          showMoveNumbers: false,
          showNextMoves: false,
          showSiblings: false,
          fuzzyStonePlacement: false,
          animateStonePlacement: false,

          playVariation: null,
          drawLineMode: null,
          transformation: boardTransformation,
          dragMode: false,
        }
      : null

    if (inspectorSidebar) {
      return h(
        'section',
        {
          ref: (el) => (this.element = el),
          id: 'sidebar',
          class: 'inspector-sidebar',
        },

        showWinrateGraph &&
          h(WinrateGraph, {
            lastPlayer,
            width: winrateGraphWidth,
            data: winrateData,
            scoreLeadData,
            currentIndex: level,
            onCurrentIndexChange: this.handleWinrateGraphChange,
          }),

        showEditPreview &&
          h(
            'section',
            {class: 'sidebar-card preview-card edit-preview-panel'},
            h(
              'div',
              {class: 'card-header edit-preview-panel__header'},
              h('strong', {class: 'card-title'}, editPreviewLabel),
              h('span', {}, 'Read-only preview'),
            ),
            h(
              'div',
              {class: 'preview-body edit-preview-panel__body'},
              h(
                'div',
                {class: 'edit-board-readonly mini-board'},
                h(BoardOverlayStack, {
                  territoryMode,
                  baselineOwnership: editPreviewOwnership,
                  unavailableReason: overlayUnavailableReason,
                  gobanProps: editPreviewGobanProps,
                  analysis: null,
                  lastMoveDeltaMap: null,
                  lastMoveDiffAvailable: false,
                  diffSourceType: null,
                  comparisonOwnership: null,
                }),
              ),
            ),
          ),

        showGameGraph &&
          h(
          'section',
          {class: 'sidebar-card game-tree-card'},
          h(
            'div',
            {class: 'card-header'},
            h('strong', {class: 'card-title'}, 'GAME TREE'),
          ),
          h(
            'div',
            {class: 'game-tree-body'},
            h(GameGraph, {
              ref: (component) => (this.gameGraph = component),

              gameTree,
              gameCurrents: gameCurrents[gameIndex],
              treePosition,
              showGameGraph: true,
              height: 100,
              gridSize: graphGridSize,
              nodeSize: graphNodeSize,

              onNodeClick: this.handleGraphNodeClick,
              onNodeDoubleClick: this.handleGraphNodeDoubleClick,
              onNodeHoverChange: this.handleGraphNodeHoverChange,
              compareReferenceTreePosition,
              compareTargetTreePosition,
            }),
          ),
        ),

        !editWorkspaceActive &&
          showCommentBox &&
          h(
            'section',
            {class: 'sidebar-card comment-card'},
            h(
              'div',
              {class: 'card-header'},
              h('strong', {class: 'card-title'}, 'COMMENTS'),
            ),
            h(
              'div',
              {class: 'comment-card-body'},
              h(CommentBox, {
                mode,
                gameTree,
                treePosition,
                showCommentBox,
                moveAnnotation:
                  node.data.BM != null
                    ? [-1, node.data.BM[0]]
                    : node.data.DO != null
                      ? [0, 1]
                      : node.data.IT != null
                        ? [1, 1]
                        : node.data.TE != null
                          ? [2, node.data.TE[0]]
                          : [null, 1],
                positionAnnotation:
                  node.data.UC != null
                    ? [-2, node.data.UC[0]]
                    : node.data.GW != null
                      ? [-1, node.data.GW[0]]
                      : node.data.DM != null
                        ? [0, node.data.DM[0]]
                        : node.data.GB != null
                          ? [1, node.data.GB[0]]
                          : [null, 1],
                title: node.data.N != null ? node.data.N[0] : '',
                comment: node.data.C != null ? node.data.C[0] : '',

                onCommentInput: this.handleCommentInput,
              }),
            ),
          ),
      )
    }

    return h(
      'section',
      {
        ref: (el) => (this.element = el),
        id: 'sidebar',
      },

      h(SplitContainer, {
        vertical: true,
        invert: true,
        sideSize: !showWinrateGraph ? 0 : winrateGraphHeight,

        sideContent: h(WinrateGraph, {
          lastPlayer,
          width: winrateGraphWidth,
          data: winrateData,
          scoreLeadData,
          currentIndex: level,
          onCurrentIndexChange: this.handleWinrateGraphChange,
        }),

        mainContent: h(SplitContainer, {
          vertical: true,
          sideSize: !showGraphColumn ? 100 : !showCommentBox ? 0 : sidebarSplit,
          procentualSplit: true,

          mainContent: h(
            'div',
            {
              ref: (el) => (this.horizontalSplitContainer = el),
              class: `graphproperties${showEditPreview ? ' has-edit-preview' : ''}`,
            },

            showEditPreview &&
              h(
                'section',
                {class: 'edit-preview-panel'},
                h(
                  'div',
                  {class: 'edit-preview-panel__header'},
                  h('strong', {}, editPreviewLabel),
                  h('span', {}, 'Read-only preview'),
                ),
                h(
                  'div',
                  {class: 'edit-preview-panel__body'},
                  h(
                    'div',
                    {class: 'edit-board-readonly'},
                    h(BoardOverlayStack, {
                      territoryMode,
                      baselineOwnership: editPreviewOwnership,
                      unavailableReason: overlayUnavailableReason,
                      gobanProps: editPreviewGobanProps,
                      analysis: null,
                      lastMoveDeltaMap: null,
                      lastMoveDiffAvailable: false,
                      diffSourceType: null,
                      comparisonOwnership: null,
                    }),
                  ),
                ),
              ),

            h(Slider, {
              showSlider: showGameGraph,
              text: level,
              percent:
                gameTree.getHeight() <= 1
                  ? 0
                  : (level / (gameTree.getHeight() - 1)) * 100,

              onChange: this.handleSliderChange,
              onStartAutoscrolling: this.handleStartAutoscrolling,
              onStopAutoscrolling: this.handleStopAutoscrolling,
            }),

            h(GameGraph, {
              ref: (component) => (this.gameGraph = component),

              gameTree,
              gameCurrents: gameCurrents[gameIndex],
              treePosition,
              showGameGraph,
              height: !showGameGraph
                ? 0
                : !showCommentBox
                  ? 100
                  : 100 - sidebarSplit,
              gridSize: graphGridSize,
              nodeSize: graphNodeSize,

              onNodeClick: this.handleGraphNodeClick,
              onNodeDoubleClick: this.handleGraphNodeDoubleClick,
              onNodeHoverChange: this.handleGraphNodeHoverChange,
              compareReferenceTreePosition,
              compareTargetTreePosition,
            }),
          ),

          sideContent: h(CommentBox, {
            mode,
            gameTree,
            treePosition,
            showCommentBox,
            moveAnnotation:
              node.data.BM != null
                ? [-1, node.data.BM[0]]
                : node.data.DO != null
                  ? [0, 1]
                  : node.data.IT != null
                    ? [1, 1]
                    : node.data.TE != null
                      ? [2, node.data.TE[0]]
                      : [null, 1],
            positionAnnotation:
              node.data.UC != null
                ? [-2, node.data.UC[0]]
                : node.data.GW != null
                  ? [-1, node.data.GW[0]]
                  : node.data.DM != null
                    ? [0, node.data.DM[0]]
                    : node.data.GB != null
                      ? [1, node.data.GB[0]]
                      : [null, 1],
            title: node.data.N != null ? node.data.N[0] : '',
            comment: node.data.C != null ? node.data.C[0] : '',

            onCommentInput: this.handleCommentInput,
          }),

          onChange: this.handleSidebarSplitChange,
          onFinish: this.handleSidebarSplitFinish,
        }),

        onChange: this.handleWinrateGraphSplitChange,
        onFinish: this.handleWinrateGraphSplitFinish,
      }),
    )
  }
}

Sidebar.getDerivedStateFromProps = function ({
  mode,
  editWorkspaceActive,
  showWinrateGraph,
  winrateData,
  scoreLeadData = [],
}) {
  let inspectorSidebar = editWorkspaceActive || mode === 'play'
  let hasAnalysisData =
    winrateData.some((x) => x != null) || scoreLeadData.some((x) => x != null)

  return {
    showWinrateGraph: showWinrateGraph && (inspectorSidebar || hasAnalysisData),
  }
}
