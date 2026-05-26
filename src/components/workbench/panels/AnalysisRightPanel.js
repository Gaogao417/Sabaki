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
  badMoveCount = 0,
  onExpandAI,
  onExpandVariation,
  onExpandSnapshot,
}) {
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
        h('span', {class: 'wb-ai-card__engine'}, 'Leela Zero (v0.19)'),
      ),
      h('div', {class: 'wb-ai-table'},
        h('div', {}, h('span', {}, '#'), h('span', {}, '候选手'), h('span', {}, '胜率'), h('span', {}, '目差(当前)')),
        [
          ['1', '○ R10', '34.1%', '-5.5'],
          ['2', '○ Q11', '38.7%', '-1.8'],
          ['3', '○ R9', '36.2%', '-2.6'],
          ['4', '○ S10', '33.0%', '-6.1'],
          ['5', '○ Q10', '32.1%', '-6.9'],
        ].map((row, index) =>
          h('button', {key: row[0], class: index === 0 ? 'active' : ''},
            row.map(cell => h('span', {key: cell}, cell)),
          ),
        ),
      ),
    ),

    h('div', {class: 'wb-card wb-note-card'},
      h('div', {class: 'wb-panel-title'}, '局面笔记', h('button', {class: 'wb-icon-button'}, '✎')),
      h('p', {}, evaluation || '右边白棋形状薄弱，黑棋有扩张机会。R10 被 AI 评为最优定式大头，较参考变化（R17）明显更好。'),
      h('span', {class: 'wb-note-card__tag'}, '来自 Recall 修正'),
      h('small', {}, '更新于 10-24'),
    ),

    h('div', {class: 'wb-card wb-card--compat'},
      h(ExpandableTitle, {title: 'AI 分析', onExpand: onExpandAI}),
    ),
    h('div', {class: 'wb-card wb-card--compat'},
      h('div', {class: 'wb-panel-title'}, '对比'),
      h('div', {class: 'wb-analysis-right-panel__comparison'},
        h('div', {class: 'wb-analysis-right-panel__field'},
          h('span', {class: 'wb-analysis-right-panel__field-label'}, '用户原线'),
          h('span', {class: 'wb-analysis-right-panel__field-value'}, userOriginalLine || '--'),
        ),
        h('div', {class: 'wb-analysis-right-panel__field'},
          h('span', {class: 'wb-analysis-right-panel__field-label'}, '用户修正'),
          h('span', {class: 'wb-analysis-right-panel__field-value'}, userCorrection || '--'),
        ),
        h('div', {class: 'wb-analysis-right-panel__field'},
          h('span', {class: 'wb-analysis-right-panel__field-label'}, 'AI candidates'),
          h('span', {class: 'wb-analysis-right-panel__field-value'}, aiCandidates || '--'),
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
