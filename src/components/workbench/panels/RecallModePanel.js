import {h} from 'preact'
import ModeToggle from '../shared/ModeToggle.js'
import ProgressRing from '../shared/ProgressRing.js'
import RecallCheckpointPanel from './RecallCheckpointPanel.js'
import EmptyStatePanel from '../shared/EmptyStatePanel.js'

/**
 * RecallModePanel renders the left panel for Recall mode.
 *
 * @param {Object} props
 * @param {boolean} props.recallOriginalLine - Whether in original line recall mode
 * @param {Function} props.onRecallToggle - Called when toggle changes
 * @param {number} props.progress - Progress percentage 0-100
 * @param {number} props.currentMove - Current move number
 * @param {number} props.totalMoves - Total moves to recall
 * @param {number} props.correctCount - Number of correct moves
 * @param {number} props.wrongCount - Number of wrong moves
 * @param {string} props.status - Current status text
 * @param {Function} props.onMarkCheckpoint - Called when user marks a checkpoint
 * @param {Function} props.onVerify - Called when user verifies
 * @param {Function} props.onSkip - Called when user skips
 * @param {Function} props.onHint - Called when user requests hint
 * @param {Function} props.onEndRecall - Called when user ends recall
 * @param {Array} props.checkpoints - List of checkpoint objects
 * @param {string|null} props.activeCheckpointId - Currently active checkpoint ID
 * @param {Function} props.onSubmitCorrection - Called when user submits correction
 * @param {Function} props.onRevealAI - Called when user reveals AI
 * @param {Function} props.onSkipCheckpoint - Called when user skips checkpoint
 * @param {'empty'|'active'|'success'|'error'|'loading'|'disabled'} [props.state='active'] - Panel state overlay
 */
export default function RecallModePanel({
  recallOriginalLine = true,
  onRecallToggle = () => {},
  progress = 0,
  currentMove = 0,
  totalMoves = 0,
  correctCount = 0,
  wrongCount = 0,
  status = '',
  onMarkCheckpoint = () => {},
  onVerify = () => {},
  onSkip = () => {},
  onHint = () => {},
  onEndRecall = () => {},
  checkpoints = [],
  activeCheckpointId = null,
  onSubmitCorrection = () => {},
  onRevealAI = () => {},
  onSkipCheckpoint = () => {},
  state = 'active',
}) {
  function renderContent() {
    if (state === 'loading') {
      return h('div', {class: 'wb-state-loading'},
        h('div', {'data-testid': 'loading-indicator', class: 'wb-state-loading__spinner'}),
      )
    }

    if (state === 'disabled') {
      return h('div', {class: 'wb-state-disabled'},
        h('div', {'data-testid': 'disabled-overlay', class: 'wb-state-disabled__overlay'}, 'Disabled'),
      )
    }

    if (state === 'error') {
      return h('div', {class: 'wb-state-error'},
        h('div', {class: 'wb-state-error__icon'}, '!'),
        h('div', {class: 'wb-state-error__message'}, 'Something went wrong'),
        h('div', {class: 'wb-state-error__retry'},
          h('button', {'data-testid': 'error-overlay', class: 'wb-btn wb-btn-secondary wb-btn--sm'}, 'Retry'),
        ),
      )
    }

    if (state === 'success') {
      return h('div', {class: 'wb-state-success'},
        h('div', {'data-testid': 'success-indicator', class: 'wb-state-success__icon'}, '✓'),
        h('div', {class: 'wb-state-success__message'}, 'Complete'),
      )
    }

    if (state === 'empty') {
      return h(EmptyStatePanel, {
        icon: '◇',
        title: 'No Recall Session',
        description: 'Start a recall session to practice.',
      })
    }

    return [
      h('div', {class: 'wb-recall-mode-panel__toggle'},
        h(ModeToggle, {checked: recallOriginalLine, onChange: onRecallToggle}),
      ),
      recallOriginalLine
        ? h('div', {class: 'wb-recall-mode-panel__progress-view'},
            h(ProgressRing, {progress}),
            h('div', {class: 'wb-recall-mode-panel__stats'},
              h('span', null, currentMove),
              ' / ',
              h('span', null, totalMoves),
            ),
            h('div', {class: 'wb-recall-mode-panel__actions'},
              h('button', {
                'data-testid': 'mark-checkpoint-btn',
                class: 'wb-recall-mode-panel__btn',
                onClick: onMarkCheckpoint,
              }, 'Mark Checkpoint'),
              h('button', {
                'data-testid': 'verify-btn',
                class: 'wb-recall-mode-panel__btn',
                onClick: onVerify,
              }, 'Verify'),
            ),
          )
        : h('div', {class: 'wb-recall-mode-panel__checkpoint-view'},
            checkpoints.map(cp =>
              h(RecallCheckpointPanel, {
                key: cp.id,
                checkpoint: cp,
                isActive: cp.id === activeCheckpointId,
                onSelect: () => {},
              })
            ),
            h('div', {class: 'wb-recall-mode-panel__actions'},
              h('button', {
                'data-testid': 'submit-correction-btn',
                class: 'wb-recall-mode-panel__btn',
                onClick: onSubmitCorrection,
              }, 'Submit Correction'),
            ),
          ),
    ]
  }

  return h('div', {'data-testid': 'recall-mode-panel', class: 'wb-recall-mode-panel'},
    renderContent(),
  )
}
