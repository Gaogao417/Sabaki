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
        h('div', {'data-testid': 'disabled-overlay', class: 'wb-state-disabled__overlay'}, 'Disabled'),
      )
    }

    if (state === 'error') {
      return h('div', {class: 'wb-state-error'},
        h('div', {class: 'wb-state-error__icon'}, '!'),
        h('div', {class: 'wb-state-error__message'}, 'Something went wrong'),
        h('div', {class: 'wb-state-error__retry'},
          h('button', {'data-testid': 'error-overlay', class: 'wb-btn wb-btn-secondary wb-btn--sm'}, 'Retry'),
        ),
      )
    }

    if (state === 'success') {
      return h('div', {class: 'wb-state-success'},
        h('div', {'data-testid': 'success-indicator', class: 'wb-state-success__icon'}, '✓'),
        h('div', {class: 'wb-state-success__message'}, 'Complete'),
      )
    }

    if (state === 'empty') {
      return h(EmptyStatePanel, {
        icon: 'triangle',
        title: 'No Analysis Session',
        description: 'Enter analysis mode to review positions.',
      })
    }

    return [
      // Card 1: 当前模式
      h('div', {class: 'wb-card'},
        h('div', {class: 'wb-panel-title'}, '当前模式'),
        h('div', {class: 'wb-panel-body'},
          h('div', {style: 'font-weight: 500; margin-bottom: 4px'}, '复盘模式'),
          h('div', {style: 'font-size: 12px; color: var(--ui-text-tertiary)'}, '自由研究、比较变化、沉淀笔记'),
        ),
      ),
      // Card 2: 复盘上下文
      h('div', {class: 'wb-card'},
        h('div', {class: 'wb-panel-title'}, '复盘上下文'),
        h('div', {class: 'wb-panel-body'},
          h('div', {class: 'wb-analysis-mode-panel__stats'},
            h('span', {class: 'wb-analysis-mode-panel__stat-item'},
              h('span', {class: 'wb-analysis-mode-panel__stat-label'}, '来源'),
              h('span', {class: 'wb-analysis-mode-panel__captures'}, '当前局面'),
            ),
            h('span', {class: 'wb-analysis-mode-panel__stat-item'},
              h('span', {class: 'wb-analysis-mode-panel__stat-label'}, '当前手数'),
              h('span', {class: 'wb-analysis-mode-panel__move-count'}, moveCount),
            ),
            h('span', {class: 'wb-analysis-mode-panel__stat-item'},
              h('span', {class: 'wb-analysis-mode-panel__stat-label'}, '关联评论'),
              h('span', {class: 'wb-analysis-mode-panel__captures'}, '0'),
            ),
          ),
          evaluation != null && h('div', {
            'data-testid': 'evaluation-section',
            class: 'wb-analysis-mode-panel__evaluation',
          },
            h('span', {class: 'wb-analysis-mode-panel__stat-label'}, '综合评价'),
            h('span', null, evaluation),
          ),
        ),
      ),
      // Card 3: 关键点筛选
      h('div', {class: 'wb-card'},
        h('div', {class: 'wb-panel-title'}, '关键点筛选'),
        h('div', {class: 'wb-panel-body'},
          h('div', {style: 'display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap'},
            ['全部', '坏棋', 'Checkpoint', '备注'].map(tag =>
              h('button', {
                key: tag,
                class: 'wb-btn wb-btn-ghost wb-btn--sm',
                onClick: () => {},
              }, tag),
            ),
          ),
          h('div', {style: 'font-size: 12px; color: var(--ui-text-tertiary)'},
            '使用右侧变化树和局面点评辅助筛选。',
          ),
        ),
      ),
      // Card 4: 复盘笔记
      h('div', {class: 'wb-card'},
        h('div', {class: 'wb-panel-title'}, '复盘笔记'),
        h('div', {class: 'wb-panel-body'},
          h('div', {style: 'font-size: 13px; color: var(--ui-text-tertiary); padding: 8px 0'},
            '记录这一手的想法、对局思路与改进方向。',
          ),
        ),
      ),
      // Card 5: Snapshot / 派生新 Task
      h('div', {class: 'wb-card'},
        h('div', {class: 'wb-panel-title'}, 'Snapshot'),
        h('div', {class: 'wb-panel-body'},
          h('div', {style: 'font-size: 13px; color: var(--ui-text-secondary); margin-bottom: 10px'},
            '捕获当前局面，派生为新的 TrainingTask。',
          ),
          h('button', {
            'data-testid': 'snapshot-btn',
            class: 'wb-btn wb-btn-primary wb-btn--sm',
            onClick: onSnapshot,
          }, 'Snapshot / 派生新 Task'),
        ),
      ),
    ]
  }

  return h('div', {'data-testid': 'analysis-mode-panel', class: 'wb-analysis-mode-panel'},
    renderContent(),
  )
}
