import {h, Component} from 'preact'
import Bar from './Bar.js'
import i18n from '../../i18n.js'

const t = i18n.context('ProblemBar')

class ProblemBar extends Component {
  render({mode, problemSession, problemSubmitted, problemResult, problemBadMoves, problemAttempt, reviewQueue, reviewCurrentIndex, reviewTotalDue}) {
    if (!problemSession) return null

    let isReview = mode === 'review'
    let moveCount = (problemAttempt?.userLine || []).length
    let badMoveCount = problemBadMoves.length
    let resultLabel = problemResult === 'pass' ? t('Pass') : problemResult === 'soft_pass' ? t('Soft Pass') : t('Fail')
    let resultClass = problemResult === 'pass' ? 'result-pass' : problemResult === 'soft_pass' ? 'result-soft' : 'result-fail'

    return h(
      Bar,
      Object.assign({type: 'problem'}, this.props),
      h('div', {class: 'problem-bar-content'},
        isReview && h('div', {class: 'review-counter'},
          t('Review'), ' ', (reviewCurrentIndex || 0) + 1, '/', reviewTotalDue || 0,
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
            h('strong', {}, t('Goal: ')), problemSession.taskGoal,
          ),
        ),
        h('div', {class: 'problem-stats'},
          h('span', {}, `${t('Moves')}: ${moveCount}`),
          badMoveCount > 0 && h('span', {class: 'bad-move-count'},
            `${t('Bad moves')}: ${badMoveCount}`,
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
          }, t('Undo')),
          !problemSubmitted && h('button', {
            class: 'problem-submit-btn',
            onClick: () => sabaki.submitProblemAttempt(),
          }, t('Submit')),
          problemSubmitted && !isReview && h('button', {
            class: 'problem-exit-btn',
            onClick: () => sabaki.exitProblemMode(),
          }, t('Exit')),
          problemSubmitted && isReview && h('button', {
            class: 'problem-next-btn',
            onClick: () => sabaki.advanceReview(),
          }, t('Next')),
          !problemSubmitted && h('button', {
            class: 'problem-exit-btn',
            onClick: () => sabaki.exitProblemMode(),
          }, t('Exit')),
        ),
      ),
    )
  }
}

export default ProblemBar
