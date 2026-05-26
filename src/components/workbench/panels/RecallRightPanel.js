import {h} from 'preact'
import EmptyStatePanel from '../shared/EmptyStatePanel.js'

/**
 * RecallRightPanel renders the right panel content for Recall mode.
 *
 * @param {Object} props
 * @param {string} props.hintMessage - Recall hint text
 * @param {number} props.systemCheckpoints - Number of system checkpoints
 * @param {number} props.manualCheckpoints - Number of manual checkpoints
 * @param {number} props.correctCount - Number of correct moves
 * @param {number} props.wrongCount - Number of wrong moves
 * @param {number} props.progress - Progress percentage 0-100
 * @param {number} props.totalMoves - Total moves to recall
 */
export default function RecallRightPanel({
  hintMessage = '',
  systemCheckpoints = 0,
  manualCheckpoints = 0,
  correctCount = 0,
  wrongCount = 0,
  progress = 0,
  totalMoves = 0,
  activeCheckpoint = null,
  recallSubstate = 'normal',
}) {
  const isAiRevealed = activeCheckpoint &&
    (recallSubstate === 'checkpoint_ai_revealed' || recallSubstate === 'checkpoint_commenting')
  const formatLine = line => Array.isArray(line) ? line.join(' ') : ''

  return h('div', {
    'data-testid': 'recall-right-panel',
    class: 'wb-recall-right-panel',
  },
    // Recall hint card
    h('div', {class: 'wb-card'},
      h('div', {class: 'wb-panel-title'}, '回忆提示'),
      h('div', {class: 'wb-recall-right-panel__hint'}, hintMessage),
    ),

    // Checkpoint summary card
    h('div', {class: 'wb-card'},
      h('div', {class: 'wb-panel-title'}, 'Checkpoint'),
      h('div', {class: 'wb-recall-right-panel__checkpoint-summary'},
        h('div', {class: 'wb-recall-right-panel__stat'},
          h('span', {class: 'wb-recall-right-panel__stat-label'}, '系统检查点'),
          h('span', {class: 'wb-recall-right-panel__stat-value'}, systemCheckpoints),
        ),
        h('div', {class: 'wb-recall-right-panel__stat'},
          h('span', {class: 'wb-recall-right-panel__stat-label'}, '手动检查点'),
          h('span', {class: 'wb-recall-right-panel__stat-value'}, manualCheckpoints),
        ),
      ),
    ),

    isAiRevealed && h('div', {class: 'wb-card'},
      h('div', {class: 'wb-panel-title'}, 'Checkpoint 对比'),
      h('div', {class: 'wb-recall-right-panel__field'},
        h('span', {class: 'wb-recall-right-panel__stat-label'}, '原线'),
        h('span', {class: 'wb-recall-right-panel__stat-value'}, formatLine(activeCheckpoint.originalLine)),
      ),
      h('div', {class: 'wb-recall-right-panel__field'},
        h('span', {class: 'wb-recall-right-panel__stat-label'}, '用户修正'),
        h('span', {class: 'wb-recall-right-panel__stat-value'}, formatLine(activeCheckpoint.userCorrectionLine)),
      ),
      h('div', {class: 'wb-recall-right-panel__field'},
        h('span', {class: 'wb-recall-right-panel__stat-label'}, 'AI candidates'),
        h('div', {class: 'wb-recall-right-panel__stat-value'},
          (activeCheckpoint.aiCandidateLines || []).map((line, index) =>
            h('div', {key: `${line.label || index}`},
              line.label || `AI ${index + 1}`, ' ', formatLine(line.moves),
            )
          ),
        ),
      ),
    ),

    // Result feedback card
    h('div', {class: 'wb-card'},
      h('div', {class: 'wb-panel-title'}, '结果反馈'),
      h('div', {class: 'wb-recall-right-panel__feedback'},
        h('div', {class: 'wb-recall-right-panel__stat'},
          h('span', {class: 'wb-recall-right-panel__stat-label'}, '正确'),
          h('span', {class: 'wb-recall-right-panel__stat-value'}, correctCount),
        ),
        h('div', {class: 'wb-recall-right-panel__stat'},
          h('span', {class: 'wb-recall-right-panel__stat-label'}, '错误'),
          h('span', {class: 'wb-recall-right-panel__stat-value'}, wrongCount),
        ),
        h('div', {class: 'wb-recall-right-panel__stat'},
          h('span', {class: 'wb-recall-right-panel__stat-label'}, '完成度'),
          h('span', {class: 'wb-recall-right-panel__stat-value'}, progress, '%'),
        ),
        h('div', {class: 'wb-recall-right-panel__stat'},
          h('span', {class: 'wb-recall-right-panel__stat-label'}, '总进度'),
          h('span', {class: 'wb-recall-right-panel__stat-value'},
            correctCount + wrongCount, ' / ', totalMoves,
          ),
        ),
      ),
    ),

    // Variation tree card
    h('div', {class: 'wb-card'},
      h('div', {class: 'wb-panel-title'}, '变化树'),
      h(EmptyStatePanel, {
        icon: 'tree',
        title: '变化树',
        description: '复棋过程中将显示变化',
      }),
    ),
  )
}
