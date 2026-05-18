import {h} from 'preact'

/**
 * AnalysisModePanel renders the left panel for Analysis mode.
 *
 * @param {Object} props
 * @param {number} props.moveCount - Number of moves
 * @param {{black: number, white: number}} props.captures - Capture counts
 * @param {string|null} props.evaluation - Evaluation text, or null if none
 * @param {Function} props.onSnapshot - Called when user takes a snapshot
 */
export default function AnalysisModePanel({
  moveCount = 0,
  captures = {black: 0, white: 0},
  evaluation = null,
  onSnapshot = () => {},
}) {
  return h('div', {'data-testid': 'analysis-mode-panel', class: 'wb-analysis-mode-panel'},
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
  )
}
