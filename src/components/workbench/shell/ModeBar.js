import {h} from 'preact'

const MODES = [
  {key: 'play', label: 'Play', color: '#169b55'},
  {key: 'problem', label: 'Problem', color: '#2563ff'},
  {key: 'recall', label: 'Recall', color: '#7c3fed'},
  {key: 'analysis', label: 'Analysis', color: '#e67e22'},
]

export default function ModeBar({
  activeMode = 'problem',
  onModeChange = () => {},
  onSnapshot = () => {},
}) {
  return h(
    'nav',
    {class: 'wb-mode-bar'},

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
      h(
        'button',
        {
          class: 'wb-mode-bar__snapshot-btn',
          onClick: onSnapshot,
        },
        'Snapshot',
      ),
      h(
        'button',
        {class: 'wb-mode-bar__more-btn'},
        '更多',
      ),
    ),
  )
}
