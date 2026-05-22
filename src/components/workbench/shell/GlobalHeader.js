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
  onOpenFoxGames,
  onOpenOneOhOneWeiqi,
  onOpenPreferences,
}) {
  const utilities = [
    {label: '野狐', onClick: onOpenFoxGames},
    {label: '101', onClick: onOpenOneOhOneWeiqi},
    {label: '偏好', onClick: onOpenPreferences},
  ].filter((item) => item.onClick != null)

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
      utilities.length > 0 &&
        h(
          'div',
          {class: 'wb-global-header__utilities'},
          utilities.map((item) =>
            h(
              'button',
              {
                key: item.label,
                type: 'button',
                class: 'wb-btn wb-btn-ghost wb-btn--sm',
                onClick: item.onClick,
              },
              item.label,
            ),
          ),
        ),
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
