import {h} from 'preact'

const DEFAULT_STONES = [
  ['black', 2, 2], ['black', 3, 2], ['white', 4, 1], ['black', 5, 1],
  ['white', 4, 3], ['white', 5, 3], ['black', 6, 2],
  ['black', 2, 5], ['white', 3, 6], ['black', 4, 7], ['white', 5, 7],
  ['black', 6, 6], ['black', 7, 7], ['white', 8, 8],
  ['white', 13, 2], ['black', 14, 3], ['black', 15, 3],
  ['white', 13, 5], ['black', 15, 6], ['white', 16, 7],
  ['black', 14, 10], ['white', 15, 11], ['black', 16, 12],
]

export default function MiniBoard({
  stones = DEFAULT_STONES,
  marker = null,
  labels = [],
  size = 9,
}) {
  return h('div', {class: 'wb-mini-board', style: `--mini-size: ${size}`},
    Array.from({length: size * size}).map((_, index) =>
      h('span', {key: index, class: 'wb-mini-board__point'}),
    ),
    stones.map(([color, x, y], index) =>
      h('span', {
        key: `stone-${index}`,
        class: `wb-mini-board__stone wb-mini-board__stone--${color}`,
        style: `--x: ${x}; --y: ${y}`,
      }),
    ),
    marker && h('span', {
      class: 'wb-mini-board__marker',
      style: `--x: ${marker[0]}; --y: ${marker[1]}`,
    }),
    labels.map(({text, x, y, tone = 'white'}, index) =>
      h('span', {
        key: `label-${index}`,
        class: `wb-mini-board__label wb-mini-board__label--${tone}`,
        style: `--x: ${x}; --y: ${y}`,
      }, text),
    ),
  )
}
