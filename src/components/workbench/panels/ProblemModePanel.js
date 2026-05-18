import {h} from 'preact'
import OpponentControl from '../shared/OpponentControl.js'
import ReferenceLineSummary from '../shared/ReferenceLineSummary.js'
import EmptyStatePanel from '../shared/EmptyStatePanel.js'

/**
 * ProblemModePanel renders the left panel for Problem mode.
 *
 * @param {Object} props
 * @param {string} props.prompt - Problem prompt text
 * @param {string} props.goal - Goal description
 * @param {string} props.passRuleSummary - Rule summary text
 * @param {Array<{label: string, length: number}>} props.referenceLines - Reference lines
 * @param {string} props.blackPlayer - Black player info
 * @param {string} props.whitePlayer - White player info
 * @param {Function} props.onOpponentChange - Called when opponent type changes
 * @param {Function} props.onRequestHint - Called when user requests a hint
 * @param {'empty'|'active'|'success'|'error'|'loading'|'disabled'} [props.state='active'] - Panel state overlay
 */
export default function ProblemModePanel({
  prompt = '',
  goal = '',
  passRuleSummary = '',
  referenceLines = [],
  blackPlayer = '',
  whitePlayer = '',
  onOpponentChange = () => {},
  onRequestHint = () => {},
  state = 'active',
}) {
  function renderContent() {
    if (state === 'loading') {
      return h('div', {class: 'wb-state-loading'},
        h('div', {'data-testid': 'loading-indicator', class: 'wb-state-loading__spinner'}),
      )
    }

    if (state === 'disabled') {
      return h('div', {class: 'wb-state-disabled'},
        h('div', {'data-testid': 'disabled-overlay', class: 'wb-state-disabled__overlay'}, 'Disabled'),
      )
    }

    if (state === 'error') {
      return h('div', {class: 'wb-state-error'},
        h('div', {class: 'wb-state-error__icon'}, '!'),
        h('div', {class: 'wb-state-error__message'}, 'Something went wrong'),
        h('div', {class: 'wb-state-error__retry'},
          h('button', {'data-testid': 'error-overlay', class: 'wb-btn wb-btn-secondary wb-btn--sm'}, 'Retry'),
        ),
      )
    }

    if (state === 'success') {
      return h('div', {class: 'wb-state-success'},
        h('div', {'data-testid': 'success-indicator', class: 'wb-state-success__icon'}, '✓'),
        h('div', {class: 'wb-state-success__message'}, 'Complete'),
      )
    }

    if (state === 'empty') {
      return h(EmptyStatePanel, {
        icon: '□',
        title: 'No Problem Loaded',
        description: 'Load a problem to begin solving.',
      })
    }

    const totalCount = referenceLines.reduce((sum, line) => sum + line.length, 0)

    return [
      h('div', {class: 'wb-problem-mode-panel__prompt'}, prompt),
      h('div', {class: 'wb-problem-mode-panel__goal'}, goal),
      h('div', {class: 'wb-problem-mode-panel__rules'}, passRuleSummary),
      h('div', {class: 'wb-problem-mode-panel__opponent'},
        h(OpponentControl, {value: 'ai', onChange: onOpponentChange}),
      ),
      h('div', {class: 'wb-problem-mode-panel__reference-lines'},
        h(ReferenceLineSummary, {lines: referenceLines, totalCount}),
      ),
      h('div', {class: 'wb-problem-mode-panel__actions'},
        h('button', {
          'data-testid': 'request-hint-btn',
          class: 'wb-problem-mode-panel__btn wb-problem-mode-panel__btn--hint',
          onClick: onRequestHint,
        }, 'Request Hint'),
      ),
    ]
  }

  return h('div', {'data-testid': 'problem-mode-panel', class: 'wb-problem-mode-panel'},
    renderContent(),
  )
}
