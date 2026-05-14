import {h, Component} from 'preact'
import hubStore from '../modules/hubStore.js'

const SidebarItem = ({id, label, icon, active, onClick}) =>
  h('div', {
    class: `hub-sidebar-item${active ? ' active' : ''}`,
    onClick: () => onClick(id)
  },
    h('img', {
      src: `./node_modules/@primer/octicons/build/svg/${icon}.svg`,
      class: 'icon',
      alt: ''
    }),
    h('span', null, label)
  )

export default class ManagementHubSidebar extends Component {
  constructor(props) {
    super(props)
    this.handleItemClick = (id) => {
      hubStore.setActiveSection(id)
    }
  }

  render({activeSection}) {
    return h('aside', {class: 'hub-sidebar'},
      h('div', {class: 'hub-sidebar-top'},
        h(SidebarItem, {id: 'general', label: '通用', icon: 'settings', active: activeSection === 'general', onClick: this.handleItemClick}),
        h(SidebarItem, {id: 'board', label: '棋盘', icon: 'dashboard', active: activeSection === 'board', onClick: this.handleItemClick}),
        h(SidebarItem, {id: 'engine', label: '引擎', icon: 'circuit-board', active: activeSection === 'engine', onClick: this.handleItemClick}),
        h(SidebarItem, {id: 'foxGames', label: '野狐对局', icon: 'search', active: activeSection === 'foxGames', onClick: this.handleItemClick}),
        h(SidebarItem, {id: 'oneOhOneWeiqi', label: '101围棋', icon: 'sync', active: activeSection === 'oneOhOneWeiqi', onClick: this.handleItemClick}),
        h(SidebarItem, {id: 'history', label: '历史记录', icon: 'history', active: activeSection === 'history', onClick: this.handleItemClick}),
      ),
      h('div', {class: 'hub-sidebar-spacer'}),
      h('div', {class: 'hub-sidebar-bottom'},
        h(SidebarItem, {id: 'advanced', label: '设置', icon: 'gear', active: activeSection === 'advanced', onClick: this.handleItemClick})
      )
    )
  }
}
