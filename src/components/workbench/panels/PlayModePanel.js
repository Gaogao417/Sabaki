import {h} from 'preact'

/**
 * PlayModePanel renders the left panel for Play mode.
 *
 * @param {Object} props
 * @param {string} props.taskTitle - Title of the current task
 * @param {string} props.taskDescription - Description of the current task
 * @param {number} props.moveCount - Number of moves played
 * @param {{black: number, white: number}} props.captures - Capture counts
 * @param {Function} props.onMarkDoubtful - Called when user marks position as doubtful
 * @param {Function} props.onEnterAnalysis - Called when user wants to enter analysis
 */
export default function PlayModePanel({
  taskTitle = '',
  taskDescription = '',
  moveCount = 0,
  captures = {black: 0, white: 0},
  onMarkDoubtful = () => {},
  onEnterAnalysis = () => {},
}) {
  return h('div', {'data-testid': 'play-mode-panel', class: 'wb-play-mode-panel'},
    h('div', {class: 'wb-play-mode-panel__info-card'},
      h('h3', {class: 'wb-play-mode-panel__title'}, taskTitle),
      h('p', {class: 'wb-play-mode-panel__description'}, taskDescription),
      h('div', {class: 'wb-play-mode-panel__stats'},
        h('span', {class: 'wb-play-mode-panel__move-count'}, moveCount),
        h('span', {class: 'wb-play-mode-panel__captures'},
          captures.black,
          ' / ',
          captures.white,
        ),
      ),
    ),
    h('div', {class: 'wb-play-mode-panel__actions'},
      h('button', {
        'data-testid': 'mark-doubtful-btn',
        class: 'wb-play-mode-panel__btn wb-play-mode-panel__btn--doubtful',
        onClick: onMarkDoubtful,
      }, 'Mark Doubtful'),
      h('button', {
        'data-testid': 'enter-analysis-btn',
        class: 'wb-play-mode-panel__btn wb-play-mode-panel__btn--analysis',
        onClick: onEnterAnalysis,
      }, 'Enter Analysis'),
    ),
  )
}
