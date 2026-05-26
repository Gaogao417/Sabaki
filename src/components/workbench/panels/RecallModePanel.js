import {h} from 'preact'
import {useRef, useState} from 'preact/hooks'
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
 * @param {Function} props.onSaveCheckpointComment - Called when user saves checkpoint comment
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
  activeCheckpoint = null,
  recallSubstate = 'normal',
  canSubmitCorrection = true,
  canRevealAi = false,
  canEditCheckpointComment = false,
  onSubmitCorrection = () => {},
  onRevealAI = () => {},
  onSkipCheckpoint = () => {},
  onSaveCheckpointComment = () => {},
  showCheckpointCommentEditor = true,
  state = 'active',
}) {
  const [checkpointComment, setCheckpointComment] = useState('')
  const checkpointCommentRef = useRef(null)
  const isSavingComment = recallSubstate === 'checkpoint_commenting'
  const currentCheckpoint = activeCheckpoint ||
    checkpoints.find(cp => cp.id === activeCheckpointId) ||
    null
  const showCommentEditor = showCheckpointCommentEditor &&
    (canEditCheckpointComment ||
      recallSubstate === 'checkpoint_ai_revealed' ||
      recallSubstate === 'checkpoint_commenting')

  function handleSaveCheckpointComment() {
    const content = (checkpointCommentRef.current?.value || checkpointComment).trim()
    if (!content || isSavingComment) return
    onSaveCheckpointComment({content})
  }

  function renderOverlay() {
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
        h('div', {class: 'wb-state-error__message'}, '当前回忆状态异常'),
        h('div', {class: 'wb-state-error__retry'},
          h('button', {'data-testid': 'error-overlay', class: 'wb-btn wb-btn-secondary wb-btn--sm'}, '重试'),
        ),
      )
    }

    if (state === 'success') {
      return h('div', {class: 'wb-state-success'},
        h('div', {'data-testid': 'success-indicator', class: 'wb-state-success__icon'}, '✓'),
        h('div', {class: 'wb-state-success__message'}, '回忆完成'),
      )
    }

    if (state === 'empty') {
      return h(EmptyStatePanel, {
        icon: 'diamond',
        title: '暂无回忆任务',
        description: '提交 attempt 后进入回忆。',
      })
    }

    return null
  }

  function renderCards() {
    const cards = []

    // Card 1: Mode toggle (always shown)
    cards.push(
      h('div', {class: 'wb-card', key: 'mode-toggle-card'},
        h('div', {class: 'wb-panel-title'}, '回忆模式'),
        h('div', {class: 'wb-panel-body'},
          h('div', {style: 'margin-bottom: 4px'}, '回忆模式'),
          h('div', {style: 'font-size: 12px; color: var(--ui-text-tertiary)'}, '先复现原线'),
          h('div', {class: 'wb-recall-mode-panel__toggle-row', style: 'margin-top: 8px'},
            h('span', {}, '先复现原线'),
            h(ModeToggle, {checked: recallOriginalLine, onChange: onRecallToggle}),
          ),
        ),
      )
    )

    // Card 2: Progress view (when recallOriginalLine=true) or Checkpoint queue (when false)
    if (recallOriginalLine) {
      cards.push(
        h('div', {class: 'wb-card', key: 'progress-card'},
          h('div', {class: 'wb-panel-title'}, '复现进度'),
          h('div', {class: 'wb-panel-body'},
            h('div', {class: 'wb-recall-mode-panel__progress-ring'},
              h(ProgressRing, {progress}),
            ),
            h('div', {class: 'wb-recall-mode-panel__stats'},
              h('div', {class: 'wb-recall-mode-panel__stat-item'},
                h('span', {class: 'wb-recall-mode-panel__stat-label'}, '进度'),
                h('span', {class: 'wb-recall-mode-panel__stat-value'}, currentMove, ' / ', totalMoves),
              ),
              h('div', {class: 'wb-recall-mode-panel__stat-item'},
                h('span', {class: 'wb-recall-mode-panel__stat-label'}, '正确'),
                h('span', {class: 'wb-recall-mode-panel__stat-value'}, correctCount, ' 手'),
              ),
              h('div', {class: 'wb-recall-mode-panel__stat-item'},
                h('span', {class: 'wb-recall-mode-panel__stat-label'}, '状态'),
                h('span', {class: 'wb-recall-mode-panel__stat-value'}, status || '进行中'),
              ),
            ),
            h('div', {class: 'wb-recall-mode-panel__actions'},
              h('button', {
                'data-testid': 'mark-checkpoint-btn',
                class: 'wb-btn wb-btn-secondary wb-btn--sm',
                onClick: onMarkCheckpoint,
              }, '标记 checkpoint'),
              h('button', {
                'data-testid': 'verify-btn',
                class: 'wb-btn wb-btn-secondary wb-btn--sm',
                onClick: onVerify,
              }, '校对'),
              h('button', {
                class: 'wb-btn wb-btn-ghost wb-btn--sm',
                onClick: onHint,
              }, '提示'),
              h('button', {
                class: 'wb-btn wb-btn-ghost wb-btn--sm',
                onClick: onEndRecall,
              }, '结束回忆'),
            ),
          ),
        )
      )
    } else {
      const checkpointList = currentCheckpoint
        ? [currentCheckpoint, ...checkpoints.filter(cp => cp.id !== currentCheckpoint.id)]
        : checkpoints

      cards.push(
        h('div', {class: 'wb-card', key: 'checkpoint-card'},
          h('div', {class: 'wb-panel-title'}, '检查点队列'),
          h('div', {class: 'wb-panel-body'},
            h('div', {class: 'wb-recall-mode-panel__checkpoint-list'},
              checkpointList.length > 0
                ? checkpointList.map(cp =>
                    h(RecallCheckpointPanel, {
                      key: cp.id,
                      checkpoint: cp,
                      isActive: cp.id === activeCheckpointId,
                      onSelect: () => {},
                    })
                  )
                : h('div', {class: 'wb-panel-caption'}, '暂无检查点'),
            ),
            h('div', {class: 'wb-recall-mode-panel__actions'},
              h('button', {
                'data-testid': 'submit-correction-btn',
                class: 'wb-btn wb-btn-secondary wb-btn--sm',
                disabled: !canSubmitCorrection || isSavingComment,
                onClick: onSubmitCorrection,
              }, '提交修正图'),
              h('button', {
                'data-testid': 'reveal-ai-btn',
                class: 'wb-btn wb-btn-ghost wb-btn--sm',
                disabled: !canRevealAi || isSavingComment,
                onClick: onRevealAI,
              }, '查看 AI'),
              h('button', {
                class: 'wb-btn wb-btn-ghost wb-btn--sm',
                disabled: isSavingComment,
                onClick: onSkipCheckpoint,
              }, '跳过 checkpoint'),
            ),
            showCommentEditor && h('div', {class: 'wb-recall-mode-panel__comment'},
              h('textarea', {
                'data-testid': 'checkpoint-comment-input',
                class: 'wb-recall-mode-panel__comment-input',
                ref: checkpointCommentRef,
                value: checkpointComment,
                disabled: isSavingComment,
                rows: 4,
                onInput: evt => setCheckpointComment(evt.target.value),
              }),
              h('div', {class: 'wb-recall-mode-panel__actions'},
                h('button', {
                  'data-testid': 'save-checkpoint-comment-btn',
                  class: 'wb-btn wb-btn-secondary wb-btn--sm',
                  disabled: isSavingComment,
                  onClick: handleSaveCheckpointComment,
                }, isSavingComment ? '保存中' : '保存备注'),
              ),
            ),
          ),
        )
      )
    }

    return cards
  }

  return h('div', {'data-testid': 'recall-mode-panel', class: 'wb-recall-mode-panel'},
    state !== 'active' ? renderOverlay() : renderCards(),
  )
}
