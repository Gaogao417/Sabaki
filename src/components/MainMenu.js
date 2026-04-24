import {Component} from 'preact'
import {ipcRenderer} from 'electron'
import * as dialog from '../modules/dialog.js'
import * as menu from '../menu.js'

export default class MainMenu extends Component {
  constructor(props) {
    super(props)

    this.menuData = []
    this.handlers = {}
    this._unsubscribeFocus = null
    this.handleMenuClick = (_evt, itemId) => {
      let handler = this.handlers[itemId]
      if (handler == null) return

      if (!this.props.showMenuBar) {
        window.sabaki.window.setMenuBarVisibility(false)
      }

      dialog.closeInputBox()
      handler()
    }

    this.buildMenu = () => {
      ipcRenderer.send('build-menu', this.props)
    }

    this.syncMenuListeners = () => {
      let nextMenuData = menu.get(this.props)
      let nextHandlers = {}

      let registerMenuClicks = (items) => {
        for (let item of items) {
          if (item.click != null) {
            nextHandlers[item.id] = item.click
          }

          if (item.submenu != null) {
            registerMenuClicks(item.submenu)
          }
        }
      }

      registerMenuClicks(nextMenuData)

      this.menuData = nextMenuData
      this.handlers = nextHandlers
    }
  }

  componentDidMount() {
    this._unsubscribeFocus = window.sabaki.window.on('focus', this.buildMenu)
    ipcRenderer.on('menu-click', this.handleMenuClick)
    this.syncMenuListeners()
  }

  componentWillUnmount() {
    if (this._unsubscribeFocus) this._unsubscribeFocus()
    ipcRenderer.removeListener('menu-click', this.handleMenuClick)
  }

  shouldComponentUpdate(nextProps) {
    for (let key in nextProps) {
      if (nextProps[key] !== this.props[key]) return true
    }

    return false
  }

  componentDidUpdate() {
    this.syncMenuListeners()
  }

  render() {
    this.buildMenu()
    return null
  }
}
