import {h} from 'preact'
import ModeActions from './ModeActions.js'

const MODES = [
  {key: 'play', label: '对局', color: '#2563ff'},
  {key: 'problem', label: '做题', color: '#d97706'},
  {key: 'recall', label: '回忆', color: '#169b55'},
  {key: 'analysis', label: '复盘', color: '#7c3aed'},
]

export default function ModeBar({
  activeMode = 'problem',
  onModeChange = () => {},
  onSnapshot = () => {},
}) {
  return h(
    'nav',
    {'data-testid': 'mode-bar', class: 'wb-mode-bar'},

    h(
      'div',
      {class: 'wb-mode-bar__tabs wb-segmented-control'},
      MODES.map(({key, label, color}) =>
        h(
          'button',
          {
            key,
            class: `wb-segmented-control__item${activeMode === key ? ' wb-segmented-control__item--active' : ''}`,
            style: activeMode === key ? {'--segment-color': color} : {},
            onClick: () => onModeChange(key),
          },
          label,
        ),
      ),
    ),

    h(
      'div',
      {class: 'wb-mode-bar__actions'},
      h(ModeActions, {
        mode: activeMode,
        onSnapshot,
      }),
    ),
  )
}
