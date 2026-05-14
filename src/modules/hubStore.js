
import EventEmitter from 'events'

class HubStore extends EventEmitter {
  constructor() {
    super()
    this.state = {
      isOpen: false,
      activeSection: 'general',
      navigationParams: null
    }
  }

  getState() {
    return this.state
  }

  open(section = 'general', params = null) {
    this.state.isOpen = true
    this.state.activeSection = section
    this.state.navigationParams = params
    this.emit('change')
  }

  close() {
    this.state.isOpen = false
    this.emit('change')
  }

  setActiveSection(section, params = null) {
    this.state.activeSection = section
    this.state.navigationParams = params
    this.emit('change')
  }
}

const hubStore = new HubStore()
export default hubStore
