import {h} from 'preact'
import EmptyStatePanel from '../shared/EmptyStatePanel.js'
import OpponentControl from '../shared/OpponentControl.js'

/**
 * @callback onMarkDoubtfulCallback
 * @param {void} - No parameters
 * Called when user marks the current position as doubtful.
 */

/**
 * @callback onEnterAnalysisCallback
 * @param {void} - No parameters
 * Called when user wants to switch from Play to Analysis mode.
 */

/**
 * @callback onOpponentChangeCallback
 * @param {string} newValue - New opponent type: 'self' or 'ai'
 * Called when user selects a different opponent type.
 */

/**
 * PlayModePanel renders the left panel for Play mode.
 *
 * @param {Object} props
 * @param {string} props.taskTitle - Title of the current task
 * @param {string} props.taskDescription - Description of the current task
 * @param {number} props.moveCount - Number of moves played
 * @param {{black: number, white: number}} props.captures - Capture counts
 * @param {string} props.opponentType - Current opponent selection: 'self' or 'ai'
 * @param {onMarkDoubtfulCallback} props.onMarkDoubtful - Called when user marks position as doubtful
 * @param {onEnterAnalysisCallback} props.onEnterAnalysis - Called when user wants to enter analysis
 * @param {onOpponentChangeCallback} props.onOpponentChange - Called when user changes opponent type
 * @param {'empty'|'active'|'success'|'error'|'loading'|'disabled'} [props.state='active'] - Panel state overlay
 */
export default function PlayModePanel({
  taskTitle = '',
  taskDescription = '',
  moveCount = 0,
  captures = {black: 0, white: 0},
  opponentType = 'self',
  blackPlayer = 'self',
  whitePlayer = 'self',
  onMarkDoubtful = () => {},
  onEnterAnalysis = () => {},
  onOpponentChange = () => {},
  onBlackPlayerChange,
  onWhitePlayerChange,
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
        icon: 'circle',
        title: 'No Game Loaded',
        description: 'Start a new game to begin playing.',
      })
    }

    // Card 1: 当前模式
    // Card 2: 黑白控制 — opponent selector
    // Card 3: 当前任务 — stats + action buttons
    return [
      h('div', {class: 'wb-card', key: 'card-mode'},
        h('div', {class: 'wb-panel-title'}, '对局模式'),
        h('div', {class: 'wb-panel-body'},
          h('div', {style: 'font-weight: 500; margin-bottom: 4px'}, '对局模式'),
          h('div', {style: 'font-size: 12px; color: var(--ui-text-tertiary)'}, '普通对局、续弈或实战模拟'),
          h('div', {style: 'margin-top: 10px; border-top: 1px solid var(--ui-border); padding-top: 8px'},
            h('div', {style: 'font-size: 12px; color: var(--ui-text-tertiary); margin-bottom: 4px'}, '当前行棋'),
            h('div', {style: 'font-size: 13px; font-weight: 500'}, taskTitle || '准备开始'),
          ),
          h('div', {style: 'margin-top: 8px; border-top: 1px solid var(--ui-border); padding-top: 8px'},
            taskDescription && h('div', {style: 'font-size: 13px; color: var(--ui-text-tertiary); margin-bottom: 4px'}, taskDescription),
            h('div', {style: 'font-size: 12px; color: var(--ui-text-tertiary); margin-bottom: 4px'}, '对局状态'),
            h('div', {style: 'font-size: 13px'},
              h('span', {style: 'color: var(--ui-text-secondary)'}, moveCount === 0 ? '准备开始' : '对局中'),
              ' · 第 ', moveCount, ' 手',
            ),
          ),
        ),
      ),
      h('div', {class: 'wb-card', key: 'card-opponent'},
        h('div', {class: 'wb-panel-title'}, '黑白控制'),
        h('div', {class: 'wb-panel-body'},
          h('div', {style: 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px'},
            h('span', {
              style: 'display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #555, #111 60%, #000); flex-shrink: 0',
            }),
            h(OpponentControl, {
              value: onBlackPlayerChange ? blackPlayer : opponentType,
              onChange: onBlackPlayerChange || onOpponentChange,
              label: '黑方',
            }),
          ),
          h('div', {style: 'display: flex; align-items: center; gap: 8px'},
            h('span', {
              style: 'display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff, #e8e8e8 60%, #ccc); border: 1px solid var(--ui-border); flex-shrink: 0',
            }),
            h(OpponentControl, {
              value: onWhitePlayerChange ? whitePlayer : opponentType,
              onChange: onWhitePlayerChange || onOpponentChange,
              label: '白方',
            }),
          ),
        ),
      ),
      h('div', {class: 'wb-card', key: 'card-task'},
        h('div', {class: 'wb-panel-title'}, '当前任务'),
        h('div', {class: 'wb-panel-body'},
          h('div', {class: 'wb-play-mode-panel__stats'},
            h('span', {class: 'wb-play-mode-panel__move-count'}, moveCount),
            h('span', {class: 'wb-play-mode-panel__captures'},
              '黑 ', captures.black, ' / 白 ', captures.white,
            ),
          ),
          h('div', {class: 'wb-play-mode-panel__actions'},
            h('button', {
              'data-testid': 'mark-doubtful-btn',
              class: 'wb-btn wb-btn-secondary wb-btn--sm',
              onClick: onMarkDoubtful,
            }, '标记疑问'),
            h('button', {
              'data-testid': 'enter-analysis-btn',
              class: 'wb-btn wb-btn-secondary wb-btn--sm',
              onClick: onEnterAnalysis,
            }, '进入复盘'),
          ),
        ),
      ),
    ]
  }

  return h('div', {'data-testid': 'play-mode-panel', class: 'wb-play-mode-panel'},
    renderContent(),
  )
}
