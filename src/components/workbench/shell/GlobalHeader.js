import {h} from 'preact'

const MODE_COLORS = {
  play: '#2563ff',
  problem: '#d97706',
  recall: '#169b55',
  analysis: '#7c3aed',
}

export default function GlobalHeader({
  taskTitle = '攻击题 #1024',
  mode = 'problem',
  statusChips = ['黑先', '未提交'],
  engineName = 'KataGo',
  engineConnected = true,
}) {
  const modeColor = MODE_COLORS[mode] || MODE_COLORS.problem

  return h(
    'header',
    {class: 'wb-global-header'},

    h(
      'div',
      {class: 'wb-global-header__left'},
      h('span', {class: 'wb-global-header__title'}, taskTitle),
      h(
        'span',
        {
          class: 'wb-global-header__mode-chip',
          style: {
            background: modeColor,
            color: '#fff',
          },
        },
        modeLabel(mode),
      ),
      statusChips.map((chip, i) =>
        h(
          'span',
          {class: 'wb-global-header__status-chip', key: i},
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
          class: 'wb-global-header__engine-dot',
          style: {
            background: engineConnected ? '#22c55e' : '#9ca3af',
          },
        }),
        h(
          'span',
          {class: 'wb-global-header__engine-name'},
          engineName,
        ),
      ),
      h(
        'div',
        {class: 'wb-global-header__avatar'},
        h('span', {class: 'wb-global-header__avatar-initials'}, 'GC'),
      ),
    ),
  )
}

function modeLabel(mode) {
  const labels = {play: '对局', problem: '题目', recall: '回忆', analysis: '复盘'}
  return labels[mode] || mode
}
