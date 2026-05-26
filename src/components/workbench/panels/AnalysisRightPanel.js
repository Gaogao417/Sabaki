import {h} from 'preact'
import MiniBoard from '../shared/MiniBoard.js'

function ExpandableTitle({title, onExpand}) {
  return h('div', {style: 'display: flex; align-items: center; justify-content: space-between'},
    h('span', {class: 'wb-panel-title', style: 'margin-bottom: 0'}, title),
    onExpand && h('button', {
      'data-testid': `expand-${title}`,
      class: 'wb-btn wb-btn-ghost wb-btn--sm',
      style: 'font-size: 12px; padding: 0 8px; height: 24px',
      onClick: onExpand,
    }, '展开'),
  )
}

/**
 * AnalysisRightPanel renders the right panel content for Analysis mode.
 *
 * @param {Object} props
 * @param {number} props.moveCount - Number of moves
 * @param {{black: number, white: number}} props.captures - Capture counts
 * @param {string|null} props.evaluation - Evaluation text, or null if none
 * @param {string|null} props.userOriginalLine - User's original line text
 * @param {string|null} props.userCorrection - User's correction text
 * @param {string|null} props.aiCandidates - AI candidates text
 * @param {Object|null} props.analysisProjection - Analysis panel projection
 * @param {Object|null} props.boardProps - Structured Goban props
 * @param {Function} [props.onExpandAI] - Called when AI analysis expand is clicked
 * @param {Function} [props.onExpandVariation] - Called when variation tree expand is clicked
 * @param {Function} [props.onExpandSnapshot] - Called when snapshot comparison expand is clicked
 * @param {number} props.badMoveCount - Number of visible bad moves
 */
export default function AnalysisRightPanel({
  moveCount = 0,
  captures = {black: 0, white: 0},
  evaluation = null,
  userOriginalLine = null,
  userCorrection = null,
  aiCandidates = null,
  analysisProjection = null,
  boardProps = null,
  badMoveCount = 0,
  onExpandAI,
  onExpandVariation,
  onExpandSnapshot,
}) {
  const projection = normalizeAnalysisProjection({
    analysisProjection,
    boardProjection: boardProps?.analysisPanelProps,
    evaluation,
    userOriginalLine,
    userCorrection,
    aiCandidates,
  })

  return h('div', {
    'data-testid': 'analysis-right-panel',
    class: 'wb-analysis-right-panel',
  },
    h('div', {class: 'wb-card wb-reference-board-card'},
      h(ExpandableTitle, {title: '参考变化 / Reference Board', onExpand: onExpandSnapshot}),
      h(MiniBoard, {size: 9}),
    ),

    h('div', {class: 'wb-card wb-ai-card'},
      h('div', {class: 'wb-panel-title'}, 'AI 分析',
        projection.engineStatus && h('span', {class: 'wb-ai-card__engine'}, projection.engineStatus),
      ),
      h('div', {class: 'wb-ai-table'},
        h('div', {}, h('span', {}, '#'), h('span', {}, '候选手'), h('span', {}, '胜率'), h('span', {}, '目差(当前)')),
        projection.candidates.length > 0
          ? projection.candidates.map((candidate, index) =>
              h('button', {key: `${candidate.label}-${index}`, class: index === 0 ? 'active' : ''},
                h('span', {}, index + 1),
                h('span', {}, candidate.label, candidate.moves.length > 0 ? ` ${candidate.moves.join(' ')}` : ''),
                h('span', {}, candidate.winrate || ''),
                h('span', {}, candidate.score || ''),
              ),
            )
          : h('div', {class: 'wb-panel-caption'}, '暂无候选'),
      ),
    ),

    h('div', {class: 'wb-card wb-note-card'},
      h('div', {class: 'wb-panel-title'}, '局面笔记', h('button', {class: 'wb-icon-button'}, '✎')),
      h('p', {}, projection.evaluation || '--'),
      projection.contextLabel && h('span', {class: 'wb-note-card__tag'}, projection.contextLabel),
    ),

    h('div', {class: 'wb-card wb-card--compat'},
      h(ExpandableTitle, {title: 'AI 分析', onExpand: onExpandAI}),
    ),
    h('div', {class: 'wb-card wb-card--compat'},
      h('div', {class: 'wb-panel-title'}, '对比'),
      h('div', {class: 'wb-analysis-right-panel__comparison'},
        h('div', {class: 'wb-analysis-right-panel__field'},
          h('span', {class: 'wb-analysis-right-panel__field-label'}, '用户原线'),
          h('span', {class: 'wb-analysis-right-panel__field-value'}, projection.userOriginalLine || '--'),
        ),
        h('div', {class: 'wb-analysis-right-panel__field'},
          h('span', {class: 'wb-analysis-right-panel__field-label'}, '用户修正'),
          h('span', {class: 'wb-analysis-right-panel__field-value'}, projection.userCorrection || '--'),
        ),
        h('div', {class: 'wb-analysis-right-panel__field'},
          h('span', {class: 'wb-analysis-right-panel__field-label'}, 'AI candidates'),
          h('span', {class: 'wb-analysis-right-panel__field-value'}, projection.aiCandidates || '--'),
        ),
      ),
    ),
    h('div', {class: 'wb-card wb-card--compat'},
      h(ExpandableTitle, {title: '变化树', onExpand: onExpandVariation}),
      h('span', {}, moveCount, captures.black, captures.white, badMoveCount),
    ),
    h('div', {class: 'wb-card wb-card--compat'},
      h(ExpandableTitle, {title: '快照对比', onExpand: onExpandSnapshot}),
      h('button', {'data-testid': 'add-snapshot-btn'}, '添加快照'),
    ),
  )
}

function normalizeAnalysisProjection({
  analysisProjection,
  boardProjection,
  evaluation,
  userOriginalLine,
  userCorrection,
  aiCandidates,
}) {
  const source = isObject(analysisProjection) ? analysisProjection : {}
  const board = isObject(boardProjection) ? boardProjection : {}
  return {
    contextLabel: asText(source.contextLabel),
    engineStatus: asText(source.engineStatus) || asText(source.status) || asText(board.engineStatus),
    evaluation: asText(source.evaluation) || asText(board.evaluation) || asText(evaluation),
    userOriginalLine: formatLine(source.referenceLine) || asText(userOriginalLine),
    userCorrection: formatLine(source.correctionLine) || asText(userCorrection),
    aiCandidates: formatLine(source.aiCandidates) || asText(aiCandidates),
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

function formatLine(value) {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(' ')
  return asText(value)
}

function normalizeCandidates(value) {
  if (!Array.isArray(value)) return []
  return value.map(item => {
    if (!isObject(item)) return {label: asText(item), moves: [], winrate: '', score: ''}
    return {
      label: asText(item.label) || asText(item.move) || '候选',
      moves: Array.isArray(item.moves)
        ? item.moves.map(asText).filter(Boolean)
        : formatLine(item.moves).split(/\s+/).filter(Boolean),
      winrate: asText(item.winrate) || asText(item.winrateLabel),
      score: asText(item.score) || asText(item.delta) || asText(item.scoreLead),
    }
  }).filter(candidate => candidate.label)
}
