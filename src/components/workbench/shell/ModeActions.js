import {h} from 'preact'

/**
 * Button definitions per mode.
 * Each button has: testId, label, callback prop name, and optional style variant.
 */
const MODE_BUTTONS = {
  play: [
    {testId: 'mode-action-new-game', label: 'New Game', callback: 'onNewGame'},
    {testId: 'mode-action-settings', label: 'Settings', callback: 'onSettings'},
    {testId: 'mode-action-end', label: 'End', callback: 'onEnd'},
    {testId: 'mode-action-resign', label: 'Resign', callback: 'onResign', variant: 'danger'},
  ],
  problem: [
    {testId: 'mode-action-submit', label: 'Submit', callback: 'onSubmit'},
    {testId: 'mode-action-abandon', label: 'Abandon', callback: 'onAbandon'},
    {testId: 'mode-action-settings', label: 'Settings', callback: 'onSettings'},
    {testId: 'mode-action-analysis', label: 'Analysis', callback: 'onAnalysis'},
  ],
  recall: [
    {testId: 'mode-action-analysis', label: 'Analysis', callback: 'onAnalysis'},
    {testId: 'mode-action-end', label: 'End', callback: 'onEnd'},
    {testId: 'mode-action-snapshot', label: 'Snapshot', callback: 'onSnapshot'},
  ],
  analysis: [
    {testId: 'mode-action-snapshot', label: 'Snapshot', callback: 'onSnapshot'},
    {testId: 'mode-action-settings', label: 'Settings', callback: 'onSettings'},
    {testId: 'mode-action-return', label: 'Return', callback: 'onReturn'},
  ],
}

/**
 * ModeActions renders a set of action buttons specific to the current mode.
 *
 * @param {Object} props
 * @param {string} props.mode - Current mode: 'play', 'problem', 'recall', 'analysis'
 * @param {Function} [props.onNewGame] - Play: start new game
 * @param {Function} [props.onSettings] - Show settings
 * @param {Function} [props.onEnd] - End current session
 * @param {Function} [props.onResign] - Play: resign game
 * @param {Function} [props.onSubmit] - Problem: submit answer
 * @param {Function} [props.onAbandon] - Problem: abandon attempt
 * @param {Function} [props.onAnalysis] - Enter analysis mode
 * @param {Function} [props.onSnapshot] - Take snapshot
 * @param {Function} [props.onReturn] - Analysis: return to previous mode
 */
export default function ModeActions({mode = 'problem', ...callbacks}) {
  const buttons = MODE_BUTTONS[mode] || []

  return h('div', {class: 'wb-mode-actions'},
    buttons.map(btn => {
      const classBase = 'wb-btn wb-btn--sm'
      const cls = btn.variant === 'danger'
        ? classBase + ' wb-btn-danger'
        : classBase + ' wb-btn-ghost'

      return h('div', {
        key: btn.testId,
        'data-testid': 'mode-action-btn',
        class: 'wb-mode-actions__item',
      },
        h('button', {
          'data-testid': btn.testId,
          class: cls,
          onClick: () => {
            const handler = callbacks[btn.callback]
            if (handler) handler()
          },
        }, btn.label),
      )
    }),
  )
}
