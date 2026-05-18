import {h} from 'preact'

const LABELS = ['A', 'B', 'C', 'D', 'E']

const DEFAULT_CANDIDATES = [
  {label: 'A', move: 'Q16', winrate: 58.2, visits: 1240},
  {label: 'B', move: 'D4', winrate: 54.8, visits: 890},
  {label: 'C', move: 'R4', winrate: 51.3, visits: 430},
]

export default function CandidateMoveList({
  candidates = DEFAULT_CANDIDATES,
}) {
  let maxWinrate = Math.max(...candidates.map((c) => c.winrate), 1)

  return h('div', {class: 'wb-candidate-list'},
    h('div', {class: 'wb-candidate-list__header'}, '候选点'),
    h('ul', {class: 'wb-candidate-list__items'},
      candidates.map((c, i) =>
        h('li', {class: 'wb-candidate-list__item', key: c.label || LABELS[i]},
          h('span', {class: 'wb-candidate-list__label'}, c.label || LABELS[i]),
          h('span', {class: 'wb-candidate-list__move'}, c.move),
          h('div', {class: 'wb-candidate-list__bar-wrap'},
            h('div', {
              class: 'wb-candidate-list__bar',
              style: `width: ${(c.winrate / maxWinrate) * 100}%`,
            })
          ),
          h('span', {class: 'wb-candidate-list__winrate'}, `${c.winrate.toFixed(1)}%`),
          h('span', {class: 'wb-candidate-list__visits'}, `${c.visits}`)
        )
      )
    )
  )
}
