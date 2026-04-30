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

// Helper functions for Inspector card
const alpha = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'

function formatMetric(metric) {
  if (metric == null) return '0.00 / 0'
  return `${metric.sum.toFixed(2)} / ${metric.intersections}`
}

function formatOwner(owner) {
  if (owner === 'neutral') return 'Neutral'
  if (owner === 'black') return 'Black'
  if (owner === 'white') return 'White'
  return ''
}

function formatVertex([x, y], boardHeight) {
  return `${alpha[x]}${boardHeight - y}`
}

function formatOptionalVertex(vertex, boardHeight) {
  return vertex == null ? '-' : formatVertex(vertex, boardHeight)
}

function formatSignedNumber(value, digits = 1) {
  if (value == null) return '-'

  let rounded = Math.round(value * 10 ** digits) / 10 ** digits
  if (rounded === 0) rounded = 0
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

function formatWinrate(value, sign) {
  if (value == null) return '-'

  let displayed = sign < 0 ? 100 - value : value
  return `${Math.round(displayed * 10) / 10}%`
}

function AnalysisSummaryCard({analysis, boardHeight}) {
  let hasAnalysis =
    analysis != null &&
    Array.isArray(analysis.variations) &&
    analysis.variations.length > 0
  let candidates = hasAnalysis ? analysis.variations.slice(0, 3) : []

  return h(
    'section',
    {class: 'sidebar-card inspector-card ai-analysis-card'},
    h('div', {class: 'card-header'}, h('strong', {class: 'card-title'}, 'AI 分析')),
    h(
      'div',
      {class: 'inspector-card-body'},
      !hasAnalysis &&
        h(
          'div',
          {class: 'analysis-empty-state analysis-empty-state--compact'},
          h('strong', {}, '暂无分析数据'),
          h('span', {}, '启动引擎分析后显示胜率、目数和候选点。'),
        ),
      hasAnalysis &&
        h(
          'div',
          {class: 'analysis-summary-grid'},
          h(
            'div',
            {class: 'analysis-summary-metric'},
            h('span', {}, '胜率'),
            h('strong', {}, formatWinrate(analysis.winrate, analysis.sign)),
          ),
          h(
            'div',
            {class: 'analysis-summary-metric'},
            h('span', {}, '目差'),
            h('strong', {}, formatSignedNumber(
              analysis.sign < 0 && analysis.scoreLead != null
                ? -analysis.scoreLead
                : analysis.scoreLead,
            )),
          ),
        ),
      candidates.length > 0 &&
        h(
          'ol',
          {class: 'candidate-move-list'},
          candidates.map((variation, index) =>
            h(
              'li',
              {key: index},
              h('strong', {}, formatOptionalVertex(variation.vertex, boardHeight)),
              h('span', {}, `${formatWinrate(variation.winrate, analysis.sign)} / ${formatSignedNumber(
                analysis.sign < 0 && variation.scoreLead != null
                  ? -variation.scoreLead
                  : variation.scoreLead,
              )}`),
            ),
          ),
        ),
    ),
  )
}

export default class Sidebar extends Component {
  constructor(props) {
    super(props)

    this.state = {
      winrateGraphHeight: setting.get('view.winrategraph_height'),
      sidebarSplit: setting.get('view.properties_height'),
    }

    this.handleGraphNodeClick = ({button, gameTree, treePosition, x, y}) => {
      if (button == null || button === 0) {
        sabaki.setCurrentTreePosition(gameTree, treePosition)
      } else {
        sabaki.openNodeMenu(treePosition, {x, y})
      }
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
      nextProps.showSidebar != this.props.showSidebar ||
      nextProps.mode !== this.props.mode ||
      nextProps.treePosition !== this.props.treePosition ||
      nextProps.recallMoveIndex !== this.props.recallMoveIndex ||
      nextProps.recallUserAttempts !== this.props.recallUserAttempts ||
      nextProps.showSidebar ||
      ['play', 'recall', 'analysis'].includes(nextProps.mode)
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
      editWorkspaceActive,
      editPreviewBoard,
      activeAnalysis,
      inspectorSummary,
      overlayStatusProps,
      recallMoveIndex,
      recallExpectedMoves,
      recallCompleted,
      recallUserAttempts,
      recallShowHint,

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
    let workbenchSidebar = ['play', 'recall', 'analysis'].includes(mode)
    let inspectorSidebar = editWorkspaceActive || workbenchSidebar
    let hasAnalysisData =
      winrateData.some((x) => x != null) || scoreLeadData.some((x) => x != null)
    showWinrateGraph =
      showWinrateGraph &&
      mode !== 'analysis' &&
      (inspectorSidebar || hasAnalysisData)

    if (inspectorSidebar) {
      let recallLastAttempt =
        recallUserAttempts?.length > 0
          ? recallUserAttempts[recallUserAttempts.length - 1]
          : null
      let recallExpected =
        recallExpectedMoves?.[recallMoveIndex]?.vertex ?? null

      return h(
        'section',
        {
          ref: (el) => (this.element = el),
          id: 'sidebar',
          class: 'inspector-sidebar',
        },

        mode === 'analysis' &&
          h(AnalysisSummaryCard, {
            analysis: activeAnalysis,
            boardHeight: inspectorSummary?.boardHeight ?? 19,
          }),

        showWinrateGraph &&
          h(WinrateGraph, {
            lastPlayer,
            width: winrateGraphWidth,
            data: winrateData,
            scoreLeadData,
            currentIndex: level,
            onCurrentIndexChange: this.handleWinrateGraphChange,
          }),

        mode === 'recall' &&
          h(
            'section',
            {class: 'sidebar-card inspector-card recall-side-card'},
            h('div', {class: 'card-header'}, h('strong', {class: 'card-title'}, '回忆提示')),
            h('div', {class: 'inspector-card-body'},
              h('div', {class: 'inspector-section'},
                h('div', {class: 'inspector-row'},
                  h('strong', {}, '下一手'),
                  h('span', {}, recallShowHint && recallExpected != null ? recallExpected : '保持回忆'),
                ),
                h('div', {class: 'inspector-hint'},
                  recallShowHint ? '提示已显示，落子后会继续推进。' : '需要时从左栏打开提示。',
                ),
              ),
              recallLastAttempt &&
                h('div', {class: `inspector-section ${recallLastAttempt.isCorrect ? '' : 'inspector-warning'}`},
                  h('span', {}, recallLastAttempt.isCorrect ? '上一手正确。' : `上一手实际应为 ${recallLastAttempt.expectedMove}。`),
                ),
              recallCompleted &&
                h('div', {class: 'inspector-section'},
                  h('span', {}, '本轮回忆完成，可以进入复盘。'),
                ),
            ),
          ),

        // Inspector card with structured sections
        mode !== 'recall' && h(
          'section',
          {class: 'sidebar-card inspector-card'},
          h('div', {class: 'card-header'}, h('strong', {class: 'card-title'}, mode === 'analysis' ? '局面点评' : '局面信息')),
          h('div', {class: 'inspector-card-body'},
            // Section 1: Position Summary (always visible in inspector mode)
            inspectorSummary != null &&
              h('div', {class: 'inspector-section'},
                h('div', {class: 'inspector-row'},
                  h('strong', {}, 'Move'),
                  h('span', {}, `${inspectorSummary.moveNumber}`),
                ),
                h('div', {class: 'inspector-row'},
                  h('strong', {}, 'Captures'),
                  h('span', {}, `B ${inspectorSummary.playerCaptures[0]} / W ${inspectorSummary.playerCaptures[1]}`),
                ),
              ),

            // Section 2: Overlay Status (visible when territory mode active)
            overlayStatusProps != null && overlayStatusProps.unavailableReason != null
              ? h('div', {class: 'inspector-section inspector-warning'},
                  h('span', {}, overlayStatusProps.unavailableReason),
                )
              : overlayStatusProps != null && overlayStatusProps.hoveredRegion != null
                ? h('div', {class: 'inspector-section inspector-hover'},
                    h('div', {class: 'inspector-row'},
                      h('strong', {}, 'Region'),
                      h('span', {}, formatOwner(overlayStatusProps.hoveredRegion.owner)),
                    ),
                    overlayStatusProps.hoveredVertex &&
                      h('div', {class: 'inspector-row'},
                        h('strong', {}, 'Vertex'),
                        h('span', {}, formatVertex(overlayStatusProps.hoveredVertex, inspectorSummary?.boardHeight ?? 19)),
                      ),
                    h('div', {class: 'inspector-row'},
                      h('strong', {}, 'Total'),
                      h('span', {}, formatMetric(overlayStatusProps.hoveredRegion.total)),
                    ),
                    overlayStatusProps.hoveredDelta != null &&
                      h('div', {class: 'inspector-row'},
                        h('strong', {}, 'Delta'),
                        h('span', {}, `${overlayStatusProps.hoveredDelta > 0 ? '+' : ''}${overlayStatusProps.hoveredDelta.toFixed(2)}`),
                      ),
                  )
                : overlayStatusProps != null
                  ? h('div', {class: 'inspector-section inspector-idle'},
                      overlayStatusProps.territorySummary != null && [
                        h('div', {class: 'inspector-row'},
                          h('strong', {}, 'Black'),
                          h('span', {}, formatMetric(overlayStatusProps.territorySummary.black.total)),
                        ),
                        h('div', {class: 'inspector-row'},
                          h('strong', {}, 'White'),
                          h('span', {}, formatMetric(overlayStatusProps.territorySummary.white.total)),
                        ),
                        h('div', {class: 'inspector-row'},
                          h('strong', {}, 'Neutral'),
                          h('span', {}, formatMetric(overlayStatusProps.territorySummary.neutral.total)),
                        ),
                      ],
                      h('div', {class: 'inspector-hint'},
                        h('span', {}, 'Hover a region to inspect ownership.'),
                      ),
                    )
                  : null,

            // Section 3: Diff summary (visible when comparing)
            overlayStatusProps != null && overlayStatusProps.deltaSummary != null &&
              h('div', {class: 'inspector-section inspector-diff'},
                h('div', {class: 'inspector-row'},
                  h('strong', {}, 'Black Gain'),
                  h('span', {}, formatMetric(overlayStatusProps.deltaSummary.black)),
                ),
                h('div', {class: 'inspector-row'},
                  h('strong', {}, 'White Gain'),
                  h('span', {}, formatMetric(overlayStatusProps.deltaSummary.white)),
                ),
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
            h('strong', {class: 'card-title'}, mode === 'recall' ? '轻量变化树' : '变化树'),
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
            }),
          ),
        ),

        mode === 'analysis' &&
          h(
            'section',
            {class: 'sidebar-card inspector-card'},
            h('div', {class: 'card-header'}, h('strong', {class: 'card-title'}, '快照对比')),
            h('div', {class: 'inspector-card-body'},
              h('div', {class: 'inspector-section'},
                h('span', {}, editPreviewBoard != null ? '已捕捉参考局面，可与当前局面比较。' : '捕捉参考局面后可进行快照对比。'),
              ),
            ),
          ),

        !editWorkspaceActive &&
          mode !== 'recall' &&
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
          sideSize: !showGameGraph ? 100 : !showCommentBox ? 0 : sidebarSplit,
          procentualSplit: true,

          mainContent: h(
            'div',
            {
              ref: (el) => (this.horizontalSplitContainer = el),
              class: 'graphproperties',
            },

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
  let inspectorSidebar =
    editWorkspaceActive || ['play', 'recall', 'analysis'].includes(mode)
  let hasAnalysisData =
    winrateData.some((x) => x != null) || scoreLeadData.some((x) => x != null)

  return {
    showWinrateGraph: showWinrateGraph && (inspectorSidebar || hasAnalysisData),
  }
}
