import {h, Component} from 'preact'
import classNames from 'classnames'

import i18n from '../../i18n.js'
import sabaki from '../../modules/sabaki.js'
import {noop, getScore} from '../../modules/helper.js'

import Modal from '../Modal.js'

const t = i18n.context('ScoreDrawer')
const setting = {get: (key) => window.sabaki.setting.get(key)}

class ScoreRow extends Component {
  render({method, score, komi, handicap, sign}) {
    let index = sign > 0 ? 0 : 1

    let total = !score
      ? 0
      : method === 'area'
        ? score.area[index]
        : score.territory[index] + score.captures[index]

    if (sign < 0) total += komi
    if (method === 'area' && sign < 0) total += handicap

    return h(
      'tr',
      {},
      h(
        'th',
        {},
        h('img', {
          src: `./node_modules/@sabaki/shudan/css/stone_${sign}.svg`,
          alt: sign > 0 ? t('Black') : t('White'),
          width: 24,
          height: 24,
        }),
      ),
      h(
        'td',
        {class: classNames({disabled: method === 'territory'})},
        score ? score.area[index] : '-',
      ),
      h(
        'td',
        {class: classNames({disabled: method === 'area'})},
        score ? score.territory[index] : '-',
      ),
      h(
        'td',
        {class: classNames({disabled: method === 'area'})},
        score ? score.captures[index] : '-',
      ),
      h('td', {}, sign < 0 ? komi : '-'),
      h(
        'td',
        {class: classNames({disabled: method === 'territory'})},
        sign < 0 ? handicap : '-',
      ),
      h('td', {}, total),
    )
  }
}

export default class ScoreDrawer extends Component {
  constructor() {
    super()

    this.handleTerritoryButtonClick = () =>
      setting.set('scoring.method', 'territory')
    this.handleAreaButtonClick = () => setting.set('scoring.method', 'area')
    this.handleClose = () => sabaki.closeDrawer()

    this.handleSubmitButtonClick = (evt) => {
      evt.preventDefault()

      let {onSubmitButtonClick = noop} = this.props
      evt.resultString = this.resultString
      onSubmitButtonClick(evt)
    }
  }

  render({show, estimating, method, areaMap, board, komi, handicap}) {
    if (isNaN(komi)) komi = 0
    if (isNaN(handicap)) handicap = 0

    let score = areaMap && board && getScore(board, areaMap, {handicap, komi})
    let result =
      score && (method === 'area' ? score.areaScore : score.territoryScore)

    this.resultString =
      result > 0 ? `B+${result}` : result < 0 ? `W+${-result}` : t('Draw')

    return h(
      Modal,
      {
        show,
        title: t('Score'),
        onClose: this.handleClose,
      },

      h(
        'div',
        {class: 'score-dialog__tabs'},
        h(
          'button',
          {
            type: 'button',
            class: classNames('score-dialog__tab', {active: method === 'area'}),
            onClick: this.handleAreaButtonClick,
          },
          t('Area'),
        ),
        h(
          'button',
          {
            type: 'button',
            class: classNames('score-dialog__tab', {
              active: method === 'territory',
            }),
            onClick: this.handleTerritoryButtonClick,
          },
          t('Territory'),
        ),
      ),

      h(
        'div',
        {class: 'score-dialog__table-wrap'},
        h(
          'table',
          {class: 'score-dialog__table'},
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              h('th'),
              h(
                'th',
                {class: classNames({disabled: method === 'territory'})},
                t('Area'),
              ),
              h(
                'th',
                {class: classNames({disabled: method === 'area'})},
                t('Territory'),
              ),
              h(
                'th',
                {class: classNames({disabled: method === 'area'})},
                t('Captures'),
              ),
              h('th', {}, t('Komi')),
              h(
                'th',
                {class: classNames({disabled: method === 'territory'})},
                t('Handicap'),
              ),
              h('th', {}, t('Total')),
            ),
          ),
          h(
            'tbody',
            {},
            h(ScoreRow, {method, score, komi, handicap: 0, sign: 1}),
            h(ScoreRow, {method, score, komi, handicap, sign: -1}),
          ),
        ),
      ),

      h(
        'footer',
        {class: 'score-dialog__footer'},
        h(
          'span',
          {class: 'score-dialog__result'},
          t('Result:'),
          ' ',
          h('strong', {}, this.resultString),
        ),
        h(
          'div',
          {class: 'score-dialog__actions'},
          !estimating &&
            h(
              'button',
              {
                type: 'button',
                class: 'modal-btn modal-btn--primary',
                onClick: this.handleSubmitButtonClick,
              },
              t('Update Result'),
            ),
          h(
            'button',
            {
              type: 'button',
              class: 'modal-btn modal-btn--secondary',
              onClick: this.handleClose,
            },
            t('Close'),
          ),
        ),
      ),
    )
  }
}
