import {h, Component} from 'preact'
import hubStore from '../modules/hubStore.js'
import ManagementHubSidebar from './ManagementHubSidebar.js'

import FoxGamePane from './management/FoxGamePane.js'
import OneOhOneWeiqiSettingsPane from './management/OneOhOneWeiqiSettingsPane.js'

const panes = {
  foxGames: FoxGamePane,
  oneOhOneWeiqi: OneOhOneWeiqiSettingsPane,
}

export default class ManagementHub extends Component {
  constructor(props) {
    super(props)
    this.state = hubStore.getState()

    this.handleStoreChange = () => {
      this.setState(hubStore.getState())
    }

    this.handleOverlayClick = () => {
      hubStore.close()
    }
  }

  componentDidMount() {
    hubStore.on('change', this.handleStoreChange)
  }

  componentWillUnmount() {
    hubStore.removeListener('change', this.handleStoreChange)
  }

  render() {
    if (!this.state.isOpen) return null

    const ActivePane = panes[this.state.activeSection] || FoxGamePane

    return h(
      'div',
      {class: 'hub-container'},
      h('div', {class: 'hub-overlay', onClick: this.handleOverlayClick}),
      h(
        'div',
        {id: 'management-hub'},
        h(ManagementHubSidebar, {activeSection: this.state.activeSection}),
        h('main', {class: 'hub-content'}, h(ActivePane)),
      ),
    )
  }
}
