import {h} from 'preact'
import EmptyStatePanel from '../shared/EmptyStatePanel.js'

/**
 * AnalysisModePanel renders the left panel for Analysis mode.
 *
 * @param {Object} props
 * @param {number} props.moveCount - Number of moves
 * @param {{black: number, white: number}} props.captures - Capture counts
 * @param {string|null} props.evaluation - Evaluation text, or null if none
 * @param {Object|null} props.analysisContext - Analysis origin context
 * @param {Object|null} props.analysisProjection - Analysis panel projection
 * @param {Object|null} props.boardProps - Structured Goban props
 * @param {Function} props.onSnapshot - Called when user takes a snapshot
 * @param {'empty'|'active'|'success'|'error'|'loading'|'disabled'} [props.state='active'] - Panel state overlay
 */
export default function AnalysisModePanel({
  moveCount = 0,
  captures = {black: 0, white: 0},
  evaluation = null,
  analysisContext = null,
  analysisProjection = null,
  boardProps = null,
  onSnapshot = () => {},
  onFilterChange = () => {},
  state = 'active',
}) {
  const projection = normalizeAnalysisProjection({
    analysisContext,
    analysisProjection,
    boardProjection: boardProps?.analysisPanelProps,
    evaluation,
  })

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
      h('div', {class: 'wb-card wb-analysis-context-card'},
        h('div', {class: 'wb-panel-title'}, '复盘上下文'),
        h('div', {class: 'wb-analysis-context-card__body'},
          projection.contextLabel && h('p', {}, projection.contextLabel),
          projection.taskId && h('span', {}, 'Task ', projection.taskId),
          projection.checkpointId && h('span', {}, 'Checkpoint ', projection.checkpointId),
          projection.positionHash && h('span', {}, 'Position ', projection.positionHash),
          h('span', {}, 'Moves ', moveCount),
          h('span', {}, 'Captures ', captures.black, '/', captures.white),
        ),
      ),

      h('div', {class: 'wb-card wb-analysis-tree-card'},
        h('div', {class: 'wb-panel-title'}, '变化树', h('button', {class: 'wb-icon-button'}, '⌘')),
        h('div', {class: 'wb-analysis-tree'},
          h('div', {class: 'root'}, projection.treeRoot || '当前局面'),
          projection.treeRows.length > 0
            ? projection.treeRows.map((row, index) =>
                h('div', {key: `${row.label}-${index}`, class: row.active ? 'active' : ''},
                  h('span', {class: 'node'}, index === 0 ? '' : String.fromCharCode(64 + index)),
                  h('span', {}, row.label),
                  row.score && h('strong', {}, row.score),
                ),
              )
            : h('div', {class: 'wb-panel-caption'}, '暂无变化'),
          h('button', {class: 'wb-link-button'}, '+ 添加变化'),
        ),
      ),

      h('div', {class: 'wb-card wb-badmove-list-card'},
        h('div', {class: 'wb-panel-title'}, '问题手列表', h('button', {class: 'wb-icon-button'}, '▽')),
        h('div', {class: 'wb-badmove-table'},
          h('div', {}, h('span', {}, ''), h('span', {}, '候选手'), h('span', {}, '差值(目)'), h('span', {}, '状态')),
          projection.issues.length > 0
            ? projection.issues.map((issue, index) =>
                h('button', {key: `${issue.label}-${index}`, class: issue.active ? 'active' : ''},
                  h('span', {class: 'move'}, issue.move || index + 1),
                  h('span', {}, issue.label),
                  h('span', {}, issue.delta || ''),
                  h('strong', {}, issue.status || ''),
                ),
              )
            : h('div', {class: 'wb-panel-caption'}, '暂无问题手'),
          projection.issueTotal > projection.issues.length &&
            h('button', {class: 'wb-badmove-list-card__all'}, '查看全部 (', projection.issueTotal, ')'),
        ),
      ),

      h('div', {class: 'wb-card wb-card--compat'},
        h('div', {class: 'wb-panel-title'}, '复盘模式'),
        projection.evaluation && h('div', {'data-testid': 'evaluation-section'}, projection.evaluation),
        projection.engineStatus && h('div', {'data-testid': 'analysis-engine-status'}, projection.engineStatus),
        projection.candidates.map((candidate, index) =>
          h('div', {key: `${candidate.label}-${index}`, class: 'wb-panel-caption'},
            candidate.label,
            candidate.moves.length > 0 ? ` ${candidate.moves.join(' ')}` : '',
          )
        ),
      ),
      h('div', {class: 'wb-card wb-card--compat'},
        h('div', {class: 'wb-panel-title'}, '参考与修正'),
        projection.referenceLine && h('div', {}, projection.referenceLine),
        projection.correctionLine && h('div', {}, projection.correctionLine),
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

function normalizeAnalysisProjection({
  analysisContext,
  analysisProjection,
  boardProjection,
  evaluation,
}) {
  const source = isObject(analysisProjection) ? analysisProjection : {}
  const board = isObject(boardProjection) ? boardProjection : {}
  const context = isObject(analysisContext) ? analysisContext : {}

  return {
    contextLabel: asText(source.contextLabel) || asText(context.source),
    taskId: asText(context.taskId),
    checkpointId: asText(context.checkpointId),
    positionHash: asText(context.positionHash),
    treeRoot: asText(source.treeRoot),
    treeRows: normalizeRows(source.treeRows || source.variations || []),
    issues: normalizeRows(source.issues || source.badMoves || []),
    issueTotal: numberOr(source.issueTotal, Array.isArray(source.issues) ? source.issues.length : 0),
    referenceLine: formatLine(source.referenceLine),
    correctionLine: formatLine(source.correctionLine),
    engineStatus: asText(source.engineStatus) || asText(source.status) || asText(board.engineStatus),
    evaluation: asText(source.evaluation) || asText(board.evaluation) || asText(evaluation),
    candidates: normalizeCandidates(source.candidates || board.candidates || []),
  }
}

function isObject(value) {
  return value != null && typeof value === 'object'
}

function asText(value) {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

function numberOr(value, fallback) {
  return typeof value === 'number' ? value : fallback
}

function formatLine(value) {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(' ')
  return asText(value)
}

function normalizeRows(value) {
  if (!Array.isArray(value)) return []
  return value.map(item => {
    if (!isObject(item)) return {label: asText(item), score: '', active: false}
    return {
      label: asText(item.label) || asText(item.move) || formatLine(item.moves),
      score: asText(item.score) || asText(item.delta),
      move: asText(item.moveNumber) || asText(item.move),
      delta: asText(item.delta),
      status: asText(item.status),
      active: item.active === true,
    }
  }).filter(row => row.label)
}

function normalizeCandidates(value) {
  if (!Array.isArray(value)) return []
  return value.map(item => {
    if (!isObject(item)) return {label: asText(item), moves: []}
    return {
      label: asText(item.label) || asText(item.move) || '候选',
      moves: Array.isArray(item.moves)
        ? item.moves.map(asText).filter(Boolean)
        : formatLine(item.moves).split(/\s+/).filter(Boolean),
    }
  }).filter(candidate => candidate.label)
}
