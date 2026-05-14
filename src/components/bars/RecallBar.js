import {h, Component} from 'preact'
import Bar from './Bar.js'

class RecallBar extends Component {
  render({
    mode, recallMoveIndex, recallExpectedMoves, recallCompleted,
    recallUserAttempts, recallShowHint,
    onHint, onSkip, onComplete,
  }) {
    let total = recallExpectedMoves.length
    let current = recallMoveIndex
    let lastAttempt = recallUserAttempts.length > 0 ? recallUserAttempts[recallUserAttempts.length - 1] : null
    let correctCount = recallUserAttempts.filter((a) => a.isCorrect).length

    return h(
      Bar,
      Object.assign({type: 'recall'}, this.props),
      h('div', {class: 'recall-status'},
        recallCompleted
          ? h('div', {class: 'recall-complete'},
              h('strong', {}, '回忆完成'),
              h('span', {}, ` ${correctCount}/${total} 正确`),
            )
          : h('div', {class: 'recall-progress'},
              h('span', {}, '第'),
              h('strong', {}, ` ${current + 1} `),
              h('span', {}, `手 / 共 ${total} 手`),
              lastAttempt && h(
                'span',
                {class: lastAttempt.isCorrect ? 'recall-correct' : 'recall-wrong'},
                lastAttempt.isCorrect ? ' ✓' : ' ✗',
              ),
            ),
        h('div', {class: 'recall-actions'},
          !recallCompleted && h('button', {
            class: 'recall-hint-btn',
            onClick: onHint,
            disabled: recallShowHint,
          }, '提示'),
          !recallCompleted && h('button', {
            class: 'recall-skip-btn',
            onClick: onSkip,
          }, '跳过'),
          h('button', {
            class: 'recall-end-btn',
            onClick: onComplete,
          }, recallCompleted ? '进入复盘' : '结束回忆'),
        ),
      ),
    )
  }
}

export default RecallBar
