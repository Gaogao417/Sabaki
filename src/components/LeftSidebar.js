import {h, Component} from 'preact'

import sabaki from '../modules/sabaki.js'
import SplitContainer from './helpers/SplitContainer.js'
import GtpConsole from './sidebars/GtpConsole.js'
import {EnginePeerList} from './sidebars/PeerList.js'
import BoardOverlayStack from './overlays/BoardOverlayStack.js'

const setting = {
  get: (key) => window.sabaki.setting.get(key),
  set: (key, value) => window.sabaki.setting.set(key, value),
}
const peerListMinHeight = setting.get('view.peerlist_minheight')

function getConsoleExcerptText(entry) {
  if (entry == null) return ''

  if (entry.command != null) {
    let {id, name = '', args = []} = entry.command
    return [id, name, ...(args || [])].filter(Boolean).join(' ')
  }

  let response = entry.response
  if (response == null) return ''

  if (typeof response === 'string') return response

  if (typeof response.content === 'string') {
    let prefix = response.internal ? '' : response.error ? '? ' : '= '
    return `${prefix}${response.content}`.trim()
  }

  if (response.internal) return 'Internal response'
  return response.error ? 'Engine error' : 'Engine response'
}

function Panel({title, actions, children}) {
  return h(
    'section',
    {class: 'panel-card workbench-panel-card'},
    h(
      'div',
      {class: 'panel-title'},
      title,
      actions && h('div', {class: 'panel-title-actions'}, actions),
    ),
    h('div', {class: 'workbench-panel-body'}, children),
  )
}

function PanelButton({children, variant = 'secondary', disabled = false, onClick}) {
  return h(
    'button',
    {
      type: 'button',
      class: `workbench-button workbench-button--${variant}`,
      disabled,
      onClick,
    },
    children,
  )
}

export default class LeftSidebar extends Component {
  constructor() {
    super()

    this.state = {
      peerListHeight: setting.get('view.peerlist_height'),
      selectedEngineSyncerId: null,
      engineLogExpanded: false,
    }

    this.handlePeerListHeightChange = ({sideSize}) => {
      this.setState({peerListHeight: Math.max(sideSize, peerListMinHeight)})
    }

    this.handlePeerListHeightFinish = () => {
      setting.set('view.peerlist_height', this.state.peerListHeight)
    }

    this.handleEngineLogToggle = () => {
      this.setState(({engineLogExpanded}) => ({engineLogExpanded: !engineLogExpanded}))
    }

    this.handleReviewNoteInput = (evt) => {
      sabaki.setComment(this.props.treePosition, {comment: evt.currentTarget.value})
    }

    this.handleCommandControlStep = ({step}) => {
      let {attachedEngineSyncers} = this.props
      let engineIndex = attachedEngineSyncers.findIndex(
        (syncer) => syncer.id === this.state.selectedEngineSyncerId,
      )

      let stepEngineIndex = Math.min(
        Math.max(0, engineIndex + step),
        attachedEngineSyncers.length - 1,
      )
      let stepEngine = this.props.attachedEngineSyncers[stepEngineIndex]

      if (stepEngine != null) {
        this.setState({selectedEngineSyncerId: stepEngine.id})
      }
    }

    this.handleEngineSelect = ({syncer}) => {
      this.setState({selectedEngineSyncerId: syncer.id}, () => {
        let input = this.element.querySelector('.gtp-console .input .command')

        if (input != null) {
          input.focus()
        }
      })
    }

    this.handleCommandSubmit = ({command}) => {
      let syncer = this.props.attachedEngineSyncers.find(
        (syncer) => syncer.id === this.state.selectedEngineSyncerId,
      )

      if (syncer != null) {
        syncer.queueCommand(command)
      }
    }
  }

  shouldComponentUpdate(nextProps) {
    return (
      nextProps.showLeftSidebar != this.props.showLeftSidebar ||
      nextProps.mode !== this.props.mode ||
      nextProps.treePosition !== this.props.treePosition ||
      nextProps.recallMoveIndex !== this.props.recallMoveIndex ||
      nextProps.recallUserAttempts !== this.props.recallUserAttempts ||
      nextProps.showLeftSidebar ||
      ['play', 'recall', 'analysis'].includes(nextProps.mode)
    )
  }

  render(
    {
      attachedEngineSyncers,
      analyzingEngineSyncerId,
      blackEngineSyncerId,
      whiteEngineSyncerId,
      engineGameOngoing,
      showLeftSidebar,
      consoleLog,
      mode,
      editWorkspaceActive,
      editPreviewBoard,
      editPreviewOwnership,
      editPreviewTab,
      territoryMode,
      overlayUnavailableReason,
      boardTransformation,
      gameTree,
      treePosition,
      gameInfo,
      currentPlayer,
      recallMoveIndex,
      recallExpectedMoves,
      recallCompleted,
      recallUserAttempts,
      recallShowHint,
    },
    {peerListHeight, selectedEngineSyncerId, engineLogExpanded},
  ) {
    let peerList = h(EnginePeerList, {
      attachedEngineSyncers,
      analyzingEngineSyncerId,
      blackEngineSyncerId,
      whiteEngineSyncerId,
      selectedEngineSyncerId,
      engineGameOngoing,

      onEngineSelect: this.handleEngineSelect,
    })
    let console = h(GtpConsole, {
      show: showLeftSidebar,
      consoleLog,
      attachedEngine: attachedEngineSyncers
        .map((syncer) =>
          syncer.id !== selectedEngineSyncerId
            ? null
            : {
                name: syncer.engine.name,
                get commands() {
                  return syncer.commands
                },
              },
        )
        .find((x) => x != null),

      onSubmit: this.handleCommandSubmit,
      onControlStep: this.handleCommandControlStep,
    })

    let workbenchSidebar = ['play', 'recall', 'analysis'].includes(mode)
    let inspectorSidebar = editWorkspaceActive || workbenchSidebar

    if (inspectorSidebar) {
      // Compute engine log excerpt (last 5 lines)
      let logExcerpt = consoleLog.slice(-5)
      let recallTotal = recallExpectedMoves?.length ?? 0
      let recallCorrect = (recallUserAttempts || []).filter((a) => a.isCorrect).length
      let recallLastAttempt =
        recallUserAttempts?.length > 0
          ? recallUserAttempts[recallUserAttempts.length - 1]
          : null
      let node = gameTree.get(treePosition)
      let reviewNote = node?.data.C?.[0] ?? ''

      // Compute edit preview goban props for reference card
      let showReferenceCard = editWorkspaceActive && editPreviewBoard != null
      let editPreviewGobanProps = showReferenceCard
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

      return h(
        'section',
        {
          ref: (el) => (this.element = el),
          id: 'leftsidebar',
          class: 'inspector-sidebar left-inspector-sidebar',
        },

        mode === 'play' &&
          h(Panel, {title: '当前对局'},
            h('div', {class: 'workbench-stat-list'},
              h('div', {}, h('strong', {}, '黑方'), h('span', {}, gameInfo?.playerNames?.[0] || 'Black')),
              h('div', {}, h('strong', {}, '白方'), h('span', {}, gameInfo?.playerNames?.[1] || 'White')),
              h('div', {}, h('strong', {}, '当前手番'), h('span', {}, currentPlayer > 0 ? '黑棋' : '白棋')),
            ),
          ),
        mode === 'play' &&
          h(Panel, {title: '局面控制'},
            h('div', {class: 'workbench-action-grid'},
              h(PanelButton, {variant: 'primary', onClick: () => sabaki.makeMove([-1, -1])}, '停一手'),
              h(PanelButton, {onClick: () => sabaki.setMode('find')}, '查找'),
              h(PanelButton, {onClick: () => sabaki.setMode('scoring')}, '数子'),
              h(PanelButton, {onClick: () => sabaki.setMode('estimator')}, '形势判断'),
            ),
          ),
        mode === 'recall' &&
          h(Panel, {title: '全局回忆任务'},
            h('div', {class: 'recall-workbench-summary'},
              h('div', {class: 'recall-progress-ring'},
                recallTotal === 0 ? '0%' : `${Math.round((recallMoveIndex / recallTotal) * 100)}%`,
              ),
              h('div', {class: 'workbench-stat-list'},
                h('div', {}, h('strong', {}, '进度'), h('span', {}, `${Math.min(recallMoveIndex + 1, recallTotal || 1)} / ${recallTotal || 0}`)),
                h('div', {}, h('strong', {}, '正确'), h('span', {}, `${recallCorrect} 手`)),
                h('div', {}, h('strong', {}, '状态'), h('span', {}, recallCompleted ? '已完成' : '进行中')),
              ),
            ),
            recallLastAttempt &&
              h(
                'p',
                {class: recallLastAttempt.isCorrect ? 'recall-correct' : 'recall-wrong'},
                recallLastAttempt.isCorrect ? '上一手校对正确' : '上一手需要复盘',
              ),
            h('div', {class: 'workbench-action-row'},
              h(PanelButton, {
                variant: 'primary',
                disabled: recallCompleted,
                onClick: () => sabaki.skipRecallMove(),
              }, '校对 / 跳过'),
              h(PanelButton, {
                disabled: recallCompleted || recallShowHint,
                onClick: () => sabaki.showRecallHint(),
              }, '提示'),
              h(PanelButton, {
                variant: 'danger',
                onClick: () => sabaki.endRecallSession(),
              }, recallCompleted ? '进入复盘' : '结束回忆'),
            ),
          ),
        mode === 'analysis' &&
          h(Panel, {title: '复盘流程'},
            h('ol', {class: 'review-flow-list'},
              h('li', {class: 'active'}, '定位关键局面'),
              h('li', {}, '标记失误与好手'),
              h('li', {}, '对比参考变化'),
              h('li', {}, '沉淀复盘笔记'),
            ),
          ),
        mode === 'analysis' &&
          h(Panel, {title: '关键点 / 失误 / 备注'},
            h('div', {class: 'workbench-filter-row'},
              h('button', {class: 'filter-chip active'}, '全部'),
              h('button', {class: 'filter-chip'}, '关键点'),
              h('button', {class: 'filter-chip'}, '失误'),
              h('button', {class: 'filter-chip'}, '备注'),
            ),
            h('p', {class: 'workbench-muted'}, '使用右侧变化树和评论区整理当前局面的复盘线索。'),
          ),
        mode === 'analysis' &&
          h(Panel, {title: '复盘笔记'},
            h('textarea', {
              class: 'review-note-pad',
              value: reviewNote,
              placeholder: 'Notes for this move',
              onInput: this.handleReviewNoteInput,
            }),
          ),
        mode !== 'recall' && peerList,
        mode !== 'recall' &&
          h(
          'section',
          {class: 'panel-card engine-card'},
          h('div', {class: 'panel-title'}, mode === 'play' ? '引擎日志' : 'ENGINE'),
          h('div', {class: 'engine-card-body'},
            // Engine status summary
            h('div', {class: 'engine-status-summary'},
              h('span', {class: 'engine-count'},
                `${attachedEngineSyncers.length} engine${attachedEngineSyncers.length !== 1 ? 's' : ''} attached`,
              ),
              analyzingEngineSyncerId != null && h('span', {class: 'engine-analyzing'}, 'Analyzing...'),
            ),
            // Collapsed: log excerpt + expand button
            !engineLogExpanded && h('div', {class: 'engine-log-excerpt'},
              h('ol', {class: 'log-excerpt-list'},
                logExcerpt.length === 0
                  ? h('li', {class: 'empty'}, 'No log entries yet.')
                  : logExcerpt.map((entry, i) => {
                      let text = getConsoleExcerptText(entry)
                      return h('li', {key: i},
                        h('span', {class: `log-entry ${entry.command ? 'command' : 'response'}`}, text),
                      )
                    }),
              ),
            ),
            !engineLogExpanded &&
              h('button', {
                class: 'engine-log-toggle',
                onClick: this.handleEngineLogToggle,
              }, 'Expand Console'),
            // Expanded: full GtpConsole + collapse button
            engineLogExpanded && h(GtpConsole, {
              show: showLeftSidebar && engineLogExpanded,
              consoleLog,
              attachedEngine: attachedEngineSyncers
                .map((syncer) =>
                  syncer.id !== selectedEngineSyncerId
                    ? null
                    : {
                        name: syncer.engine.name,
                        get commands() {
                          return syncer.commands
                        },
                      },
                )
                .find((x) => x != null),
              onSubmit: this.handleCommandSubmit,
              onControlStep: this.handleCommandControlStep,
            }),
            engineLogExpanded &&
              h('button', {
                class: 'engine-log-toggle',
                onClick: this.handleEngineLogToggle,
              }, 'Collapse Console'),
          ),
        ),
        showReferenceCard &&
          h(
            'section',
            {class: 'panel-card reference-card'},
            h('div', {class: 'panel-title'},
              editPreviewTab === 'reference' ? 'REFERENCE' : 'CURRENT',
              h('span', {class: 'reference-preview-label'}, 'Preview'),
            ),
            h('div', {class: 'reference-card-body'},
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
        !showReferenceCard && mode === 'play' &&
          h(
            'section',
            {class: 'panel-card reference-card'},
            h('div', {class: 'panel-title'}, 'POSITION PREVIEW'),
            h('div', {class: 'reference-card-body reference-empty'},
              h('span', {}, 'Current position'),
            ),
          ),
      )
    }

    return h(
      'section',
      {
        ref: (el) => (this.element = el),
        id: 'leftsidebar',
      },

      h(SplitContainer, {
        vertical: true,
        invert: true,
        sideSize: peerListHeight,

        sideContent: h(EnginePeerList, {
          attachedEngineSyncers,
          analyzingEngineSyncerId,
          blackEngineSyncerId,
          whiteEngineSyncerId,
          selectedEngineSyncerId,
          engineGameOngoing,

          onEngineSelect: this.handleEngineSelect,
        }),

        mainContent: h(GtpConsole, {
          show: showLeftSidebar,
          consoleLog,
          attachedEngine: attachedEngineSyncers
            .map((syncer) =>
              syncer.id !== selectedEngineSyncerId
                ? null
                : {
                    name: syncer.engine.name,
                    get commands() {
                      return syncer.commands
                    },
                  },
            )
            .find((x) => x != null),

          onSubmit: this.handleCommandSubmit,
          onControlStep: this.handleCommandControlStep,
        }),

        onChange: this.handlePeerListHeightChange,
        onFinish: this.handlePeerListHeightFinish,
      }),
    )
  }
}

LeftSidebar.getDerivedStateFromProps = (props, state) => {
  if (
    props.attachedEngineSyncers.length > 0 &&
    props.attachedEngineSyncers.find(
      (syncer) => syncer.id === state.selectedEngineSyncerId,
    ) == null
  ) {
    return {selectedEngineSyncerId: props.attachedEngineSyncers[0].id}
  } else if (props.attachedEngineSyncers.length === 0) {
    return {selectedEngineSyncerId: null}
  }
}
