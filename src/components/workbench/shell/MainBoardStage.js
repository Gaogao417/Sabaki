import {h} from 'preact'

import Goban from '../../Goban.js'

function FallbackBoard({checkpoint = false, checkpointLabel = ''}) {
  const stones = [
    ['white', 5, 1], ['black', 6, 1], ['black', 2, 2], ['black', 3, 2],
    ['white', 5, 2], ['white', 6, 2], ['black', 14, 1], ['white', 15, 1],
    ['black', 16, 2], ['white', 2, 3], ['white', 3, 3], ['black', 6, 3],
    ['black', 12, 3], ['white', 14, 4], ['white', 15, 4], ['black', 16, 5],
    ['white', 2, 7], ['black', 3, 8], ['black', 4, 8], ['white', 15, 8],
    ['black', 16, 8], ['white', 17, 8], ['black', 2, 10], ['black', 3, 10],
    ['white', 2, 11], ['black', 4, 12], ['white', 5, 12], ['black', 6, 12],
    ['white', 7, 12], ['black', 8, 13], ['white', 9, 13], ['black', 15, 13],
    ['white', 16, 13], ['black', 17, 13], ['black', 2, 14], ['white', 3, 14],
    ['black', 4, 14], ['white', 5, 14], ['black', 6, 14], ['white', 7, 14],
    ['black', 8, 14], ['white', 9, 14], ['black', 15, 15], ['white', 16, 15],
  ]

  return h('div', {class: 'wb-board-fallback'},
    Array.from({length: 19 * 19}).map((_, index) =>
      h('span', {key: index, class: 'wb-board-fallback__point'}),
    ),
    stones.map(([color, x, y], index) =>
      h('span', {
        key: index,
        class: `wb-board-fallback__stone wb-board-fallback__stone--${color}`,
        style: `--x: ${x}; --y: ${y}`,
      }),
    ),
    checkpoint && checkpointLabel && h('span', {class: 'wb-board-fallback__bad-move', style: '--x: 16; --y: 9'},
      h('span', {}, checkpointLabel),
    ),
  )
}

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
export default function MainBoardStage({mode = 'play', boardProps, children, checkpoint = false, checkpointLabel = ''}) {
  if (!boardProps || !boardProps.boardStateProps?.board) {
    return h('div', {
      'data-testid': 'main-board-stage',
      class: 'wb-main-board-stage',
    },
      h(FallbackBoard, {checkpoint, checkpointLabel}),
      children,
    )
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
    checkpoint && checkpointLabel && h('div', {class: 'wb-board-checkpoint-callout'}, checkpointLabel),
    children,
  )
}
