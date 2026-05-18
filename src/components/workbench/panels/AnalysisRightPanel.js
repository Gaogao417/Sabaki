import {h} from 'preact'
import EmptyStatePanel from '../shared/EmptyStatePanel.js'

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
 */
export default function AnalysisRightPanel({
  moveCount = 0,
  captures = {black: 0, white: 0},
  evaluation = null,
  userOriginalLine = null,
  userCorrection = null,
  aiCandidates = null,
}) {
  return h('div', {
    'data-testid': 'analysis-right-panel',
    class: 'wb-analysis-right-panel',
  },
    // AI analysis card
    h('div', {class: 'wb-card'},
      h('div', {class: 'wb-panel-title'}, 'AI 分析'),
      h(EmptyStatePanel, {
        icon: '🔍',
        title: 'AI 分析',
        description: '连接引擎后可查看分析结果',
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

    // Variation tree card
    h('div', {class: 'wb-card'},
      h('div', {class: 'wb-panel-title'}, '变化树'),
      h(EmptyStatePanel, {
        icon: '🌳',
        title: '变化树',
        description: '分析过程中将记录变化',
      }),
    ),

    // Comparison card
    h('div', {class: 'wb-card'},
      h('div', {class: 'wb-panel-title'}, '对比'),
      h('div', {class: 'wb-analysis-right-panel__comparison'},
        userOriginalLine != null && h('div', {class: 'wb-analysis-right-panel__field'},
          h('span', {class: 'wb-analysis-right-panel__field-label'}, '用户原谱'),
          h('span', {class: 'wb-analysis-right-panel__field-value'}, userOriginalLine),
        ),
        userCorrection != null && h('div', {class: 'wb-analysis-right-panel__field'},
          h('span', {class: 'wb-analysis-right-panel__field-label'}, '用户修正'),
          h('span', {class: 'wb-analysis-right-panel__field-value'}, userCorrection),
        ),
        aiCandidates != null && h('div', {class: 'wb-analysis-right-panel__field'},
          h('span', {class: 'wb-analysis-right-panel__field-label'}, 'AI 候选'),
          h('span', {class: 'wb-analysis-right-panel__field-value'}, aiCandidates),
        ),
      ),
    ),

    // Snapshot comparison card
    h('div', {class: 'wb-card'},
      h('div', {class: 'wb-panel-title'}, '快照对比'),
      h('button', {
        'data-testid': 'add-snapshot-btn',
        class: 'wb-analysis-right-panel__snapshot-btn',
      }, '添加快照'),
    ),
  )
}
