import {h} from 'preact'

export default function GlobalHeader({
  taskTitle = 'Sabaki',
  statusChips = ['黑先', '未提交'],
}) {
  return h(
    'header',
    {'data-testid': 'global-header', class: 'wb-global-header'},

    h(
      'div',
      {class: 'wb-global-header__left'},
      h('span', {class: 'wb-global-header__traffic wb-global-header__traffic--red'}),
      h('span', {class: 'wb-global-header__traffic wb-global-header__traffic--yellow'}),
      h('span', {class: 'wb-global-header__traffic wb-global-header__traffic--green'}),
    ),

    h('div', {class: 'wb-global-header__title'}, 'Sabaki'),

    h('div', {class: 'wb-global-header__status-compat', 'aria-hidden': 'true'},
      statusChips.map((chip, i) =>
        h(
          'span',
          {class: 'wb-global-header__status-chip wb-status-chip', key: i},
          chip,
        ),
      ),
    ),

    h(
      'div',
      {class: 'wb-global-header__right'},
      taskTitle !== 'Sabaki' && h('span', {class: 'wb-global-header__document-title'}, taskTitle),
    ),
  )
}
