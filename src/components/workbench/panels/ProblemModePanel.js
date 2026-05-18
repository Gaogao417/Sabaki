import {h} from 'preact'
import OpponentControl from '../shared/OpponentControl.js'
import ReferenceLineSummary from '../shared/ReferenceLineSummary.js'

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
}) {
  const totalCount = referenceLines.reduce((sum, line) => sum + line.length, 0)

  return h('div', {'data-testid': 'problem-mode-panel', class: 'wb-problem-mode-panel'},
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
  )
}
