import {h} from 'preact'

const MODE_LABELS = {
  play: '对局',
  problem: '题目',
  recall: '复棋',
  analysis: '分析',
}

const MODE_COLORS = {
  play: '#2563ff',
  problem: '#d97706',
  recall: '#169b55',
  analysis: '#7c3aed',
}

/**
 * MainBoardStage is the central board area placeholder.
 *
 * @param {Object} props
 * @param {'play'|'problem'|'recall'|'analysis'} props.mode - Current mode
 * @param {import('preact').ComponentChildren} [props.children] - Optional children
 */
export default function MainBoardStage({mode = 'play', children}) {
  const label = MODE_LABELS[mode] || mode
  const color = MODE_COLORS[mode] || '#2563ff'

  return h('div', {
    'data-testid': 'main-board-stage',
    class: 'wb-main-board-stage',
  },
    h('span', {
      'data-testid': 'board-mode-chip',
      class: 'wb-main-board-stage__chip',
      style: {background: color, color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', '--mode-color': color},
    }, label),
    h('div', {
      'data-testid': 'board-placeholder',
      class: 'wb-main-board-stage__placeholder',
    }, '棋盘区域'),
    children,
  )
}
