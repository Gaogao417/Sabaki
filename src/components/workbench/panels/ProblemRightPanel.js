import {h} from 'preact'
/**
 * ProblemRightPanel renders the right panel content for Problem mode.
 *
 * @param {Object} props
 * @param {number} props.currentVariation - Current variation index
 * @param {string} props.opponentMode - Opponent mode identifier
 * @param {string|null} props.hint - Hint text, or null if no hint
 * @param {boolean} props.aiAnalysisHidden - Whether AI analysis is hidden
 * @param {Array<{label: string, length: number}>} props.referenceLines - Reference lines
 * @param {number} props.pendingEval - Pending evaluation count
 * @param {number} props.badMoveCount - Number of bad moves detected
 */
export default function ProblemRightPanel({
  hint = null,
  pendingEval = 0,
  badMoveCount = 0,
  problemSession = null,
  problemAttempt = null,
  problemEvalCache = [],
  problemBadMoves = [],
}) {
  const session = asRecord(problemSession)
  const attempt = asRecord(problemAttempt)
  const evaluations = Array.isArray(problemEvalCache) ? problemEvalCache : []
  const badMoves = Array.isArray(problemBadMoves) ? problemBadMoves : []
  const latestEvaluation = evaluations.length > 0 ? evaluations[evaluations.length - 1] : null
  const scoreLead = firstText(
    asRecord(latestEvaluation)?.scoreLeadLabel,
    session?.scoreLeadLabel,
    formatScoreLead(asRecord(latestEvaluation)?.afterScoreLead),
  ) || '3.6'
  const scoreDrop = firstText(
    asRecord(latestEvaluation)?.scoreDropLabel,
    session?.scoreDropLabel,
    formatScoreDrop(asRecord(latestEvaluation)?.scoreDrop),
  ) || '0.0 目'
  const hintText = firstText(session?.hintUsageLabel, hint, session?.hint)
  const hintBody = firstText(session?.hint, hint) || '需要提示时可获取帮助'
  const pathLabel = firstText(
    session?.attemptPathLabel,
    asRecord(latestEvaluation)?.attemptPathLabel,
    formatAttemptPath(attempt?.userLine),
  )
  const badMoveLabel = firstText(
    asRecord(badMoves[0])?.label,
    asRecord(badMoves[0])?.severityLabel,
    formatBadMove(badMoves[0], badMoveCount),
  )
  const pathRows = normalizePathRows(attempt?.userLine, pathLabel)

  return h('div', {
    'data-testid': 'problem-right-panel',
    class: 'wb-problem-right-panel',
  },
    h('div', {class: 'wb-card wb-eval-card'},
      h('div', {class: 'wb-panel-title'}, '评估监控'),
      h('button', {class: 'wb-card-expand', 'aria-label': '展开评估监控'}, '↗'),
      h('div', {class: 'wb-eval-card__lead'},
        h('span', {}, '领先（黑）'),
        h('strong', {}, scoreLead),
      ),
      h('div', {class: 'wb-eval-card__row'},
        h('span', {}, pendingEval > 0 ? '评估中' : '最近下降'),
        h('b', {}, scoreDrop),
      ),
      h('div', {class: 'wb-sparkline', 'aria-hidden': 'true'},
        [8, 8, 13, 9, 8, 7, 6].map((height, index) =>
          h('span', {key: index, style: `--y:${height}`}),
        ),
      ),
      h('div', {class: 'wb-sparkline__ticks'}, h('span', {}, '2'), h('span', {}, '4'), h('span', {}, '6'), h('span', {}, '8'), h('span', {}, '10')),
    ),

    h('div', {
      'data-testid': 'hint-card',
      class: 'wb-card wb-hint-card',
    },
      h('div', {class: 'wb-panel-title'}, '提示'),
      h('div', {class: 'wb-hint-card__used'},
        h('span', {}, '已使用'),
        h('strong', {}, hintText || '1/5'),
      ),
      h('p', {}, hintBody),
      h('button', {class: 'wb-btn wb-btn-secondary'}, '请求提示'),
    ),

    h('div', {class: 'wb-card wb-path-card'},
      h('div', {class: 'wb-panel-title'}, '当前尝试路径'),
      h('ol', {class: 'wb-path-card__steps'},
        pathRows.map(([label, time, active], index) =>
          h('li', {key: index, class: active ? 'active' : ''},
            h('span', {class: 'wb-path-card__index'}, index + 1),
            h('span', {class: 'wb-path-card__label'}, label),
            h('span', {class: 'wb-path-card__time'}, time),
          ),
        ),
      ),
      badMoveLabel && h('span', {class: 'wb-path-card__badge'}, badMoveLabel),
    ),
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

function formatScoreLead(value) {
  return typeof value === 'number' ? `${value} 目` : ''
}

function formatScoreDrop(value) {
  return typeof value === 'number' ? `${value} 目` : ''
}

function formatAttemptPath(userLine) {
  return Array.isArray(userLine) && userLine.length > 0 ? userLine.join(' ') : ''
}

function formatBadMove(value, count) {
  const record = asRecord(value)
  if (!record) return count > 0 ? String(count) : ''
  return firstText(
    record.label,
    record.severityLabel,
    record.move && record.severity ? `${record.severity} ${record.move}` : '',
  )
}

function normalizePathRows(userLine, pathLabel) {
  if (pathLabel) return [[pathLabel, '', true]]
  if (Array.isArray(userLine) && userLine.length > 0) {
    return userLine.map((move, index) => [String(move), '', index === userLine.length - 1])
  }
  return [
    ['开始', '00:00', false],
    ['思考中', '00:27', true],
    ['...', '', false],
    ['...', '', false],
    ['...', '', false],
  ]
}
