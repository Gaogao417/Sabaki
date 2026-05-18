import {h} from 'preact'

/**
 * Mode-specific action button definitions.
 * Each entry: { testId, label, callback }
 */
const MODE_ACTIONS = {
  play: [
    {testId: 'action-undo', label: 'Undo', callback: 'onUndo'},
    {testId: 'action-pass', label: 'Pass', callback: 'onPass'},
    {testId: 'action-resign', label: 'Resign', callback: 'onResign'},
    {testId: 'action-end-attempt', label: 'End', callback: 'onEndAttempt'},
    {testId: 'action-mark-doubtful', label: 'Doubtful', callback: 'onMarkDoubtful'},
  ],
  problem: [
    {testId: 'action-undo', label: 'Undo', callback: 'onUndo'},
    {testId: 'action-redo', label: 'Redo', callback: 'onRedo'},
    {testId: 'action-pass', label: 'Pass', callback: 'onPass'},
    {testId: 'action-request-hint', label: 'Hint', callback: 'onRequestHint'},
    {testId: 'action-submit-answer', label: 'Submit', callback: 'onSubmitAnswer'},
    {testId: 'action-abandon-answer', label: 'Abandon', callback: 'onAbandonAnswer'},
  ],
  recall: [
    {testId: 'action-mark-checkpoint', label: 'Checkpoint', callback: 'onMarkCheckpoint'},
    {testId: 'action-hint', label: 'Hint', callback: 'onHint'},
    {testId: 'action-verify-skip', label: 'Verify', callback: 'onVerifySkip'},
    {testId: 'action-enter-analysis', label: 'Analysis', callback: 'onEnterAnalysis'},
  ],
  analysis: [
    {testId: 'action-undo', label: 'Undo', callback: 'onUndo'},
    {testId: 'action-redo', label: 'Redo', callback: 'onRedo'},
    {testId: 'action-clear', label: 'Clear', callback: 'onClear'},
    {testId: 'action-edit-position', label: 'Edit', callback: 'onEditPosition'},
    {testId: 'action-snapshot', label: 'Snapshot', callback: 'onSnapshot'},
  ],
}

const COMMON_ACTIONS = [
  {testId: 'action-select', label: 'Select', callback: 'onSelect'},
  {testId: 'action-hand-shape', label: 'Hand', callback: 'onHandShape'},
  {testId: 'action-zoom-in', label: 'Zoom+', callback: 'onZoomIn'},
  {testId: 'action-zoom-out', label: 'Zoom-', callback: 'onZoomOut'},
  {testId: 'action-fullscreen', label: 'Full', callback: 'onFullscreen'},
]

const ANNOTATION_TOOLS = [
  'black', 'white', 'cross', 'triangle', 'square',
  'circle', 'line', 'arrow', 'label-A', 'label-1',
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
  activeAnnotationTool = null,
  onAnnotationToolChange = () => {},
  ...callbacks
}) {
  const modeActions = MODE_ACTIONS[mode] || []
  const allActions = [...modeActions, ...COMMON_ACTIONS]
  const label = workspaceLabel || WORKSPACE_LABELS[mode] || WORKSPACE_LABELS.play

  return h('div', {
    'data-testid': 'bottom-action-bar',
    class: 'wb-bottom-action-bar',
  },
    h('div', {
      'data-testid': 'bottom-status-text',
      class: 'wb-status-text',
    },
      h('span', {class: 'wb-status-text__label'}, label),
      h('span', {class: 'wb-status-text__divider'}),
      h('span', {class: 'wb-status-text__value'}, `当前第 ${moveNumber} 手`),
      h('span', {class: 'wb-status-text__divider'}),
      h('span', {class: 'wb-status-text__value'}, engineStatus),
    ),

    h('div', {class: 'wb-bottom-action-bar__mode-actions'},
      allActions.map(btn =>
        h('div', {
          key: btn.testId,
          'data-testid': 'action-btn',
          class: 'wb-bottom-action-bar__item',
        },
          h('button', {
            'data-testid': btn.testId,
            class: 'wb-btn wb-btn--ghost wb-btn--sm',
            onClick: () => {
              const handler = callbacks[btn.callback]
              if (handler) handler()
            },
          }, btn.label),
        ),
      ),
    ),

    mode === 'analysis' &&
      h('div', {
        'data-testid': 'annotation-tool',
        class: 'wb-bottom-action-bar__annotation-tools',
      },
        ANNOTATION_TOOLS.map(tool =>
          h('button', {
            key: tool,
            'data-testid': 'annotation-tool-btn',
            'data-tool': tool,
            class: `wb-btn wb-btn--sm wb-btn--ghost${activeAnnotationTool === tool ? ' active' : ''}`,
            onClick: () => onAnnotationToolChange(tool),
          }, tool),
        ),
      ),
  )
}
