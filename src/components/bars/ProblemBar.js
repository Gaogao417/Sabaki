import {h, Component} from 'preact'
import Bar from './Bar.js'
import sabaki from '../../modules/sabaki.js'

class ProblemBar extends Component {
  render({mode, problemSession, problemSubmitted, problemResult, problemBadMoves, problemAttempt, reviewQueue, reviewCurrentIndex, reviewTotalDue}) {
    if (!problemSession) return null

    let isReview = mode === 'review'
    let moveCount = (problemAttempt?.userLine || []).length
    let badMoveCount = problemBadMoves.length
    let resultLabel =
      problemResult === 'pass'
        ? '通过'
        : problemResult === 'soft_pass'
          ? '勉强通过'
          : '失败'
    let resultClass = problemResult === 'pass' ? 'result-pass' : problemResult === 'soft_pass' ? 'result-soft' : 'result-fail'

    return h(
      Bar,
      Object.assign({type: 'problem'}, this.props),
      h('div', {class: 'problem-bar-content'},
        isReview && h('div', {class: 'review-counter'},
          '复习 ', (reviewCurrentIndex || 0) + 1, '/', reviewTotalDue || 0,
        ),
        h('div', {class: 'problem-header'},
          h('span', {class: 'problem-type'}, problemSession.type?.replace(/_/g, ' ') || ''),
          problemSession.title && h('span', {class: 'problem-title'}, problemSession.title),
          problemSession.sideToMove && h('span', {class: 'problem-side'},
            problemSession.sideToMove === 'black' ? '⚫' : '⚪',
          ),
        ),
        h('div', {class: 'problem-info'},
          problemSession.positionDescription && h('div', {class: 'problem-description'},
            problemSession.positionDescription,
          ),
          problemSession.taskGoal && h('div', {class: 'problem-goal'},
            h('strong', {}, '目标：'), problemSession.taskGoal,
          ),
        ),
        h('div', {class: 'problem-stats'},
          h('span', {}, `已下 ${moveCount} 手`),
          badMoveCount > 0 && h('span', {class: 'bad-move-count'},
            `坏棋 ${badMoveCount}`,
          ),
        ),
        problemSubmitted && h('div', {class: ['problem-result', resultClass].join(' ')},
          resultLabel,
        ),
        h('div', {class: 'problem-actions'},
          !problemSubmitted && h('button', {
            class: 'problem-undo-btn',
            onClick: () => sabaki.undoProblemMove(),
            disabled: moveCount === 0,
          }, '撤销'),
          !problemSubmitted && h('button', {
            class: 'problem-submit-btn',
            onClick: () => sabaki.submitProblemAttempt(),
          }, '提交答案'),
          problemSubmitted && !isReview && h('button', {
            class: 'problem-exit-btn',
            onClick: () => sabaki.exitProblemMode(),
          }, '退出'),
          problemSubmitted && isReview && h('button', {
            class: 'problem-next-btn',
            onClick: () => sabaki.advanceReview(),
          }, '下一题'),
          !problemSubmitted && h('button', {
            class: 'problem-exit-btn',
            onClick: () => sabaki.exitProblemMode(),
          }, '退出'),
        ),
      ),
    )
  }
}

export default ProblemBar
