import {h} from 'preact'
import {useRef, useState} from 'preact/hooks'
import EmptyStatePanel from '../shared/EmptyStatePanel.js'
import MiniBoard from '../shared/MiniBoard.js'

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
  activeCheckpointId = null,
  recallSubstate = 'normal',
  canEditCheckpointComment = false,
  onSaveCheckpointComment = () => {},
}) {
  const [checkpointComment, setCheckpointComment] = useState('')
  const checkpointCommentRef = useRef(null)
  const isCheckpoint = activeCheckpoint || activeCheckpointId ||
    String(recallSubstate).startsWith('checkpoint')
  const isAiRevealed = activeCheckpoint &&
    (recallSubstate === 'checkpoint_ai_revealed' || recallSubstate === 'checkpoint_commenting')
  const isSavingComment = recallSubstate === 'checkpoint_commenting'
  const showCommentEditor = activeCheckpoint && (isAiRevealed || canEditCheckpointComment)
  const formatLine = line => Array.isArray(line) ? line.join(' ') : ''
  const originalLine = activeCheckpoint?.originalLine || []
  const correctionLine = activeCheckpoint?.userCorrectionLine || []
  const aiCandidateLines = activeCheckpoint?.aiCandidateLines || []

  function handleSaveCheckpointComment() {
    const content = (checkpointCommentRef.current?.value || checkpointComment).trim()
    if (!content || isSavingComment) return
    onSaveCheckpointComment({content})
  }

  if (isCheckpoint) {
    return h('div', {
      'data-testid': 'recall-right-panel',
      class: 'wb-recall-right-panel wb-recall-right-panel--checkpoint',
    },
      h('div', {class: 'wb-card wb-checkpoint-card wb-checkpoint-card--bad'},
        h('div', {class: 'wb-panel-title wb-step-title'}, h('span', {}, '1'), '问题手'),
        h('div', {class: 'wb-checkpoint-metrics'},
          h('div', {}, h('span', {}, '原手'), h('strong', {}, '● ', formatLine(originalLine.slice(0, 1)) || 'R10')),
          h('div', {}, h('span', {}, '严重度'), h('strong', {class: 'danger'}, activeCheckpoint?.severity || 'severe')),
          h('div', {}, h('span', {}, '目差变化'), h('strong', {class: 'danger'}, '-11.2 目 ↓')),
        ),
        h('p', {class: 'wb-checkpoint-warning'}, '△ 此手导致局面急剧恶化，请先思考更好的修正方案。'),
      ),

      h('div', {class: 'wb-card wb-checkpoint-card'},
        h('div', {class: 'wb-panel-title wb-step-title wb-step-title--blue'}, h('span', {}, '2'), '修正图草稿',
          h('button', {class: 'wb-link-button'}, '↶ 重置草稿'),
        ),
        h('div', {class: 'wb-checkpoint-draft-meta'}, '已摆 ', correctionLine.length || 3, ' 手'),
        h('p', {class: 'wb-checkpoint-instruction'}, '请在棋盘上摆出你认为更好的修正走法。'),
        h(MiniBoard, {
          labels: [
            {text: '1', x: 4, y: 4, tone: 'white'},
            {text: '2', x: 6, y: 3, tone: 'black'},
            {text: '3', x: 5, y: 5, tone: 'white'},
          ],
          marker: [5, 4],
        }),
      ),

      h('div', {class: 'wb-card wb-checkpoint-card wb-checkpoint-ai-card'},
        h('div', {class: 'wb-checkpoint-row'},
          h('div', {class: 'wb-panel-title wb-step-title'}, h('span', {}, '3'), isAiRevealed ? 'AI 候选（已显示）' : 'AI 候选（隐藏）'),
          !isAiRevealed && h('button', {class: 'wb-btn wb-btn-secondary'}, '显示 AI 候选'),
        ),
        isAiRevealed && h('div', {class: 'wb-checkpoint-comparison'},
          h('div', {class: 'wb-checkpoint-line-grid'},
            h('div', {class: 'wb-checkpoint-line'},
              h('span', {}, '原线'),
              h('strong', {}, formatLine(originalLine)),
            ),
            h('div', {class: 'wb-checkpoint-line'},
              h('span', {}, '用户修正'),
              h('strong', {}, formatLine(correctionLine)),
            ),
            h('div', {class: 'wb-checkpoint-line wb-checkpoint-line--stack'},
              h('span', {}, 'AI candidates'),
              h('div', {},
                aiCandidateLines.map((line, index) =>
                  h('strong', {key: `${line.label || index}`},
                    line.label || `AI ${index + 1}`, ' ', formatLine(line.moves),
                  )
                ),
              ),
            ),
          ),
        ),
      ),

      h('div', {class: 'wb-card wb-checkpoint-card'},
        h('div', {class: 'wb-panel-title wb-step-title wb-step-title--orange'}, h('span', {}, '4'), '反思记录（可选）'),
        showCommentEditor
          ? h('div', {class: 'wb-checkpoint-comment-editor'},
              h('textarea', {
                'data-testid': 'checkpoint-comment-input',
                class: 'wb-checkpoint-comment-editor__input',
                ref: checkpointCommentRef,
                value: checkpointComment,
                disabled: isSavingComment,
                rows: 3,
                placeholder: '原手为什么不好？你的修正思路是什么？与 AI 的差异？',
                onInput: evt => setCheckpointComment(evt.target.value),
              }),
              h('button', {
                'data-testid': 'save-checkpoint-comment-btn',
                class: 'wb-btn wb-btn-secondary',
                disabled: isSavingComment,
                onClick: handleSaveCheckpointComment,
              }, isSavingComment ? '保存中' : '保存备注'),
            )
          : ['原手为什么不好？', '你的修正思路是什么？', '与 AI 的差异？'].map(label =>
              h('input', {key: label, class: 'wb-checkpoint-input', placeholder: label}),
            ),
      ),
    )
  }

  return h('div', {
    'data-testid': 'recall-right-panel',
    class: 'wb-recall-right-panel',
  },
    h('div', {class: 'wb-card wb-recall-progress-card'},
      h('div', {class: 'wb-panel-title'}, '回忆进度'),
      h('div', {class: 'wb-recall-progress-card__count'}, '第 ', correctCount + wrongCount || 23, ' / ', totalMoves || 180, ' 手',
        h('span', {}, Math.max(progress || 13, 13), '%'),
      ),
      h('div', {class: 'wb-progress-line'}, h('span', {style: `width:${Math.max(progress || 13, 13)}%`})),
      h('div', {class: 'wb-recall-progress-card__stats'},
        h('div', {}, h('span', {}, '已正确'), h('strong', {}, correctCount || 22)),
        h('div', {}, h('span', {}, '错误'), h('strong', {class: 'danger'}, wrongCount || 1)),
        h('div', {}, h('span', {}, '跳过'), h('strong', {}, '0')),
      ),
    ),

    h('div', {class: 'wb-card wb-recall-status-card'},
      h('div', {class: 'wb-panel-title'}, '当前状态'),
      h('div', {class: 'wb-recall-current-side'}, h('span', {class: 'wb-stone-indicator wb-stone-indicator--black wb-stone-indicator--inline'}), '黑方落子'),
      h('div', {class: 'wb-recall-status-card__row'},
        h('span', {}, '当前手数'),
        h('strong', {}, '第 ', correctCount + wrongCount || 23, ' 手（黑方）'),
      ),
    ),

    h('div', {class: 'wb-card wb-recall-error-card'},
      h('div', {class: 'wb-panel-title'}, '错误记录', h('span', {}, wrongCount || 1)),
      h('div', {class: 'wb-error-table'},
        h('div', {}, h('span', {}, '手数'), h('span', {}, '落子方'), h('span', {}, '结果')),
        h('button', {},
          h('span', {}, '第 18 手'),
          h('span', {}, '○ 白方'),
          h('span', {class: 'danger'}, '错误'),
          h('span', {}, '›'),
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

    h('div', {class: 'wb-card wb-card--compat'},
      h('div', {class: 'wb-panel-title'}, '回忆提示'),
      h('div', {class: 'wb-recall-right-panel__hint'}, hintMessage),
    ),
    h('div', {class: 'wb-card wb-card--compat'},
      h('div', {class: 'wb-panel-title'}, 'Checkpoint'),
      h('div', {class: 'wb-recall-right-panel__checkpoint-summary'}, systemCheckpoints, manualCheckpoints),
    ),
    h('div', {class: 'wb-card wb-card--compat'},
      h('div', {class: 'wb-panel-title'}, '结果反馈'),
      h('div', {class: 'wb-recall-right-panel__feedback'}, progress, '%'),
    ),
    h('div', {class: 'wb-card wb-card--compat'},
      h('div', {class: 'wb-panel-title'}, '变化树'),
      h(EmptyStatePanel, {
        icon: 'tree',
        title: '变化树',
        description: '复棋过程中将显示变化',
      }),
    ),
  )
}
