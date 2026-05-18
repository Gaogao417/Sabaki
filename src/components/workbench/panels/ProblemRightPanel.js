import {h} from 'preact'
import ReferenceLineSummary from '../shared/ReferenceLineSummary.js'

/**
 * ProblemRightPanel renders the right panel content for Problem mode.
 *
 * @param {Object} props
 * @param {number} props.currentVariation - Current variation index
 * @param {string} props.opponentMode - Opponent mode identifier
 * @param {string|null} props.hint - Hint text, or null if no hint
 * @param {boolean} props.aiAnalysisHidden - Whether AI analysis is hidden
 * @param {Array<{label: string, length: number}>} props.referenceLines - Reference lines
 */
export default function ProblemRightPanel({
  currentVariation = 0,
  opponentMode = 'ai',
  hint = null,
  aiAnalysisHidden = true,
  referenceLines = [],
}) {
  const totalRefCount = referenceLines.reduce((sum, line) => sum + line.length, 0)

  return h('div', {
    'data-testid': 'problem-right-panel',
    class: 'wb-problem-right-panel',
  },
    // Answer draft card
    h('div', {class: 'wb-card'},
      h('div', {class: 'wb-panel-title'}, '答案草稿'),
      h('div', {class: 'wb-problem-right-panel__answer-draft'},
        h('div', {class: 'wb-problem-right-panel__stat'},
          h('span', {class: 'wb-problem-right-panel__stat-label'}, '当前变化'),
          h('span', {class: 'wb-problem-right-panel__stat-value'}, currentVariation, ' 手'),
        ),
        h('div', {class: 'wb-problem-right-panel__stat'},
          h('span', {class: 'wb-problem-right-panel__stat-label'}, '对方'),
          h('span', {class: 'wb-problem-right-panel__stat-value'},
            opponentMode === 'ai' ? 'AI 应手' : '自己控制',
          ),
        ),
      ),
    ),

    // Hint card — always shown, with empty state when no hint
    h('div', {
      'data-testid': 'hint-card',
      class: 'wb-card',
    },
      h('div', {class: 'wb-panel-title'}, 'Hint'),
      hint != null
        ? h('div', {class: 'wb-problem-right-panel__hint-content'}, hint)
        : h('div', {style: 'font-size: 13px; color: var(--ui-text-tertiary)'},
            '暂无提示',
            h('div', {style: 'margin-top: 4px; font-size: 12px'}, '请求提示后显示方向性信息，不直接显示完整答案。'),
          ),
    ),

    // AI analysis card
    h('div', {class: 'wb-card'},
      h('div', {class: 'wb-panel-title'}, 'AI 分析'),
      aiAnalysisHidden
        ? h('div', {class: 'wb-problem-right-panel__ai-hidden'}, 'AI 答案默认隐藏')
        : h('div', {class: 'wb-problem-right-panel__ai-visible'}, 'AI 分析可见'),
    ),

    // Reference line summary card
    h('div', {class: 'wb-card'},
      h('div', {class: 'wb-panel-title'}, '参考变化摘要'),
      referenceLines.length > 0
        ? h(ReferenceLineSummary, {
            lines: referenceLines,
            totalCount: totalRefCount,
          })
        : h('div', {class: 'wb-panel-caption'}, '暂无参考线'),
    ),
  )
}
