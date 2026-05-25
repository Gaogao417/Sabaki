import {h} from 'preact'

export default function GlobalHeader({
  taskTitle = '攻击题 #1024',
  mode = 'problem',
  statusChips = ['黑先', '未提交'],
  engineName = 'KataGo',
  engineConnected = true,
}) {
  return h(
    'header',
    {'data-testid': 'global-header', class: 'wb-global-header'},

    h(
      'div',
      {class: 'wb-global-header__left'},
      h('span', {class: 'wb-global-header__title'}, taskTitle),
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
      h(
        'div',
        {class: 'wb-global-header__engine'},
        h('span', {
          class: [
            'wb-global-header__engine-dot',
            engineConnected ? 'wb-global-header__engine-dot--connected' : '',
          ].filter(Boolean).join(' '),
        }),
        h(
          'span',
          {class: 'wb-global-header__engine-name'},
          engineName,
        ),
      ),
    ),
  )
}
