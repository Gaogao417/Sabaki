import {h} from 'preact'

import Goban from '../../Goban.js'

/**
 * MainBoardStage renders the central board area.
 * When boardProps are provided, renders a real Goban component.
 * Otherwise falls back to a placeholder.
 *
 * @param {Object} props
 * @param {'play'|'problem'|'recall'|'analysis'} props.mode - Current mode
 * @param {Object} [props.boardProps] - Structured Goban props from projectGobanProps
 * @param {import('preact').ComponentChildren} [props.children] - Optional children
 */
export default function MainBoardStage({mode = 'play', boardProps, children}) {
  if (!boardProps) {
    return h('div', {
      'data-testid': 'main-board-stage',
      class: 'wb-main-board-stage',
    }, children)
  }

  const {boardStateProps, overlayDisplayProps, interactionProps, handlerProps} = boardProps

  const flatProps = {
    ...boardStateProps,
    ...overlayDisplayProps,
    ...interactionProps,
    ...handlerProps,
  }

  return h('div', {
    'data-testid': 'main-board-stage',
    class: 'wb-main-board-stage',
  },
    h(Goban, flatProps),
    children,
  )
}
