import {h} from 'preact'
import StoneStatus from './StoneStatus.js'
import ModeActions from './ModeActions.js'

const MODES = [
  {key: 'play', label: '对局模式'},
  {key: 'problem', label: '做题模式'},
  {key: 'recall', label: '回忆模式'},
  {key: 'analysis', label: '复盘模式'},
]

export default function ModeBar({
  activeMode = 'problem',
  onModeChange = () => {},
  blackCaptures = 0,
  whiteCaptures = 0,
  currentPlayer = 'black',
  ...rest
}) {
  return h(
    'nav',
    {'data-testid': 'mode-bar', class: 'wb-mode-bar'},

    // Left: StoneStatus
    h(StoneStatus, {blackCaptures, whiteCaptures, currentPlayer}),

    // Center: Segmented control
    h(
      'div',
      {class: 'wb-mode-bar__tabs wb-segmented-control'},
      MODES.map(({key, label}) =>
        h(
          'button',
          {
            key,
            class: `wb-segmented-control__item${activeMode === key ? ' wb-segmented-control__item--active' : ''}`,
            onClick: () => onModeChange(key),
          },
          label,
        ),
      ),
    ),

    // Right: Mode actions
    h(
      'div',
      {class: 'wb-mode-bar__actions'},
      h(ModeActions, {
        mode: activeMode,
        ...rest,
      }),
    ),
  )
}
