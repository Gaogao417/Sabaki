import {h} from 'preact'
import EmptyStatePanel from '../shared/EmptyStatePanel.js'

/**
 * PlayRightPanel renders the right panel content for Play mode.
 *
 * @param {Object} props
 * @param {number} props.moveCount - Number of moves played
 * @param {{black: number, white: number}} props.captures - Capture counts
 * @param {number} props.pendingEval - Pending evaluation count
 * @param {number} props.badMoveCount - Number of bad moves detected
 */
export default function PlayRightPanel({
  moveCount = 0,
  captures = {black: 0, white: 0},
  pendingEval = 0,
  badMoveCount = 0,
}) {
  return h('div', {
    'data-testid': 'play-right-panel',
    class: 'wb-play-right-panel',
  },
    // Board info card
    h('div', {class: 'wb-card'},
      h('button', {
        'data-testid': 'drawer-toggle',
        class: 'wb-drawer-toggle',
      }, h('span', {class: 'wb-panel-title'}, '棋盘信息')),
      h('div', {class: 'wb-play-right-panel__board-info'},
        h('div', {class: 'wb-play-right-panel__stat'},
          h('span', {class: 'wb-play-right-panel__stat-label'}, '手数'),
          h('span', {class: 'wb-play-right-panel__stat-value'}, moveCount),
        ),
        h('div', {class: 'wb-play-right-panel__stat'},
          h('span', {class: 'wb-play-right-panel__stat-label'}, '提子'),
          h('span', {class: 'wb-play-right-panel__stat-value'},
            captures.black,
            ' / ',
            captures.white,
          ),
        ),
      ),
    ),

    // AI analysis card
    h('div', {class: 'wb-card'},
      h('button', {
        'data-testid': 'drawer-toggle',
        class: 'wb-drawer-toggle',
      }, h('span', {class: 'wb-panel-title'}, 'AI 分析')),
      h(EmptyStatePanel, {
        icon: '🔍',
        title: 'AI 分析',
        description: '连接引擎后可查看分析结果',
      }),
    ),

    // Variation tree card
    h('div', {class: 'wb-card'},
      h('button', {
        'data-testid': 'drawer-toggle',
        class: 'wb-drawer-toggle',
      }, h('span', {class: 'wb-panel-title'}, '变化树')),
      h(EmptyStatePanel, {
        icon: '🌳',
        title: '变化树',
        description: '对局过程中将自动记录变化',
      }),
    ),
  )
}
