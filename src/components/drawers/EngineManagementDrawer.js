import {h, Component} from 'preact'

import sabaki from '../../modules/sabaki.js'
import {showOpenDialog} from '../../modules/dialog.js'

const setting = {
  set: (key, value) => {
    window.sabaki.setting.set(key, value)
    return setting
  },
}

const defaultAnalysis = {
  visits: '800',
  playouts: '0',
  maxTime: '15',
  candidates: '40',
  temperature: '1',
}

function valueOrDefault(value, fallback) {
  return value == null || value === '' ? fallback : value
}

function getDefaultEngine(engine = {}) {
  return {
    id: engine.id || 'primary-engine',
    enabled: engine.enabled !== false,
    kind: 'katago',
    name: engine.name || 'KataGo',
    path: engine.path || '',
    modelPath: engine.modelPath || '',
    configPath: engine.configPath || '',
    args: engine.args || '',
    commands: engine.commands || '',
    analysis: {
      visits: valueOrDefault(engine.analysis?.visits, defaultAnalysis.visits),
      playouts: valueOrDefault(engine.analysis?.playouts, defaultAnalysis.playouts),
      maxTime: valueOrDefault(engine.analysis?.maxTime, defaultAnalysis.maxTime),
      candidates: valueOrDefault(
        engine.analysis?.candidates,
        defaultAnalysis.candidates,
      ),
      temperature: valueOrDefault(
        engine.analysis?.temperature,
        defaultAnalysis.temperature,
      ),
    },
  }
}

export default class EngineManagementDrawer extends Component {
  constructor(props) {
    super(props)

    this.state = {
      engine: getDefaultEngine(props.engines?.[0]),
    }

    this.handleCloseButtonClick = (evt) => {
      evt.preventDefault()
      sabaki.closeDrawer()
    }

    this.handleChange = (evt) => {
      let element = evt.currentTarget
      let value = element.type === 'checkbox' ? element.checked : element.value

      this.updateEngine({[element.name]: value})
    }

    this.handleAnalysisChange = (evt) => {
      let element = evt.currentTarget

      this.updateEngine({
        analysis: {
          ...this.state.engine.analysis,
          [element.name]: element.value,
        },
      })
    }

    this.handleBrowse = async (key) => {
      let result = await showOpenDialog({
        properties: ['openFile'],
        filters: [{name: 'All Files', extensions: ['*']}],
      })
      if (!result || result.length === 0) return

      this.updateEngine({[key]: result[0]})
    }
  }

  componentWillReceiveProps(nextProps) {
    if (!this.props.show && nextProps.show) {
      this.ensureDefaultEngine(nextProps)
    }
  }

  ensureDefaultEngine(props = this.props) {
    let engine = getDefaultEngine(props.engines?.[0])
    let engines = (props.engines || []).slice()

    engines[0] = engine
    setting.set('engines.list', engines)
    this.setState({engine})
  }

  updateEngine(patch) {
    let engine = getDefaultEngine({...this.state.engine, ...patch})
    let engines = (this.props.engines || []).slice()

    engines[0] = engine
    setting.set('engines.list', engines)
    this.setState({engine})
  }

  renderTextField(name, label, placeholder, value, wide = false) {
    return h(
      'label',
      {class: `engine-modal-field ${wide ? 'engine-modal-field--wide' : ''}`},
      h('span', {}, label),
      h('input', {
        type: 'text',
        name,
        placeholder,
        value,
        onInput: this.handleChange,
      }),
    )
  }

  renderPathField(name, label, placeholder, value) {
    return h(
      'label',
      {class: 'engine-modal-field engine-modal-field--path'},
      h('span', {}, label),
      h(
        'div',
        {class: 'engine-modal-path-control'},
        h('input', {
          type: 'text',
          name,
          placeholder,
          value,
          onInput: this.handleChange,
        }),
        h(
          'button',
          {
            type: 'button',
            class: 'engine-modal-browse',
            onClick: () => this.handleBrowse(name),
          },
          '选择',
        ),
      ),
    )
  }

  renderAnalysisField(name, label, value, step = 1) {
    value = valueOrDefault(value, defaultAnalysis[name])

    return h(
      'label',
      {class: 'engine-analysis-field'},
      h('span', {}, label),
      h('input', {
        type: 'number',
        min: 0,
        step,
        name,
        value,
        onInput: this.handleAnalysisChange,
      }),
    )
  }

  render({show}) {
    if (!show) return null

    let {engine} = this.state

    return h(
      'section',
      {id: 'engine-management', class: 'engine-management-backdrop show'},
      h(
        'form',
        {class: 'engine-management-modal'},
        h(
          'header',
          {class: 'engine-management-modal__header'},
          h('h2', {}, '引擎管理'),
          h(
            'button',
            {
              type: 'button',
              class: 'engine-management-modal__close',
              onClick: this.handleCloseButtonClick,
            },
            '×',
          ),
        ),
        h(
          'section',
          {class: 'engine-modal-card'},
          h(
            'div',
            {class: 'engine-modal-card__title'},
            h('h3', {}, '基础信息'),
            h(
              'label',
              {class: 'engine-enabled'},
              h('input', {
                type: 'checkbox',
                name: 'enabled',
                checked: engine.enabled !== false,
                onChange: this.handleChange,
              }),
              ' 启用引擎',
            ),
          ),
          h(
            'div',
            {class: 'engine-modal-grid'},
            this.renderTextField('name', '引擎名称', 'KataGo', engine.name),
            this.renderPathField('path', '引擎路径', 'katago.exe', engine.path),
            this.renderPathField(
              'modelPath',
              '模型文件',
              'KataGo model file',
              engine.modelPath,
            ),
            this.renderPathField(
              'configPath',
              '配置文件',
              'KataGo config file',
              engine.configPath,
            ),
            this.renderTextField('args', '启动参数', '额外启动参数', engine.args, true),
            this.renderTextField(
              'commands',
              '初始命令',
              '用 ; 分隔',
              engine.commands,
              true,
            ),
          ),
        ),
        h(
          'section',
          {class: 'engine-modal-card'},
          h('h3', {}, 'KataGo 计算量'),
          h(
            'div',
            {class: 'engine-analysis-grid'},
            this.renderAnalysisField('visits', 'visits', engine.analysis.visits),
            this.renderAnalysisField('playouts', 'playouts', engine.analysis.playouts),
            this.renderAnalysisField(
              'maxTime',
              '思考时间(s)',
              engine.analysis.maxTime,
              0.1,
            ),
            this.renderAnalysisField(
              'candidates',
              '候选点数量',
              engine.analysis.candidates,
            ),
            this.renderAnalysisField(
              'temperature',
              '温度',
              engine.analysis.temperature,
              0.1,
            ),
          ),
        ),
      ),
    )
  }
}
