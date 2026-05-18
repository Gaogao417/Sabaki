import {h} from 'preact'
import EmptyStatePanel from '../shared/EmptyStatePanel.js'

/**
 * AnalysisModePanel renders the left panel for Analysis mode.
 *
 * @param {Object} props
 * @param {number} props.moveCount - Number of moves
 * @param {{black: number, white: number}} props.captures - Capture counts
 * @param {string|null} props.evaluation - Evaluation text, or null if none
 * @param {Function} props.onSnapshot - Called when user takes a snapshot
 * @param {'empty'|'active'|'success'|'error'|'loading'|'disabled'} [props.state='active'] - Panel state overlay
 */
export default function AnalysisModePanel({
  moveCount = 0,
  captures = {black: 0, white: 0},
  evaluation = null,
  onSnapshot = () => {},
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
        icon: '△',
        title: 'No Analysis Session',
        description: 'Enter analysis mode to review positions.',
      })
    }

    return [
      h('div', {class: 'wb-analysis-mode-panel__stats'},
        h('span', {class: 'wb-analysis-mode-panel__move-count'}, moveCount),
        h('span', {class: 'wb-analysis-mode-panel__captures'},
          captures.black,
          ' / ',
          captures.white,
        ),
      ),
      evaluation != null && h('div', {
        'data-testid': 'evaluation-section',
        class: 'wb-analysis-mode-panel__evaluation',
      }, evaluation),
      h('div', {class: 'wb-analysis-mode-panel__actions'},
        h('button', {
          'data-testid': 'snapshot-btn',
          class: 'wb-analysis-mode-panel__btn',
          onClick: onSnapshot,
        }, 'Snapshot'),
      ),
    ]
  }

  return h('div', {'data-testid': 'analysis-mode-panel', class: 'wb-analysis-mode-panel'},
    renderContent(),
  )
}
