import {h} from 'preact'

const MODES = [
  {key: 'play', label: '对局模式'},
  {key: 'problem', label: '做题模式'},
  {key: 'recall', label: '回忆模式'},
  {key: 'analysis', label: '复盘模式'},
]

export {MODES}

const MODE_LABEL = {
  play: 'Play',
  problem: 'Problem',
  recall: 'Recall',
  analysis: 'Analysis',
}

function Pill({children, tone = 'neutral'}) {
  return h('span', {class: `wb-topbar-pill wb-topbar-pill--${tone}`}, children)
}

function Divider() {
  return h('span', {class: 'wb-topbar-divider'})
}

function formatLine(line) {
  return Array.isArray(line) ? line.filter(Boolean).join(' ') : ''
}

function ActionButton({children, primary = false, danger = false, onClick, testId}) {
  const cls = [
    'wb-topbar-action',
    primary ? 'wb-topbar-action--primary' : '',
    danger ? 'wb-topbar-action--danger' : '',
  ].filter(Boolean).join(' ')

  return h('button', {
    class: cls,
    'data-testid': testId,
    onClick,
  }, children)
}

function renderCompatSegmented({activeMode, modeBarPolicy, onModeChange}) {
  return h(
    'div',
    {class: 'wb-mode-bar__tabs wb-segmented-control wb-mode-bar__compat-tabs'},
    MODES.map(({key, label}) => {
      const availability = modeBarPolicy?.[key]
      const disabled = availability && !availability.enabled
      const reason = availability?.reason || ''
      const isActive = activeMode === key

      return h(
        'button',
        {
          key,
          class: `wb-segmented-control__item${isActive ? ' wb-segmented-control__item--active' : ''}${disabled ? ' wb-segmented-control__item--disabled' : ''}`,
          'aria-disabled': disabled || undefined,
          title: reason || undefined,
          onClick: disabled ? undefined : () => onModeChange(key),
          'data-testid': `mode-bar-${key}`,
        },
        label,
      )
    }),
  )
}

export default function ModeBar({
  activeMode = 'problem',
  onModeChange = () => {},
  modeBarPolicy = null,
  taskTitle = null,
  activeCheckpoint = null,
  activeCheckpointId = null,
  recallSubstate = 'normal',
  currentMove = 23,
  totalMoves = 180,
  wrongCount = 1,
  badMoveCount = 0,
  hintLevelUsed = 1,
  problemSession = null,
  onSubmit = () => {},
  onAbandon = () => {},
  onEnd = () => {},
  onAnalysis = () => {},
  onSnapshot = () => {},
  onReturn = () => {},
  onSettings = () => {},
  onOpenPreferences = () => {},
  ...rest
}) {
  const isCheckpoint = activeMode === 'recall' &&
    (activeCheckpoint || activeCheckpointId || String(recallSubstate).startsWith('checkpoint'))
  const checkpointMoveNumber = activeCheckpoint?.moveNumber
  const checkpointOriginalMove = activeCheckpoint?.originalMoveLabel ||
    formatLine(activeCheckpoint?.originalLine?.slice(0, 1))
  const checkpointSeverity = activeCheckpoint?.severityLabel || activeCheckpoint?.severity || ''
  const title = taskTitle ||
    (activeMode === 'problem' ? '攻击方向训练 #12' : '黑方 vs 白方 #1')
  const problemHintUsage = activeMode === 'problem'
    ? getProblemHintUsageLabel(problemSession, hintLevelUsed)
    : ''

  function renderMeta() {
    if (isCheckpoint) {
      return [
        h(Pill, {tone: 'warning'}, '⚠ Checkpoint'),
        checkpointMoveNumber != null && h('span', {class: 'wb-topbar-meta'}, `第 ${checkpointMoveNumber} 手`),
        checkpointOriginalMove && h('span', {class: 'wb-topbar-dot'}, '·'),
        checkpointOriginalMove && h('span', {class: 'wb-topbar-meta'}, `原手 ${checkpointOriginalMove}`),
        checkpointSeverity && h('span', {class: 'wb-topbar-dot'}, '·'),
        checkpointSeverity && h('span', {class: 'wb-topbar-severity'}, checkpointSeverity),
      ]
    }

    if (activeMode === 'problem') {
      return [
        h(Pill, {tone: 'blue'}, MODE_LABEL.problem),
        h('span', {class: 'wb-topbar-stone wb-topbar-stone--black'}),
        h('span', {class: 'wb-topbar-meta'}, '黑先'),
        h(Divider),
        h('span', {class: 'wb-topbar-meta'}, '💡 hint ', problemHintUsage),
        h(Divider),
        h('span', {class: 'wb-topbar-warning'}, '△'),
        h('span', {class: 'wb-topbar-meta'}, 'bad move ', badMoveCount),
      ]
    }

    if (activeMode === 'recall') {
      return [
        h(Pill, {tone: 'blue'}, MODE_LABEL.recall),
        h(Pill, {tone: 'blueSoft'}, '回忆中'),
        h('span', {class: 'wb-topbar-meta'}, `第 ${currentMove || 23} / ${totalMoves || 180} 手`),
        h(Pill, {tone: 'danger'}, `错误 ${wrongCount || 1}`),
      ]
    }

    if (activeMode === 'analysis') {
      return [
        h(Pill, {tone: 'analysis'}, MODE_LABEL.analysis),
        h('span', {class: 'wb-topbar-meta'}, '第 76 手'),
        h(Pill, {tone: 'neutral'}, '当前变化 vs 参考变化 · 差值 -5.5 目'),
      ]
    }

    return [
      h(Pill, {tone: 'blue'}, MODE_LABEL.play),
      h(Pill, {tone: 'blueSoft'}, '对局中'),
      h('span', {class: 'wb-topbar-meta'}, '第 42 手'),
      h(Pill, {tone: 'neutral'}, '● 黑方执黑'),
      h(Pill, {tone: 'neutral'}, '对手 AI 9段'),
      h(Pill, {tone: 'unsaved'}, '未保存'),
    ]
  }

  function renderActions() {
    if (isCheckpoint) {
      return [
        h(ActionButton, {testId: 'mode-action-save-correction', primary: false, onClick: rest.onSubmitCorrection}, '保存修正图'),
        h(ActionButton, {testId: 'mode-action-skip-checkpoint', onClick: rest.onSkipCheckpoint}, '跳过 checkpoint'),
        h(ActionButton, {testId: 'mode-action-analysis', onClick: onAnalysis}, '进入 Analysis'),
      ]
    }

    if (activeMode === 'problem') {
      return [
        h(ActionButton, {testId: 'mode-action-submit', primary: true, onClick: onSubmit}, '提交'),
        h(ActionButton, {testId: 'mode-action-analysis', onClick: onAnalysis}, '复盘'),
        h(ActionButton, {testId: 'mode-action-abandon', onClick: onAbandon}, '放弃'),
      ]
    }

    if (activeMode === 'recall') {
      return [
        h(ActionButton, {testId: 'mode-action-end', primary: true, onClick: onEnd}, '完成回忆'),
        h(ActionButton, {testId: 'mode-action-continue', onClick: rest.onRestartAttempt}, '从此续弈'),
        h(ActionButton, {testId: 'mode-action-analysis', onClick: onAnalysis}, '进入 Analysis'),
      ]
    }

    if (activeMode === 'analysis') {
      return [
        h(ActionButton, {testId: 'mode-action-snapshot', onClick: onSnapshot}, 'Snapshot 出题'),
        h(ActionButton, {testId: 'mode-action-settings', onClick: onSettings}, '重做本题'),
        h(ActionButton, {testId: 'mode-action-return', onClick: onReturn}, '从此续弈'),
      ]
    }

    return [
      h(ActionButton, {testId: 'mode-action-new-game', onClick: rest.onNewGame}, '新对局'),
      h(ActionButton, {testId: 'mode-action-analysis', onClick: onAnalysis}, '复盘'),
      h(ActionButton, {testId: 'mode-action-save', primary: true, onClick: onSnapshot}, '保存'),
      h(ActionButton, {testId: 'mode-action-resign', danger: true, onClick: rest.onResign}, '认输'),
      h(ActionButton, {testId: 'mode-action-end', onClick: onEnd}, '结束对局'),
    ]
  }

  return h(
    'nav',
    {'data-testid': 'mode-bar', class: `wb-mode-bar wb-mode-bar--${activeMode}${isCheckpoint ? ' wb-mode-bar--checkpoint' : ''}`},
    h('button', {class: 'wb-topbar-menu', 'aria-label': '打开资料库', onClick: rest.onOpenGameLibrary}, '☷'),
    h('button', {
      class: 'wb-topbar-icon-button',
      'data-testid': 'mode-action-preferences',
      'aria-label': '打开偏好设置',
      title: '偏好设置',
      onClick: onOpenPreferences,
    }, '⚙'),
    h(Divider),
    h('div', {class: 'wb-topbar-title'}, title),
    h('div', {class: 'wb-topbar-meta-group'}, renderMeta()),
    h('div', {class: 'wb-mode-bar__actions'}, renderActions()),
  )
}

function getProblemHintUsageLabel(problemSession, hintLevelUsed) {
  if (problemSession && typeof problemSession === 'object') {
    const value = problemSession.hintUsageLabel || problemSession.hint
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return `${hintLevelUsed}/5`
}
