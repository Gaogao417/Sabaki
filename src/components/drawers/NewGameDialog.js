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

const boardSizeOptions = [
  ['19', '19路'],
  ['13', '13路'],
  ['9', '9路'],
]

const komiOptions = [
  ['7.5', '7.5'],
  ['6.5', '6.5'],
  ['0.5', '0.5'],
  ['0', '0'],
]

const timeMethodOptions = [
  ['byoyomi', '读秒'],
  ['none', '无计时'],
]

const mainTimeOptions = [
  ['30', '30分钟'],
  ['20', '20分钟'],
  ['10', '10分钟'],
  ['5', '5分钟'],
]

const byoYomiOptions = [
  ['3x30', '3 × 30秒'],
  ['3x20', '3 × 20秒'],
  ['5x30', '5 × 30秒'],
  ['1x60', '1 × 60秒'],
]

const playerOptions = [
  ['self', '自己'],
  ['ai', 'AI'],
  ['local', '本地玩家'],
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
        handicap: 0,
        rules: this.state.rules,
        timeControl: {
          method: this.state.timeMethod,
          mainTimeMinutes: +this.state.mainTime,
          byoYomi: this.state.byoYomi,
        },
        allowUndo: this.state.allowUndo,
        autoSave: this.state.autoSave,
      })
    }
  }

  getInitialState({gameInfo} = this.props) {
    return {
      blackType: 'self',
      whiteType: 'self',
      boardSize: normalizeBoardSize(
        gameInfo?.size?.[0] === gameInfo?.size?.[1]
          ? gameInfo.size[0]
          : setting.get('game.default_board_size'),
      ),
      komi: '7.5',
      rules: gameInfo?.rules || 'chinese',
      timeMethod: 'byoyomi',
      mainTime: '30',
      byoYomi: '3x30',
      allowUndo: true,
      autoSave: true,
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

    return type === 'ai' && engineIndex != null
      ? {type: 'engine', engineIndex}
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
        playerOptions.map(([value, text]) =>
          h(
            'button',
            {
              type: 'button',
              class: classNames({active: type === value}),
              disabled: value === 'ai' && noEngine,
              title:
                value === 'ai' && noEngine
                  ? '请先在引擎管理中配置并启用引擎'
                  : null,
              onClick: () => this.setState({[typeKey]: value}),
            },
            text,
          ),
        ),
      ),
    )
  }

  renderSelectRow(label, value, options, onChange) {
    return h(
      'label',
      {class: 'new-game-dialog__form-row'},
      h('span', {}, label),
      h(
        'span',
        {class: 'new-game-dialog__select-wrap'},
        h(
          'select',
          {value, onChange},
          options.map(([optionValue, text]) =>
            h('option', {value: optionValue}, text),
          ),
        ),
      ),
    )
  }

  renderToggleRow(label, stateKey) {
    let enabled = this.state[stateKey]

    return h(
      'div',
      {class: 'new-game-dialog__toggle-row'},
      h('span', {}, label),
      h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': enabled ? 'true' : 'false',
          class: classNames('new-game-dialog__toggle', {active: enabled}),
          onClick: () => this.setState({[stateKey]: !enabled}),
        },
        h('span', {}),
      ),
    )
  }

  render({show, engines = []}) {
    if (!show) return null

    let primaryEngine = enabledEngines(engines)[0] ?? null

    return h(
      'section',
      {class: 'new-game-dialog-backdrop'},
      h(
        'form',
        {class: 'new-game-dialog', onSubmit: this.handleSubmit},
        h(
          'header',
          {},
          h('h2', {}, '新对局设置'),
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
          h('h3', {}, '规则设置'),
          this.renderSelectRow(
            '棋盘大小',
            this.state.boardSize,
            boardSizeOptions,
            (evt) => this.setState({boardSize: evt.currentTarget.value}),
          ),
          this.renderSelectRow('规则', this.state.rules, ruleOptions, (evt) =>
            this.setState({rules: evt.currentTarget.value}),
          ),
          this.renderSelectRow('贴目', this.state.komi, komiOptions, (evt) =>
            this.setState({komi: evt.currentTarget.value}),
          ),
        ),
        h(
          'section',
          {class: 'new-game-dialog__section'},
          h('h3', {}, '用时规则'),
          this.renderSelectRow(
            '计时方式',
            this.state.timeMethod,
            timeMethodOptions,
            (evt) => this.setState({timeMethod: evt.currentTarget.value}),
          ),
          this.renderSelectRow(
            '基本时间',
            this.state.mainTime,
            mainTimeOptions,
            (evt) => this.setState({mainTime: evt.currentTarget.value}),
          ),
          this.renderSelectRow(
            '读秒',
            this.state.byoYomi,
            byoYomiOptions,
            (evt) => this.setState({byoYomi: evt.currentTarget.value}),
          ),
        ),
        h(
          'section',
          {class: 'new-game-dialog__section'},
          h('h3', {}, '高级选项'),
          this.renderToggleRow('允许悔棋', 'allowUndo'),
          this.renderToggleRow('自动保存棋谱', 'autoSave'),
        ),
        h(
          'footer',
          {},
          h(
            'button',
            {type: 'button', class: 'secondary', onClick: this.handleCancel},
            '取消',
          ),
          h(
            'button',
            {type: 'submit', class: 'primary'},
            h('span', {class: 'new-game-dialog__start-icon'}, '＋'),
            '开始对局',
          ),
        ),
      ),
    )
  }
}
