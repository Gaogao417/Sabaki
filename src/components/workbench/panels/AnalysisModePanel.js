import {h} from 'preact'
import EmptyStatePanel from '../shared/EmptyStatePanel.js'

/**
 * AnalysisModePanel renders the left panel for Analysis mode.
 *
 * @param {Object} props
 * @param {number} props.moveCount - Number of moves
 * @param {{black: number, white: number}} props.captures - Capture counts
 * @param {string|null} props.evaluation - Evaluation text, or null if none
 * @param {Function} props.onSnapshot - Called when user takes a snapshot
 * @param {'empty'|'active'|'success'|'error'|'loading'|'disabled'} [props.state='active'] - Panel state overlay
 */
export default function AnalysisModePanel({
  moveCount = 0,
  captures = {black: 0, white: 0},
  evaluation = null,
  onSnapshot = () => {},
  onFilterChange = () => {},
  state = 'active',
}) {
  function renderContent() {
    if (state === 'loading') {
      return h('div', {class: 'wb-state-loading'},
        h('div', {'data-testid': 'loading-indicator', class: 'wb-state-loading__spinner'}),
      )
    }

    if (state === 'disabled') {
      return h('div', {class: 'wb-state-disabled'},
        h('div', {'data-testid': 'disabled-overlay', class: 'wb-state-disabled__overlay'}, '暂不可用'),
      )
    }

    if (state === 'error') {
      return h('div', {class: 'wb-state-error'},
        h('div', {class: 'wb-state-error__icon'}, '!'),
        h('div', {class: 'wb-state-error__message'}, '当前复盘状态异常'),
        h('div', {class: 'wb-state-error__retry'},
          h('button', {'data-testid': 'error-overlay', class: 'wb-btn wb-btn-secondary wb-btn--sm'}, '重试'),
        ),
      )
    }

    if (state === 'success') {
      return h('div', {class: 'wb-state-success'},
        h('div', {'data-testid': 'success-indicator', class: 'wb-state-success__icon'}, '✓'),
        h('div', {class: 'wb-state-success__message'}, '已保存'),
      )
    }

    if (state === 'empty') {
      return h(EmptyStatePanel, {
        icon: 'triangle',
        title: '暂无复盘上下文',
        description: '进入复盘后研究当前局面。',
      })
    }

    return [
      h('div', {class: 'wb-card wb-analysis-tree-card'},
        h('div', {class: 'wb-panel-title'}, '变化树', h('button', {class: 'wb-icon-button'}, '⌘')),
        h('div', {class: 'wb-analysis-tree'},
          h('div', {class: 'root'}, '根节点（第 1 手）'),
          [
            ['当前变化（主线）', '-5.5', true],
            ['黑 R10', '-1.2', false],
            ['白 Q4', '-3.8', false],
            ['黑 D16', '-7.6', false],
            ['白 C3', '-2.1', false],
          ].map(([label, score, active], index) =>
            h('div', {key: label, class: active ? 'active' : ''},
              h('span', {class: 'node'}, index === 0 ? '' : String.fromCharCode(64 + index)),
              h('span', {}, label),
              h('strong', {}, score),
            ),
          ),
          h('button', {class: 'wb-link-button'}, '+ 添加变化'),
        ),
      ),

      h('div', {class: 'wb-card wb-badmove-list-card'},
        h('div', {class: 'wb-panel-title'}, '问题手列表', h('button', {class: 'wb-icon-button'}, '▽')),
        h('div', {class: 'wb-badmove-table'},
          h('div', {}, h('span', {}, ''), h('span', {}, '候选手'), h('span', {}, '差值(目)'), h('span', {}, '状态')),
          [
            ['32', '○ 白 Q4', '-8.7', '已修正'],
            ['45', '△ 黑 D16', '-7.6', '已修正'],
            ['76', '○ 白 R10', '-5.5', '已修正'],
            ['61', '△ 黑 C3', '-4.1', '已评论'],
            ['54', '○ 白 J10', '-3.2', '已评论'],
          ].map(([move, point, delta, status], index) =>
            h('button', {key: move, class: index === 2 ? 'active' : ''},
              h('span', {class: 'move'}, move),
              h('span', {}, point),
              h('span', {}, delta),
              h('strong', {}, status),
            ),
          ),
          h('button', {class: 'wb-badmove-list-card__all'}, '查看全部 (12)'),
        ),
      ),

      h('div', {class: 'wb-card wb-card--compat'},
        h('div', {class: 'wb-panel-title'}, '复盘模式'),
        evaluation != null && h('div', {'data-testid': 'evaluation-section'}, evaluation),
      ),
      h('div', {class: 'wb-card wb-card--compat'},
        h('div', {class: 'wb-panel-title'}, '复盘上下文'),
        h('span', {}, moveCount, captures.black, captures.white),
      ),
      h('div', {class: 'wb-card wb-card--compat'},
        h('div', {class: 'wb-panel-title'}, '关键点筛选'),
        h('button', {onClick: () => onFilterChange('全部')}, '全部'),
      ),
      h('div', {class: 'wb-card wb-card--compat'},
        h('div', {class: 'wb-panel-title'}, '复盘笔记'),
      ),
      h('div', {class: 'wb-card wb-card--compat'},
        h('div', {class: 'wb-panel-title'}, 'Snapshot'),
        h('button', {'data-testid': 'snapshot-btn', onClick: onSnapshot}, 'Snapshot / 派生新 Task'),
      ),
    ]
  }

  return h('div', {'data-testid': 'analysis-mode-panel', class: 'wb-analysis-mode-panel'},
    renderContent(),
  )
}
