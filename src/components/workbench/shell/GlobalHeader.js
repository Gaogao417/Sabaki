import {h} from 'preact'
import StoneStatus from './StoneStatus.js'

export default function GlobalHeader({
  taskTitle = '攻击题 #1024',
  mode = 'problem',
  statusChips = ['黑先', '未提交'],
  engineName = 'KataGo',
  engineConnected = true,
  blackCaptures = 0,
  whiteCaptures = 0,
  currentPlayer = 'black',
}) {
  return h(
    'header',
    {'data-testid': 'global-header', class: 'wb-global-header'},

    h(
      'div',
      {class: 'wb-global-header__left'},
      h('span', {class: 'wb-global-header__title'}, taskTitle),
      h(
        'span',
        {class: `wb-global-header__mode-chip wb-mode-chip wb-mode-chip--${mode}`},
        modeLabel(mode),
      ),
      statusChips.map((chip, i) =>
        h(
          'span',
          {class: 'wb-global-header__status-chip wb-status-chip', key: i},
          chip,
        ),
      ),
      h(StoneStatus, {blackCaptures, whiteCaptures, currentPlayer}),
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

function modeLabel(mode) {
  const labels = {play: '对局', problem: '题目', recall: '回忆', analysis: '复盘'}
  return labels[mode] || mode
}
