import {Component} from 'preact'
import {ipcRenderer} from 'electron'
import * as dialog from '../modules/dialog.js'
import * as menu from '../menu.js'

export default class MainMenu extends Component {
  constructor(props) {
    super(props)

    this.menuData = []
    this.listeners = {}
    this._unsubscribeFocus = null

    this.buildMenu = () => {
      ipcRenderer.send('build-menu', this.props)
    }

    this.syncMenuListeners = () => {
      let nextMenuData = menu.get(this.props)
      let nextListeners = {}

      let registerMenuClicks = (items) => {
        for (let item of items) {
          if (item.click != null) {
            let listener = this.listeners[item.id]

            if (listener == null) {
              listener = () => {
                if (!this.props.showMenuBar) {
                  window.sabaki.window.setMenuBarVisibility(false)
                }

                dialog.closeInputBox()
                item.click()
              }

              ipcRenderer.on(`menu-click-${item.id}`, listener)
            }

            nextListeners[item.id] = listener
          }

          if (item.submenu != null) {
            registerMenuClicks(item.submenu)
          }
        }
      }

      registerMenuClicks(nextMenuData)

      for (let id in this.listeners) {
        if (nextListeners[id] != null) continue
        ipcRenderer.removeListener(`menu-click-${id}`, this.listeners[id])
      }

      this.menuData = nextMenuData
      this.listeners = nextListeners
    }
  }

  componentDidMount() {
    this._unsubscribeFocus = window.sabaki.window.on('focus', this.buildMenu)
    this.syncMenuListeners()
  }

  componentWillUnmount() {
    if (this._unsubscribeFocus) this._unsubscribeFocus()

    for (let id in this.listeners) {
      ipcRenderer.removeListener(`menu-click-${id}`, this.listeners[id])
    }
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
    this.syncMenuListeners()
    this.buildMenu()
    return null
  }
}
