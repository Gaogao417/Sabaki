import {h, Component} from 'preact'
import Bar from './Bar.js'
import i18n from '../../i18n.js'

const t = i18n.context('RecallBar')

class RecallBar extends Component {
  render({mode, recallMoveIndex, recallExpectedMoves, recallCompleted, recallUserAttempts, recallShowHint}) {
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
              h('strong', {}, t('Recall Complete!')),
              h('span', {}, ` ${correctCount}/${total} ` + t('correct')),
            )
          : h('div', {class: 'recall-progress'},
              h('span', {}, t('Move')),
              h('strong', {}, ` ${current + 1} `),
              h('span', {}, `/ ${total}`),
              lastAttempt && h(
                'span',
                {class: lastAttempt.isCorrect ? 'recall-correct' : 'recall-wrong'},
                lastAttempt.isCorrect ? ' ✓' : ' ✗',
              ),
            ),
        h('div', {class: 'recall-actions'},
          !recallCompleted && h('button', {
            class: 'recall-hint-btn',
            onClick: () => sabaki.showRecallHint(),
            disabled: recallShowHint,
          }, t('Hint')),
          !recallCompleted && h('button', {
            class: 'recall-skip-btn',
            onClick: () => sabaki.skipRecallMove(),
          }, t('Skip')),
          h('button', {
            class: 'recall-end-btn',
            onClick: () => sabaki.endRecallSession(),
          }, recallCompleted ? t('Start Analysis') : t('End Recall')),
        ),
      ),
    )
  }
}

export default RecallBar
