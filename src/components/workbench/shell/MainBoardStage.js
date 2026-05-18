import {h} from 'preact'

const MODE_LABELS = {
  play: '对局',
  problem: '题目',
  recall: '回忆',
  analysis: '分析',
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

  return h('div', {
    'data-testid': 'main-board-stage',
    class: 'wb-main-board-stage',
  },
    h('span', {
      'data-testid': 'board-mode-chip',
      class: `wb-main-board-stage__chip wb-mode-chip wb-mode-chip--${mode}`,
    }, label),
    h('div', {
      'data-testid': 'board-placeholder',
      class: 'wb-main-board-stage__placeholder',
    }, '棋盘区域'),
    children,
  )
}
