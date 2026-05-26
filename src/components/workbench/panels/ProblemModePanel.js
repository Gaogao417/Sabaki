import {h} from 'preact'
import OpponentControl from '../shared/OpponentControl.js'
import EmptyStatePanel from '../shared/EmptyStatePanel.js'

/**
 * ProblemModePanel renders the left panel for Problem mode.
 *
 * @param {Object} props
 * @param {string} props.prompt - Problem prompt text
 * @param {string} props.goal - Goal description
 * @param {string} props.passRuleSummary - Rule summary text
 * @param {Array<{label: string, length: number}>} props.referenceLines - Reference lines
 * @param {string} props.blackPlayer - Black player info
 * @param {string} props.whitePlayer - White player info
 * @param {Function} props.onOpponentChange - Called when opponent type changes
 * @param {Function} props.onRequestHint - Called when user requests a hint
 * @param {'empty'|'active'|'success'|'error'|'loading'|'disabled'} [props.state='active'] - Panel state overlay
 */
export default function ProblemModePanel({
  prompt = '',
  goal = '',
  passRuleSummary = '',
  referenceLines = [],
  blackPlayer = '',
  whitePlayer = '',
  problemOpponent = 'ai',
  onOpponentChange = () => {},
  onRequestHint = () => {},
  onSubmitAnswer = () => {},
  onAbandonAnswer = () => {},
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
        h('div', {class: 'wb-state-error__message'}, '当前题目状态异常'),
        h('div', {class: 'wb-state-error__retry'},
          h('button', {'data-testid': 'error-overlay', class: 'wb-btn wb-btn-secondary wb-btn--sm'}, '重试'),
        ),
      )
    }

    if (state === 'success') {
      return h('div', {class: 'wb-state-success'},
        h('div', {'data-testid': 'success-indicator', class: 'wb-state-success__icon'}, '✓'),
        h('div', {class: 'wb-state-success__message'}, '已提交'),
      )
    }

    if (state === 'empty') {
      return h(EmptyStatePanel, {
        icon: 'square',
        title: '暂无题目',
        description: '打开题目后开始作答。',
      })
    }

    return [
      h('div', {class: 'wb-card wb-problem-brief-card'},
        h('div', {class: 'wb-panel-title'}, '题目说明 / 题面与目标'),
        h('section', {class: 'wb-brief-section'},
          h('h3', {}, '局面说明'),
          h('p', {}, prompt || '局部战斗中的局面。黑棋需要选择合适的攻击方向，继续施压并争取更大的实地。'),
        ),
        h('section', {class: 'wb-brief-section'},
          h('h3', {}, '训练目标'),
          h('p', {}, goal || '选择最有利的攻击方向，扩大战果，迫使白棋受损或退让。'),
        ),
        h('section', {class: 'wb-brief-section wb-brief-section--rules'},
          h('h3', {}, '规则简述'),
          h('ul', {},
            ['黑先落子', '轮流落子', '贴目 7.5', '数字法计算胜负', '终局需两次确认'].map(item =>
              h('li', {key: item}, item),
            ),
          ),
          passRuleSummary && h('p', {class: 'wb-panel-caption'}, passRuleSummary),
        ),
      ),

      h('div', {class: 'wb-card wb-card--compat'},
        h('div', {class: 'wb-panel-title'}, '做题模式'),
      ),
      h('div', {class: 'wb-card wb-card--compat'},
        h('div', {class: 'wb-panel-title'}, '对方控制'),
        h(OpponentControl, {value: problemOpponent, onChange: onOpponentChange}),
      ),
      h('div', {class: 'wb-card wb-card--compat'},
        h('div', {class: 'wb-panel-title'}, '作答操作'),
        h('button', {'data-testid': 'submit-answer-btn', onClick: onSubmitAnswer}, '提交答案'),
        h('button', {'data-testid': 'abandon-answer-btn', onClick: onAbandonAnswer}, '放弃作答'),
        h('button', {'data-testid': 'request-hint-btn', onClick: onRequestHint}, '请求提示'),
      ),
    ]
  }

  return h('div', {'data-testid': 'problem-mode-panel', class: 'wb-problem-mode-panel'},
    renderContent(),
  )
}
