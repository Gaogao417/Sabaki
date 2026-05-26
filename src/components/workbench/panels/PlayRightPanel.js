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
    h('div', {class: 'wb-card wb-play-info-card'},
      h('div', {class: 'wb-panel-title'}, '对局信息', h('button', {class: 'wb-icon-button'}, '▣')),
      h('div', {class: 'wb-play-info-grid'},
        h('span', {}, '黑方'), h('strong', {}, '● 我'),
        h('span', {}, '白方'), h('strong', {}, '○ AI 9段'),
        h('span', {}, '贴目'), h('strong', {}, '7.5'),
        h('span', {}, '规则'), h('strong', {}, '中国规则'),
        h('span', {}, '用时'), h('strong', {}, '60 分钟 / 3 x 30 秒'),
        h('span', {}, '当前'), h('strong', {}, '第 ', moveCount || 42, ' 手（黑方）'),
      ),
    ),

    h('div', {class: 'wb-card wb-board-overview-card'},
      h('div', {class: 'wb-panel-title'}, '局面概览', h('button', {class: 'wb-icon-button'}, '▦')),
      h('div', {class: 'wb-play-info-grid'},
        h('span', {}, '● 黑方提子'), h('strong', {}, captures.black || 7),
        h('span', {}, '○ 白方提子'), h('strong', {}, captures.white || 5),
        h('span', {}, '空点'), h('strong', {}, 121),
      ),
    ),

    h('div', {class: 'wb-card wb-save-state-card'},
      h('div', {class: 'wb-panel-title'}, '保存状态', h('button', {class: 'wb-icon-button'}, '☁')),
      h('span', {class: 'wb-save-state-card__badge'}, '未保存'),
      h('p', {}, pendingEval > 0 ? '正在等待评估完成' : '对局尚未保存到本地'),
      h('div', {class: 'wb-card--compat'},
        h('span', {}, badMoveCount),
        h(EmptyStatePanel, {
          icon: 'tree',
          title: '变化树',
          description: '对局过程中将自动记录变化',
        }),
      ),
    ),
  )
}
