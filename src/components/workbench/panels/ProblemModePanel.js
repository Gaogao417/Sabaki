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
  positionDescription = '',
  goal = '',
  taskGoal = '',
  passRuleSummary = '',
  passRule = null,
  referenceLines = [],
  sideToMove = '',
  sideToMoveLabel = '',
  problemArea = null,
  problemSession = null,
  blackPlayer = '',
  whitePlayer = '',
  problemOpponent = 'ai',
  onOpponentChange = () => {},
  onRequestHint = () => {},
  onSubmitAnswer = () => {},
  onAbandonAnswer = () => {},
  state = 'active',
}) {
  const session = asRecord(problemSession)
  const effectivePrompt = firstText(prompt, positionDescription, session?.positionDescription)
  const effectiveGoal = firstText(goal, taskGoal, session?.taskGoal, session?.goal)
  const effectivePassRule = firstText(
    passRuleSummary,
    session?.passRuleSummary,
    asRecord(passRule)?.targetDescription,
    formatPassRule(passRule),
  )
  const effectiveSide = firstText(sideToMoveLabel, session?.sideToMoveLabel, formatSideToMove(sideToMove))
  const effectiveArea = firstText(
    formatProblemArea(problemArea),
    formatProblemArea(session?.problemArea),
  )
  const effectiveReferenceLines = normalizeReferenceLines(referenceLines)

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
          h('p', {}, effectivePrompt || '局部战斗中的局面。黑棋需要选择合适的攻击方向，继续施压并争取更大的实地。'),
        ),
        h('section', {class: 'wb-brief-section'},
          h('h3', {}, '训练目标'),
          h('p', {}, effectiveGoal || '选择最有利的攻击方向，扩大战果，迫使白棋受损或退让。'),
        ),
        h('section', {class: 'wb-brief-section wb-brief-section--rules'},
          h('h3', {}, '规则简述'),
          effectiveSide && h('p', {class: 'wb-panel-caption'}, effectiveSide),
          effectiveArea && h('p', {class: 'wb-panel-caption'}, effectiveArea),
          effectivePassRule
            ? h('p', {class: 'wb-panel-caption'}, effectivePassRule)
            : h('ul', {},
              ['黑先落子', '轮流落子', '贴目 7.5', '数字法计算胜负', '终局需两次确认'].map(item =>
                h('li', {key: item}, item),
              ),
            ),
          effectiveReferenceLines.length > 0 && h('ul', {class: 'wb-brief-section__refs'},
            effectiveReferenceLines.map((line, index) =>
              h('li', {key: line.key || index}, line.label),
            ),
          ),
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

function asRecord(value) {
  return value != null && typeof value === 'object' ? value : null
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function formatSideToMove(value) {
  if (value === 'black') return '黑先'
  if (value === 'white') return '白先'
  return ''
}

function formatProblemArea(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.length > 0 ? `题目范围：${value.length} 点` : ''
  const record = asRecord(value)
  return firstText(record?.label, record?.summary, record?.description)
}

function formatPassRule(value) {
  const record = asRecord(value)
  if (!record) return ''

  const parts = []
  if (record.requireNoSevereBadMove) parts.push('无严重坏棋')
  if (record.maxBadMoveCount != null) parts.push(`坏棋不超过 ${record.maxBadMoveCount}`)
  if (record.scoreDropThreshold != null) parts.push(`掉目不超过 ${record.scoreDropThreshold}`)
  return parts.join('，')
}

function normalizeReferenceLines(lines) {
  if (!Array.isArray(lines)) return []
  return lines.map((line, index) => {
    if (typeof line === 'string') return {key: line, label: line}
    const record = asRecord(line)
    if (!record) return {key: index, label: ''}
    const label = firstText(
      record.label,
      record.summary,
      record.name,
      Array.isArray(record.moves) ? `${record.moves.join(' ')} (${record.moves.length})` : '',
    )
    return {key: record.id || label || index, label}
  }).filter(line => line.label !== '')
}
