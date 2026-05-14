import {h, Component} from 'preact'
import classNames from 'classnames'

import sabaki from '../modules/sabaki.js'
import FoxGamePane from './management/FoxGamePane.js'
import OneOhOneWeiqiPane from './OneOhOneWeiqiPane.js'

const TABS = [
  {id: 'fox', label: '野狐对局'},
  {id: '101', label: '101 错题'},
]

export default class ThirdPartyPanel extends Component {
  constructor(props) {
    super(props)

    this.state = {
      position: {right: 80, bottom: 68},
      dragging: false,
    }

    this.handleDragStart = (evt) => {
      if (evt.button !== 0) return
      if (evt.target.closest('button, input, select, table, a')) return

      let rect = this.element.getBoundingClientRect()
      this.dragOffset = {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top,
      }
      this.setState({dragging: true})
      window.addEventListener('mousemove', this.handleDragMove)
      window.addEventListener('mouseup', this.handleDragEnd)
    }

    this.handleDragMove = (evt) => {
      if (!this.state.dragging) return

      let width = this.element?.offsetWidth ?? 850
      let height = this.element?.offsetHeight ?? 600
      let left = Math.min(
        Math.max(8, evt.clientX - this.dragOffset.x),
        window.innerWidth - width - 8,
      )
      let top = Math.min(
        Math.max(8, evt.clientY - this.dragOffset.y),
        window.innerHeight - height - 8,
      )

      this.setState({
        position: {
          right: window.innerWidth - left - width,
          bottom: window.innerHeight - top - height,
        },
      })
    }

    this.handleDragEnd = () => {
      this.setState({dragging: false})
      window.removeEventListener('mousemove', this.handleDragMove)
      window.removeEventListener('mouseup', this.handleDragEnd)
    }

    this.handleClose = () => {
      sabaki.toggleThirdPartyPanel()
    }

    this.handleTabClick = (tabId) => {
      sabaki.toggleThirdPartyPanel(tabId)
    }
  }

  componentWillUnmount() {
    window.removeEventListener('mousemove', this.handleDragMove)
    window.removeEventListener('mouseup', this.handleDragEnd)
  }

  render({show, activeTab}, {position, dragging}) {
    if (!show) return null

    return h(
      'section',
      {
        ref: (el) => (this.element = el),
        class: classNames('engine-floating-panel', 'third-party-panel', {dragging}),
        style: {
          right: `${position.right}px`,
          bottom: `${position.bottom}px`,
        },
      },

      // Draggable header with tabs
      h('header', {
        class: 'engine-floating-panel__header',
        onMouseDown: this.handleDragStart,
      },
        h('div', {class: 'third-party-panel__tabs'},
          ...TABS.map((tab) =>
            h('button', {
              key: tab.id,
              class: classNames('third-party-panel__tab', {active: activeTab === tab.id}),
              onClick: () => this.handleTabClick(tab.id),
            }, tab.label),
          ),
        ),
        h('button', {
          type: 'button',
          class: 'engine-floating-panel__close',
          onClick: this.handleClose,
        }, '×'),
      ),

      // Body: render the active pane
      h('div', {class: 'third-party-panel__body'},
        activeTab === 'fox' && h(FoxGamePane),
        activeTab === '101' && h(OneOhOneWeiqiPane),
      ),
    )
  }
}
