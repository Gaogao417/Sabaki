import {h, Component} from 'preact'
import classNames from 'classnames'

import sabaki from '../../modules/sabaki.js'

const setting = {get: (key) => window.sabaki.setting.get(key)}

const ruleOptions = [
  ['chinese', '中国规则'],
  ['japanese', '日本规则'],
  ['korean', '韩国规则'],
  ['aga', 'AGA 规则'],
  ['tromp-taylor', 'Tromp-Taylor'],
]

function normalizeBoardSize(value) {
  let size = (value || '19').toString()
  return ['19', '13', '9'].includes(size) ? size : '19'
}

function enabledEngines(engines = []) {
  engines = engines || []

  return engines
    .map((engine, index) => ({...engine, engineIndex: index}))
    .filter((engine) => engine != null && engine.enabled !== false)
}

export default class NewGameDialog extends Component {
  constructor(props) {
    super(props)

    this.state = this.getInitialState(props)

    this.handleCancel = () => sabaki.closeDrawer()

    this.handleSubmit = (evt) => {
      evt.preventDefault()

      sabaki.startConfiguredGame({
        black: this.getPlayerConfig('black'),
        white: this.getPlayerConfig('white'),
        boardSize: this.state.boardSize,
        komi: +this.state.komi,
        handicap: +this.state.handicap,
        rules: this.state.rules,
      })
    }
  }

  getInitialState({gameInfo} = this.props) {
    return {
      blackType: 'human',
      whiteType: 'human',
      boardSize: normalizeBoardSize(
        gameInfo?.size?.[0] === gameInfo?.size?.[1]
          ? gameInfo.size[0]
          : setting.get('game.default_board_size'),
      ),
      komi: gameInfo?.komi ?? setting.get('game.default_komi'),
      handicap: gameInfo?.handicap ?? setting.get('game.default_handicap'),
      rules: gameInfo?.rules || 'chinese',
    }
  }

  componentWillReceiveProps(nextProps) {
    if (!this.props.show && nextProps.show) {
      this.setState(this.getInitialState(nextProps))
    }
  }

  getPrimaryEngineIndex() {
    return enabledEngines(this.props.engines)[0]?.engineIndex ?? null
  }

  getPlayerConfig(color) {
    let type = this.state[`${color}Type`]
    let engineIndex = this.getPrimaryEngineIndex()

    return type === 'engine' && engineIndex != null
      ? {type, engineIndex}
      : {type: 'human'}
  }

  renderPlayerRow(color, label, stoneClass, engine) {
    let typeKey = `${color}Type`
    let type = this.state[typeKey]
    let noEngine = engine == null

    return h(
      'div',
      {class: 'new-game-dialog__player-row'},
      h('span', {class: classNames('new-game-dialog__stone', stoneClass)}),
      h('strong', {}, label),
      h(
        'div',
        {class: 'new-game-dialog__segmented'},
        h(
          'button',
          {
            type: 'button',
            class: classNames({active: type === 'human'}),
            onClick: () => this.setState({[typeKey]: 'human'}),
          },
          '人类',
        ),
        h(
          'button',
          {
            type: 'button',
            class: classNames({active: type === 'engine'}),
            disabled: noEngine,
            title: noEngine ? '请先在引擎管理中配置并启用引擎' : null,
            onClick: () => this.setState({[typeKey]: 'engine'}),
          },
          'AI',
        ),
      ),
      h(
        'span',
        {class: 'new-game-dialog__engine-name'},
        noEngine ? '未配置引擎' : engine.name || 'AI 引擎',
      ),
    )
  }

  renderSelect(label, value, options, onChange) {
    return h(
      'label',
      {class: 'new-game-dialog__field'},
      h('span', {}, label),
      h(
        'select',
        {value, onChange},
        options.map(([optionValue, text]) =>
          h('option', {value: optionValue}, text),
        ),
      ),
    )
  }

  render({show, engines = []}) {
    if (!show) return null

    let primaryEngine = enabledEngines(engines)[0] ?? null
    let handicapOptions = [['0', '无让子']].concat(
      [...Array(8)].map((_, i) => [(i + 2).toString(), `${i + 2} 子`]),
    )

    return h(
      'section',
      {class: 'new-game-dialog-backdrop'},
      h(
        'form',
        {class: 'new-game-dialog', onSubmit: this.handleSubmit},
        h(
          'header',
          {},
          h('h2', {}, '新对局'),
          h(
            'button',
            {
              type: 'button',
              class: 'new-game-dialog__close',
              onClick: this.handleCancel,
            },
            '×',
          ),
        ),
        h(
          'section',
          {class: 'new-game-dialog__section'},
          h('h3', {}, '对局双方'),
          this.renderPlayerRow('black', '黑方', 'black', primaryEngine),
          this.renderPlayerRow('white', '白方', 'white', primaryEngine),
        ),
        h(
          'section',
          {class: 'new-game-dialog__section'},
          h('h3', {}, '棋盘与规则'),
          this.renderSelect(
            '棋盘大小',
            this.state.boardSize,
            [
              ['19', '19 × 19'],
              ['13', '13 × 13'],
              ['9', '9 × 9'],
            ],
            (evt) => this.setState({boardSize: evt.currentTarget.value}),
          ),
          h(
            'label',
            {class: 'new-game-dialog__field'},
            h('span', {}, '贴目'),
            h('input', {
              type: 'number',
              step: 0.5,
              value: this.state.komi,
              onInput: (evt) => this.setState({komi: evt.currentTarget.value}),
            }),
          ),
          this.renderSelect(
            '让子',
            this.state.handicap.toString(),
            handicapOptions,
            (evt) => this.setState({handicap: evt.currentTarget.value}),
          ),
          this.renderSelect('规则', this.state.rules, ruleOptions, (evt) =>
            this.setState({rules: evt.currentTarget.value}),
          ),
        ),
        h(
          'footer',
          {},
          h(
            'button',
            {type: 'button', class: 'secondary', onClick: this.handleCancel},
            '取消',
          ),
          h('button', {type: 'submit', class: 'primary'}, '开始对局'),
        ),
      ),
    )
  }
}
