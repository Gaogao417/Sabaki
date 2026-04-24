import {h, Component} from 'preact'
import classNames from 'classnames'

import i18n from '../../i18n.js'
import sabaki from '../../modules/sabaki.js'
import {noop} from '../../modules/helper.js'
import Bar from './Bar.js'

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
    return (
      nextProps.mode !== this.props.mode ||
      nextProps.mode === 'edit'
    )
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

  render({selectedTool, editWorkspace}, {stoneTool}) {
    let isSelected = ([, id]) =>
      id.replace(/_-?1$/, '') === selectedTool.replace(/_-?1$/, '')

    let ws = editWorkspace
    let hasWorkspace = ws != null
    let hasReference = hasWorkspace && ws.referenceSnapshot != null

    return h(
      Bar,
      Object.assign({type: 'edit'}, this.props),
      h(
        'ul',
        {},
        [
          [t('Stone Tool'), `stone_${stoneTool}`],
          [t('Cross Tool'), 'cross'],
          [t('Triangle Tool'), 'triangle'],
          [t('Square Tool'), 'square'],
          [t('Circle Tool'), 'circle'],
          [t('Line Tool'), 'line'],
          [t('Arrow Tool'), 'arrow'],
          [t('Label Tool'), 'label'],
          [t('Number Tool'), 'number'],
        ].map((x) => this.renderButton(...x, isSelected(x))),
      ),
      hasWorkspace && h(
        'ul',
        {},
        h('li', {},
          h('a', {
            href: '#',
            title: t('Capture Reference'),
            class: classNames({accent: hasReference}),
            onClick: (evt) => {
              evt.preventDefault()
              sabaki.captureEditReference()
            },
          }, t('Snapshot')),
        ),
        h('li', {},
          h('a', {
            href: '#',
            title: t('Working Board'),
            class: classNames({selected: ws.activeTab === 'working'}),
            onClick: (evt) => {
              evt.preventDefault()
              sabaki.toggleEditTab('working')
            },
          }, t('Work')),
        ),
        h('li', {},
          h('a', {
            href: '#',
            title: hasReference ? t('Reference Board') : t('No reference captured'),
            class: classNames({selected: ws.activeTab === 'reference'}),
            style: hasReference ? null : {opacity: 0.4},
            onClick: (evt) => {
              evt.preventDefault()
              if (hasReference) sabaki.toggleEditTab('reference')
            },
          }, t('Ref')),
        ),
        ws.analysisPending && h('li', {},
          h('span', {class: 'edit-analysis-pending'}, '⏳'),
        ),
      ),
    )
  }
}

export default EditBar
