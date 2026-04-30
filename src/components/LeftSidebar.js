import {h, Component} from 'preact'

import sabaki from '../modules/sabaki.js'
import * as gametree from '../modules/gametree.js'
import SplitContainer from './helpers/SplitContainer.js'
import GtpConsole from './sidebars/GtpConsole.js'
import {EnginePeerList} from './sidebars/PeerList.js'
import MiniGoban from './MiniGoban.js'

const setting = {
  get: (key) => window.sabaki.setting.get(key),
  set: (key, value) => window.sabaki.setting.set(key, value),
}
const peerListMinHeight = setting.get('view.peerlist_minheight')

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

function PanelButton({
  children,
  variant = 'secondary',
  disabled = false,
  onClick,
}) {
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
    }

    this.handlePeerListHeightChange = ({sideSize}) => {
      this.setState({peerListHeight: Math.max(sideSize, peerListMinHeight)})
    }

    this.handlePeerListHeightFinish = () => {
      setting.set('view.peerlist_height', this.state.peerListHeight)
    }

    this.handleReviewNoteInput = (evt) => {
      sabaki.setComment(this.props.treePosition, {
        comment: evt.currentTarget.value,
      })
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
      nextProps.showLeftSidebar !== this.props.showLeftSidebar ||
      nextProps.mode !== this.props.mode ||
      nextProps.treePosition !== this.props.treePosition ||
      nextProps.recallMoveIndex !== this.props.recallMoveIndex ||
      nextProps.recallUserAttempts !== this.props.recallUserAttempts ||
      nextProps.showLeftSidebar ||
      ['play', 'recall', 'analysis'].includes(nextProps.mode)
    )
  }

  renderWorkbenchSidebar({
    mode,
    gameTree,
    treePosition,
    editPreviewBoard,
    recallMoveIndex,
    recallExpectedMoves,
    recallCompleted,
    recallUserAttempts,
    recallShowHint,
  }) {
    let recallTotal = recallExpectedMoves?.length ?? 0
    let recallCorrect = (recallUserAttempts || []).filter(
      (a) => a.isCorrect,
    ).length
    let recallLastAttempt =
      recallUserAttempts?.length > 0
        ? recallUserAttempts[recallUserAttempts.length - 1]
        : null
    let node = gameTree.get(treePosition)
    let reviewNote = node?.data.C?.[0] ?? ''
    let moveNumber = gameTree.getLevel(treePosition)
    let rootBoard = gametree.getBoard(gameTree, gameTree.root.id)

    return h(
      'section',
      {
        ref: (el) => (this.element = el),
        id: 'leftsidebar',
        class: 'inspector-sidebar left-inspector-sidebar',
      },

      mode === 'play' &&
        h(
          Panel,
          {title: '当前任务'},
          h(
            'div',
            {class: 'task-heading'},
            h('strong', {}, '开始对局'),
            h('p', {}, '可在下方操作开始新的对局，或调整设置后开始。'),
          ),
          h('strong', {class: 'task-label'}, '下一步操作'),
          h(
            'div',
            {class: 'workbench-action-column'},
            h(
              PanelButton,
              {
                variant: 'primary',
                onClick: () =>
                  sabaki.newFile({playSound: true, showInfo: true}),
              },
              '+ 新对局',
            ),
            h(
              PanelButton,
              {
                onClick: () => sabaki.openDrawer('info'),
              },
              '对局设置',
            ),
            h(
              PanelButton,
              {
                variant: 'danger',
                onClick: () => sabaki.makeResign(),
              },
              '认输',
            ),
          ),
        ),
      mode === 'recall' &&
        h(
          Panel,
          {title: '全局回忆任务'},
          h(
            'div',
            {class: 'recall-workbench-summary'},
            h(
              'div',
              {class: 'recall-progress-ring'},
              recallTotal === 0
                ? '0%'
                : `${Math.round((recallMoveIndex / recallTotal) * 100)}%`,
            ),
            h(
              'div',
              {class: 'workbench-stat-list'},
              h(
                'div',
                {},
                h('strong', {}, '进度'),
                h(
                  'span',
                  {},
                  `${Math.min(recallMoveIndex + 1, recallTotal || 1)} / ${recallTotal || 0}`,
                ),
              ),
              h(
                'div',
                {},
                h('strong', {}, '正确'),
                h('span', {}, `${recallCorrect} 手`),
              ),
              h(
                'div',
                {},
                h('strong', {}, '状态'),
                h('span', {}, recallCompleted ? '已完成' : '进行中'),
              ),
            ),
          ),
          recallLastAttempt &&
            h(
              'p',
              {
                class: recallLastAttempt.isCorrect
                  ? 'recall-correct'
                  : 'recall-wrong',
              },
              recallLastAttempt.isCorrect ? '上一手校对正确' : '上一手需要复盘',
            ),
          h(
            'div',
            {class: 'workbench-action-row'},
            h(
              PanelButton,
              {
                variant: 'primary',
                disabled: recallCompleted,
                onClick: () => sabaki.skipRecallMove(),
              },
              '校对 / 跳过',
            ),
            h(
              PanelButton,
              {
                disabled: recallCompleted || recallShowHint,
                onClick: () => sabaki.showRecallHint(),
              },
              '提示',
            ),
            h(
              PanelButton,
              {
                variant: 'danger',
                onClick: () => sabaki.endRecallSession(),
              },
              recallCompleted ? '进入复盘' : '结束回忆',
            ),
          ),
        ),
      mode === 'analysis' &&
        h(
          Panel,
          {title: '关键点筛选'},
          h(
            'div',
            {class: 'workbench-filter-row'},
            h('button', {class: 'filter-chip active'}, '全部'),
            h('button', {class: 'filter-chip'}, '关键点'),
            h('button', {class: 'filter-chip'}, '失误'),
            h('button', {class: 'filter-chip'}, '备注'),
          ),
          h(
            'p',
            {class: 'workbench-muted'},
            '使用右侧变化树和评论区整理当前局面的复盘线索。',
          ),
        ),
      mode === 'analysis' &&
        h(
          Panel,
          {title: '复盘笔记'},
          h('textarea', {
            class: 'review-note-pad',
            value: reviewNote,
            placeholder: '记录这一手的想法',
            onInput: this.handleReviewNoteInput,
          }),
        ),
      mode === 'analysis' &&
        h(
          Panel,
          {title: '快照对比'},
          h(
            'div',
            {class: 'snapshot-preview'},
            h(MiniGoban, {
              board: editPreviewBoard ?? rootBoard,
              maxSize: 200,
              visible: true,
            }),
          ),
          h(
            'span',
            {class: 'workbench-muted'},
            editPreviewBoard != null
              ? '已捕捉参考局面，可与当前局面比较。'
              : '点击按钮捕捉当前局面作为参考快照。',
          ),
          h(
            'div',
            {class: 'workbench-action-row'},
            h(
              PanelButton,
              {
                variant: 'primary',
                onClick: () => sabaki.captureEditReference(),
              },
              '添加快照',
            ),
          ),
        ),
    )
  }

  renderTraditionalSidebar(
    {
      attachedEngineSyncers,
      analyzingEngineSyncerId,
      blackEngineSyncerId,
      whiteEngineSyncerId,
      engineGameOngoing,
      showLeftSidebar,
      consoleLog,
    },
    {peerListHeight, selectedEngineSyncerId},
  ) {
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

  render(props, state) {
    let {mode, editWorkspaceActive} = props
    let workbenchSidebar = ['play', 'recall', 'analysis'].includes(mode)

    return editWorkspaceActive || workbenchSidebar
      ? this.renderWorkbenchSidebar(props)
      : this.renderTraditionalSidebar(props, state)
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
