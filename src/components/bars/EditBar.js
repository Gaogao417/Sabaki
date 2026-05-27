import {h, Component} from 'preact'
import classNames from 'classnames'

import i18n from '../../i18n.js'
import {noop} from '../../modules/helper.js'

const t = i18n.context('EditBar')
let defaultSabaki = null

function getDefaultSabaki() {
  if (defaultSabaki == null) {
    let mod = require('../../modules/sabaki.js')
    defaultSabaki = mod.default || mod
  }

  return defaultSabaki
}

class EditBar extends Component {
  constructor(props) {
    super(props)

    this.state = {
      stoneTool: 1,
      overlayState:
        props.overlayStore?.getState == null
          ? null
          : {...props.overlayStore.getState()},
    }

    this.handleToolButtonClick = this.handleToolButtonClick.bind(this)
  }

  componentDidMount() {
    this.subscribeOverlayStore(this.props.overlayStore)
  }

  componentWillUnmount() {
    this.unsubscribeOverlayStore?.()
  }

  componentWillReceiveProps({selectedTool}) {
    if (selectedTool === this.props.selectedTool) return

    if (selectedTool.indexOf('stone') === 0) {
      this.setState({stoneTool: +selectedTool.replace('stone_', '')})
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.overlayStore !== this.props.overlayStore) {
      this.subscribeOverlayStore(this.props.overlayStore)
    }
  }

  shouldComponentUpdate(nextProps) {
    return nextProps.mode !== this.props.mode || nextProps.mode === 'analysis'
  }

  subscribeOverlayStore(overlayStore) {
    this.unsubscribeOverlayStore?.()
    this.unsubscribeOverlayStore = null

    if (overlayStore?.subscribe == null) {
      this.setState({overlayState: null})
      return
    }

    this.setState({overlayState: {...overlayStore.getState()}})
    this.unsubscribeOverlayStore = overlayStore.subscribe(() => {
      this.setState({overlayState: {...overlayStore.getState()}})
    })
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
          'aria-label': title,
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
          'aria-label': title,
          'aria-disabled': disabled ? 'true' : null,
          tabIndex: disabled ? -1 : 0,
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
      sabaki,
      editWorkspace,
      overlayStore,
      territoryEnabled,
      territoryCompareEnabled,
      territoryCompareAvailable = true,
      showAISuggestions,
      showHumanPreference,
      areaSelectMode,
      analysisAreaVertices,
    },
    {stoneTool, overlayState},
  ) {
    if (mode !== 'analysis') return null

    territoryEnabled =
      overlayState?.territoryEnabled ?? territoryEnabled ?? false
    territoryCompareEnabled =
      overlayState?.territoryCompareEnabled ?? territoryCompareEnabled ?? false

    let isSelected = ([, id]) =>
      id.replace(/_-?1$/, '') === selectedTool.replace(/_-?1$/, '')
    let getSabaki = () => sabaki || getDefaultSabaki()
    let overlayActions = overlayStore ?? sabaki?.getOverlayStore?.()

    return h(
      'section',
      {
        id: 'edit',
        class: 'review-edit-bar bar current',
      },
      h(
        'div',
        {class: 'edit-tool-group edit-tool-group--annotation'},
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
        {class: 'edit-tool-group edit-tool-group--analysis'},
        h('span', {class: 'edit-tool-group__label'}, '分析工具'),
        h(
          'ul',
          {},
          this.renderActionButton('区域选择', {
            icon: './node_modules/@primer/octicons/build/svg/pencil.svg',
            selected: areaSelectMode,
            onClick: () => getSabaki().toggleAreaSelectMode(),
          }),
          analysisAreaVertices != null &&
            this.renderActionButton('清除区域', {
              icon: './node_modules/@primer/octicons/build/svg/x.svg',
              onClick: () => getSabaki().clearAnalysisArea(),
            }),
          this.renderActionButton(t('Territory'), {
            icon: './node_modules/@primer/octicons/build/svg/eye.svg',
            selected: territoryEnabled,
            onClick: () =>
              (
                overlayActions ?? getSabaki().getOverlayStore()
              ).toggleTerritoryEnabled(),
          }),
          this.renderActionButton(t('Territory Compare'), {
            icon: './node_modules/@primer/octicons/build/svg/git-compare.svg',
            selected: territoryCompareEnabled,
            disabled: !territoryCompareAvailable,
            onClick: () =>
              (
                overlayActions ?? getSabaki().getOverlayStore()
              ).toggleTerritoryCompareEnabled(),
          }),
          this.renderActionButton('AI 推荐点', {
            icon: './node_modules/@primer/octicons/build/svg/eye.svg',
            selected: showAISuggestions,
            onClick: () => getSabaki().toggleShowAISuggestions(),
          }),
          this.renderActionButton('人类偏好点', {
            icon: './node_modules/@primer/octicons/build/svg/person.svg',
            selected: showHumanPreference,
            onClick: () => getSabaki().toggleShowHumanPreference(),
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
