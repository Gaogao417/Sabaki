import {h, Component} from 'preact'
import hubStore from '../modules/hubStore.js'
import ManagementHubSidebar from './ManagementHubSidebar.js'

import GeneralSettingsPane from './management/GeneralSettingsPane.js'
import BoardSettingsPane from './management/BoardSettingsPane.js'
import EngineManagementPane from './management/EngineManagementPane.js'
import FoxGamePane from './management/FoxGamePane.js'
import OneOhOneWeiqiSettingsPane from './management/OneOhOneWeiqiSettingsPane.js'
import HistoryPane from './management/HistoryPane.js'
import AdvancedSettingsPane from './management/AdvancedSettingsPane.js'

const panes = {
  general: GeneralSettingsPane,
  board: BoardSettingsPane,
  engine: EngineManagementPane,
  foxGames: FoxGamePane,
  oneOhOneWeiqi: OneOhOneWeiqiSettingsPane,
  history: HistoryPane,
  advanced: AdvancedSettingsPane
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

    const ActivePane = panes[this.state.activeSection] || GeneralSettingsPane

    return h('div', {class: 'hub-container'},
      h('div', {class: 'hub-overlay', onClick: this.handleOverlayClick}),
      h('div', {id: 'management-hub'},
        h(ManagementHubSidebar, {activeSection: this.state.activeSection}),
        h('main', {class: 'hub-content'},
          h(ActivePane)
        )
      )
    )
  }
}
