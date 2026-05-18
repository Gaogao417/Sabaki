import {h} from 'preact'
import ModeActions from './ModeActions.js'

const MODES = [
  {key: 'play', label: 'Play', color: '#2563ff'},
  {key: 'problem', label: 'Problem', color: '#d97706'},
  {key: 'recall', label: 'Recall', color: '#169b55'},
  {key: 'analysis', label: 'Analysis', color: '#7c3aed'},
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
      {class: 'wb-mode-bar__tabs'},
      MODES.map(({key, label, color}) =>
        h(
          'button',
          {
            key,
            class: `wb-mode-bar__tab${activeMode === key ? ' wb-mode-bar__tab--active' : ''}`,
            style: activeMode === key ? {'--tab-color': color} : {},
            onClick: () => onModeChange(key),
          },
          h(
            'span',
            {class: 'wb-mode-bar__tab-label'},
            label,
          ),
          activeMode === key &&
            h('span', {
              class: 'wb-mode-bar__tab-indicator',
              style: {background: color},
            }),
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
