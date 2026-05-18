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
}) {
  return h('div', {
    'data-testid': 'recall-right-panel',
    class: 'wb-recall-right-panel',
  },
    // Recall hint section
    h('div', {class: 'wb-recall-right-panel__section'},
      h('div', {class: 'wb-recall-right-panel__hint'}, hintMessage),
    ),

    // Checkpoint summary section
    h('div', {class: 'wb-recall-right-panel__section'},
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

    // Result feedback section
    h('div', {class: 'wb-recall-right-panel__section'},
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
          h('span', {class: 'wb-recall-right-panel__stat-label'}, '进度'),
          h('span', {class: 'wb-recall-right-panel__stat-value'}, progress),
        ),
      ),
    ),

    // Variation tree section
    h('div', {class: 'wb-recall-right-panel__section'},
      h(EmptyStatePanel, {
        icon: '🌳',
        title: '变化树',
        description: '复棋过程中将显示变化',
      }),
    ),
  )
}
