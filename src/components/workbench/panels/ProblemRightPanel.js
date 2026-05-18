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
    // Answer draft section
    h('div', {class: 'wb-problem-right-panel__section'},
      h('div', {class: 'wb-problem-right-panel__answer-draft'},
        h('div', {class: 'wb-problem-right-panel__stat'},
          h('span', {class: 'wb-problem-right-panel__stat-label'}, '当前变化'),
          h('span', {class: 'wb-problem-right-panel__stat-value'}, currentVariation),
        ),
        h('div', {class: 'wb-problem-right-panel__stat'},
          h('span', {class: 'wb-problem-right-panel__stat-label'}, '对手模式'),
          h('span', {class: 'wb-problem-right-panel__stat-value'}, opponentMode),
        ),
      ),
    ),

    // Hint card section
    hint != null && h('div', {
      'data-testid': 'hint-card',
      class: 'wb-problem-right-panel__hint-card',
    }, hint),

    // AI analysis section
    h('div', {class: 'wb-problem-right-panel__section'},
      aiAnalysisHidden
        ? h('div', {class: 'wb-problem-right-panel__ai-hidden'}, 'AI 答案默认隐藏')
        : h('div', {class: 'wb-problem-right-panel__ai-visible'}, 'AI 分析可见'),
    ),

    // Reference line summary section
    h('div', {class: 'wb-problem-right-panel__section'},
      referenceLines.length > 0 && h(ReferenceLineSummary, {
        lines: referenceLines,
        totalCount: totalRefCount,
      }),
    ),
  )
}
