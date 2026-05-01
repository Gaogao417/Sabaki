import {h, Component} from 'preact'
import classNames from 'classnames'

import i18n from '../../i18n.js'
import sabaki from '../../modules/sabaki.js'
import {noop} from '../../modules/helper.js'

const t = i18n.context('EditBar')

class EditBar extends Component {
  constructor() {
    super()

    this.state = {
      stoneTool: 1,
    }

    this.handleToolButtonClick = this.handleToolButtonClick.bind(this)
  }

  componentWillReceiveProps({selectedTool}) {
    if (selectedTool === this.props.selectedTool) return

    if (selectedTool.indexOf('stone') === 0) {
      this.setState({stoneTool: +selectedTool.replace('stone_', '')})
    }
  }

  shouldComponentUpdate(nextProps) {
    return nextProps.mode !== this.props.mode || nextProps.mode === 'analysis'
  }

  handleToolButtonClick(evt) {
    let {selectedTool, onToolButtonClick = noop} = this.props

    evt.tool = evt.currentTarget.dataset.id

    if (
      evt.tool.indexOf('stone') === 0 &&
      selectedTool.indexOf('stone') === 0
    ) {
      evt.tool = `stone_${-this.state.stoneTool}`
      this.setState(({stoneTool}) => ({stoneTool: -stoneTool}))
    }

    onToolButtonClick(evt)
  }

  renderButton(title, toolId, selected = false) {
    return h(
      'li',
      {class: classNames({selected})},
      h(
        'a',
        {
          title,
          href: '#',
          'data-id': toolId,
          onClick: this.handleToolButtonClick,
        },

        h('img', {src: `./img/edit/${toolId}.svg`}),
      ),
    )
  }

  renderActionButton(
    title,
    {icon, selected = false, disabled = false, onClick},
  ) {
    return h(
      'li',
      {class: classNames({selected, disabled})},
      h(
        'a',
        {
          title,
          href: '#',
          onClick: (evt) => {
            evt.preventDefault()
            if (!disabled) onClick()
          },
        },
        h('img', {src: icon}),
      ),
    )
  }

  render(
    {
      mode,
      selectedTool,
      editWorkspace,
      territoryEnabled,
      territoryCompareEnabled,
      areaSelectMode,
      analysisAreaVertices,
    },
    {stoneTool},
  ) {
    if (mode !== 'analysis') return null

    let isSelected = ([, id]) =>
      id.replace(/_-?1$/, '') === selectedTool.replace(/_-?1$/, '')

    return h(
      'section',
      {
        id: 'edit',
        class: 'review-edit-bar bar current',
      },
      h(
        'div',
        {class: 'edit-tool-group'},
        h('span', {class: 'edit-tool-group__label'}, '标注工具'),
        h(
          'ul',
          {},
          [
            [t('Stone'), `stone_${stoneTool}`],
            [t('Cross'), 'cross'],
            [t('Triangle'), 'triangle'],
            [t('Square'), 'square'],
            [t('Circle'), 'circle'],
            [t('Line'), 'line'],
            [t('Arrow'), 'arrow'],
            [t('Label'), 'label'],
            [t('Number'), 'number'],
          ].map((x) => this.renderButton(...x, isSelected(x))),
        ),
      ),
      h(
        'div',
        {class: 'edit-tool-group'},
        h('span', {class: 'edit-tool-group__label'}, '分析工具'),
        h(
          'ul',
          {},
          this.renderActionButton('区域选择', {
            icon: './node_modules/@primer/octicons/build/svg/pencil.svg',
            selected: areaSelectMode,
            onClick: () => sabaki.toggleAreaSelectMode(),
          }),
          analysisAreaVertices != null &&
            this.renderActionButton('清除区域', {
              icon: './node_modules/@primer/octicons/build/svg/x.svg',
              onClick: () => sabaki.clearAnalysisArea(),
            }),
          this.renderActionButton(t('Territory'), {
            icon: './node_modules/@primer/octicons/build/svg/eye.svg',
            selected: territoryEnabled,
            onClick: () => sabaki.toggleTerritoryEnabled(),
          }),
          this.renderActionButton(t('Territory Compare'), {
            icon: './node_modules/@primer/octicons/build/svg/git-compare.svg',
            selected: territoryCompareEnabled,
            onClick: () => sabaki.toggleTerritoryCompareEnabled(),
          }),
        ),
      ),
      editWorkspace?.analysisPending &&
        h(
          'ul',
          {class: 'edit-workspace-actions'},
          h('li', {}, h('span', {class: 'edit-analysis-pending'}, '...')),
        ),
    )
  }
}

export default EditBar
