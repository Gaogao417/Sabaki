import {h} from 'preact'
import EmptyStatePanel from '../shared/EmptyStatePanel.js'

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
    // AI analysis card
    h('div', {class: 'wb-card'},
      h(ExpandableTitle, {title: 'AI 分析', onExpand: onExpandAI}),
      h(EmptyStatePanel, {
        icon: 'search',
        title: '暂无分析数据',
        description: '选择关键局面后，AI 将在此提供形势判断、推荐手段与变化建议',
      }),
    ),

    // Board evaluation card
    h('div', {class: 'wb-card'},
      h('div', {class: 'wb-panel-title'}, '局面点评'),
      h('div', {class: 'wb-analysis-right-panel__evaluation'},
        h('div', {class: 'wb-analysis-right-panel__stat'},
          h('span', {class: 'wb-analysis-right-panel__stat-label'}, '手数'),
          h('span', {class: 'wb-analysis-right-panel__stat-value'}, moveCount),
        ),
        h('div', {class: 'wb-analysis-right-panel__stat'},
          h('span', {class: 'wb-analysis-right-panel__stat-label'}, '提子'),
          h('span', {class: 'wb-analysis-right-panel__stat-value'},
            '黑 ', captures.black, ' / 白 ', captures.white,
          ),
        ),
        evaluation != null && h('div', {class: 'wb-analysis-right-panel__eval-text'}, evaluation),
      ),
    ),

    // Bad move summary card
    h('div', {class: 'wb-card'},
      h('div', {class: 'wb-panel-title'}, '坏棋摘要'),
      h('div', {class: 'wb-analysis-right-panel__field'},
        h('span', {class: 'wb-analysis-right-panel__field-label'}, '坏棋记录'),
        h('span', {class: 'wb-analysis-right-panel__field-value'}, badMoveCount),
      ),
    ),

    // Variation tree card
    h('div', {class: 'wb-card'},
      h(ExpandableTitle, {title: '变化树', onExpand: onExpandVariation}),
      h(EmptyStatePanel, {
        icon: 'tree',
        title: '暂无变化',
        description: '自由摆棋或进入分支后将记录变化',
      }),
    ),

    // Comparison card
    h('div', {class: 'wb-card'},
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

    // Snapshot comparison card
    h('div', {class: 'wb-card'},
      h(ExpandableTitle, {title: '快照对比', onExpand: onExpandSnapshot}),
      h('div', {style: 'font-size: 13px; color: var(--ui-text-tertiary); margin-bottom: 10px'},
        '捕捉参考局面后可进行快照对比。',
      ),
      h('button', {
        'data-testid': 'add-snapshot-btn',
        class: 'wb-analysis-right-panel__snapshot-btn',
      }, '添加快照'),
    ),
  )
}
