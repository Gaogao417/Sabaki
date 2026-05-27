import {h} from 'preact'
import EditBar from '../../bars/EditBar.js'

/**
 * Mode-specific action button definitions.
 * Each entry: { testId, label, callback, variant? }
 */
const MODE_ACTIONS = {
  play: [
    {testId: 'action-undo', label: '悔棋', callback: 'onUndo'},
    {testId: 'action-pass', label: 'Pass', callback: 'onPass'},
    {
      testId: 'action-mark-doubtful',
      label: '标记疑问手',
      callback: 'onMarkDoubtful',
    },
  ],
  problem: [
    {testId: 'action-undo', label: '悔棋', callback: 'onUndo'},
    {testId: 'action-redo', label: '重做', callback: 'onRedo'},
    {testId: 'action-pass', label: 'Pass', callback: 'onPass'},
    {testId: 'action-request-hint', label: '提示', callback: 'onRequestHint'},
  ],
  recall: [
    {testId: 'action-hint', label: '提示', callback: 'onHint'},
    {testId: 'action-verify-skip', label: '校对跳过', callback: 'onVerifySkip'},
  ],
  analysis: [
    {testId: 'action-undo', label: '悔棋', callback: 'onUndo'},
    {testId: 'action-redo', label: '重做', callback: 'onRedo'},
    {testId: 'action-clear', label: '清除', callback: 'onClear'},
    {
      testId: 'action-edit-position',
      label: '编辑局面',
      callback: 'onEditPosition',
    },
  ],
}

const VIEW_ACTIONS = [
  {testId: 'action-select', label: '选择', callback: 'onSelect'},
  {testId: 'action-zoom-in', label: '放大', callback: 'onZoomIn'},
  {testId: 'action-zoom-out', label: '缩小', callback: 'onZoomOut'},
  {testId: 'action-fullscreen', label: '全屏', callback: 'onFullscreen'},
]

const WORKSPACE_LABELS = {
  play: '对局工作区',
  problem: '做题工作区',
  recall: '回忆工作区',
  analysis: '复盘工作区',
}

/**
 * BottomActionBar renders mode-specific and common action buttons.
 *
 * @param {Object} props
 * @param {string} props.mode - Current mode
 * @param {string} [props.workspaceLabel] - Workspace label text; defaults by mode
 * @param {number} [props.moveNumber] - Current move number
 * @param {string} [props.engineStatus] - Engine status text
 * @param {Function} [props.onUndo] - Undo action
 * @param {Function} [props.onRedo] - Redo action
 * @param {Function} [props.onPass] - Pass action
 * @param {Function} [props.onResign] - Resign action
 * @param {Function} [props.onEndAttempt] - End attempt action
 * @param {Function} [props.onMarkDoubtful] - Mark doubtful action
 * @param {Function} [props.onRequestHint] - Request hint action
 * @param {Function} [props.onSubmitAnswer] - Submit answer action
 * @param {Function} [props.onAbandonAnswer] - Abandon answer action
 * @param {Function} [props.onMarkCheckpoint] - Mark checkpoint action
 * @param {Function} [props.onHint] - Hint action
 * @param {Function} [props.onVerifySkip] - Verify skip action
 * @param {Function} [props.onEnterAnalysis] - Enter analysis action
 * @param {Function} [props.onClear] - Clear action
 * @param {Function} [props.onEditPosition] - Edit position action
 * @param {Function} [props.onSnapshot] - Snapshot action
 * @param {Function} [props.onSelect] - Select action
 * @param {Function} [props.onHandShape] - Hand shape action
 * @param {Function} [props.onZoomIn] - Zoom in action
 * @param {Function} [props.onZoomOut] - Zoom out action
 * @param {Function} [props.onFullscreen] - Fullscreen action
 * @param {string|null} [props.activeAnnotationTool] - Active annotation tool key (analysis only)
 * @param {Function} [props.onAnnotationToolChange] - Annotation tool selection callback
 */
export default function BottomActionBar({
  mode = 'play',
  workspaceLabel,
  moveNumber = 0,
  engineStatus = '引擎就绪',
  opponentType = 'self',
  problemAreaSet = true,
  recallProgress = 0,
  recallTotal = 0,
  recallWaiting = true,
  keyPointCount = 0,
  snapshotCount = 0,
  activeAnnotationTool = null,
  onAnnotationToolChange = () => {},
  selectedTool = null,
  editBarSabaki = null,
  editWorkspace = null,
  overlayStore = null,
  areaSelectMode = false,
  analysisAreaVertices = null,
  territoryEnabled = false,
  territoryCompareEnabled = false,
  territoryCompareAvailable = true,
  showAISuggestions = false,
  showHumanPreference = false,
  ...callbacks
}) {
  const modeActions = MODE_ACTIONS[mode] || []
  const label =
    workspaceLabel || WORKSPACE_LABELS[mode] || WORKSPACE_LABELS.play
  const isCheckpoint =
    mode === 'recall' &&
    (callbacks.activeCheckpoint ||
      callbacks.activeCheckpointId ||
      String(callbacks.recallSubstate || '').startsWith('checkpoint'))

  function actionBtn(btn) {
    const cls =
      btn.variant === 'danger'
        ? 'wb-btn wb-btn--sm wb-btn-danger'
        : btn.variant === 'primary'
          ? 'wb-btn wb-btn--sm wb-btn-primary'
          : 'wb-btn wb-btn--sm wb-btn-ghost'
    return h(
      'button',
      {
        'data-testid': btn.testId,
        class: cls,
        onClick: () => {
          const handler = callbacks[btn.callback]
          if (handler) handler()
        },
      },
      btn.label,
    )
  }

  /** Build mode-specific status segments */
  function renderStatusSegments() {
    const segs = []

    segs.push(h('span', {class: 'wb-status-text__label'}, label))
    segs.push(h('span', {class: 'wb-status-text__divider'}))

    if (mode === 'recall') {
      segs.push(
        h(
          'span',
          {class: 'wb-status-text__value'},
          `当前进度 ${recallProgress} / ${recallTotal}`,
        ),
      )
      segs.push(h('span', {class: 'wb-status-text__divider'}))
      segs.push(
        h(
          'span',
          {class: 'wb-status-text__value'},
          recallWaiting ? '等待输入下一手' : '',
        ),
      )
    } else if (mode === 'problem') {
      segs.push(
        h('span', {class: 'wb-status-text__value'}, `当前第 ${moveNumber} 手`),
      )
      segs.push(h('span', {class: 'wb-status-text__divider'}))
      segs.push(
        h(
          'span',
          {class: 'wb-status-text__value'},
          `对方：${opponentType === 'ai' ? 'AI' : '自己'}`,
        ),
      )
      segs.push(h('span', {class: 'wb-status-text__divider'}))
      segs.push(
        h(
          'span',
          {class: 'wb-status-text__value'},
          `题目范围：${problemAreaSet ? '已设置' : '未设置'}`,
        ),
      )
    } else if (mode === 'analysis') {
      segs.push(
        h('span', {class: 'wb-status-text__value'}, `当前第 ${moveNumber} 手`),
      )
      segs.push(h('span', {class: 'wb-status-text__divider'}))
      segs.push(
        h(
          'span',
          {class: 'wb-status-text__value'},
          `关键点 ${keyPointCount} · Snapshot ${snapshotCount}`,
        ),
      )
    } else {
      // play
      segs.push(
        h('span', {class: 'wb-status-text__value'}, `当前第 ${moveNumber} 手`),
      )
      segs.push(h('span', {class: 'wb-status-text__divider'}))
      segs.push(h('span', {class: 'wb-status-text__value'}, engineStatus))
    }

    return segs
  }

  function visualButton(label, callback, options = {}) {
    return h(
      'button',
      {
        class: [
          'wb-visual-action',
          options.primary ? 'wb-visual-action--primary' : '',
          options.disabled ? 'wb-visual-action--disabled' : '',
        ]
          .filter(Boolean)
          .join(' '),
        'data-testid': options.testId,
        disabled: options.disabled,
        onClick: callback,
      },
      label,
    )
  }

  function renderVisualActions() {
    if (isCheckpoint) {
      return [
        visualButton('撤销修正手', callbacks.onUndo),
        visualButton('清空修正图', callbacks.onClear),
        visualButton('保存修正图', callbacks.onSubmitCorrection, {
          primary: true,
        }),
        visualButton('显示 AI 候选', callbacks.onRevealAI),
        visualButton('继续 Recall  →', callbacks.onEndRecall, {disabled: true}),
      ]
    }

    if (mode === 'problem') {
      return [
        visualButton('↶  悔棋', callbacks.onUndo),
        visualButton('↷  重做', callbacks.onRedo, {disabled: true}),
        visualButton('💡  请求提示', callbacks.onRequestHint),
        visualButton(
          '✈  提交',
          callbacks.onSubmitAnswer || callbacks.onSubmit,
          {primary: true},
        ),
      ]
    }

    if (mode === 'recall') {
      return [
        visualButton('↻  重试当前手', callbacks.onUndo),
        visualButton('←  显示上一手', callbacks.onVerifySkip),
        visualButton('▷▷  跳过', callbacks.onVerifySkip),
        visualButton('继续  →', callbacks.onEndRecall, {primary: true}),
      ]
    }

    if (mode === 'analysis') {
      return h(
        'div',
        {
          class: 'wb-edit-toolbar-drawer',
          'data-testid': 'analysis-edit-toolbar',
        },
        h(EditBar, {
          mode,
          sabaki: editBarSabaki,
          selectedTool: selectedTool || activeAnnotationTool || 'stone_1',
          onToolButtonClick: (evt) => onAnnotationToolChange(evt.tool),
          editWorkspace,
          overlayStore,
          territoryEnabled,
          territoryCompareEnabled,
          territoryCompareAvailable,
          showAISuggestions,
          showHumanPreference,
          areaSelectMode,
          analysisAreaVertices,
        }),
      )
    }

    return [
      visualButton('↶  悔棋', callbacks.onUndo),
      visualButton('○  Pass', callbacks.onPass),
      visualButton('⚑  认输', callbacks.onResign),
      visualButton('✓  终局确认', callbacks.onEndAttempt, {primary: true}),
    ]
  }

  return h(
    'div',
    {
      'data-testid': 'bottom-action-bar',
      class: `wb-bottom-action-bar wb-bottom-action-bar--${mode}${isCheckpoint ? ' wb-bottom-action-bar--checkpoint' : ''}`,
    },
    h('div', {class: 'wb-bottom-action-bar__visual'}, renderVisualActions()),

    h(
      'div',
      {class: 'wb-bottom-action-bar__compat', 'aria-hidden': 'true'},
      h(
        'div',
        {
          'data-testid': 'bottom-status-text',
          class: 'wb-status-text',
        },
        ...renderStatusSegments(),
      ),
      modeActions.map((btn) =>
        h(
          'div',
          {
            key: btn.testId,
            class: 'wb-bottom-action-bar__item',
          },
          actionBtn(btn),
        ),
      ),
      VIEW_ACTIONS.map((btn) =>
        h(
          'div',
          {
            key: btn.testId,
            class: 'wb-bottom-action-bar__item',
          },
          actionBtn(btn),
        ),
      ),
    ),
  )
}
