import {h, Component} from 'preact'
import hubStore from '../modules/hubStore.js'

const SidebarItem = ({id, label, icon, active, onClick}) =>
  h(
    'div',
    {
      class: `hub-sidebar-item${active ? ' active' : ''}`,
      onClick: () => onClick(id),
    },
    h('img', {
      src: `./node_modules/@primer/octicons/build/svg/${icon}.svg`,
      class: 'icon',
      alt: '',
    }),
    h('span', null, label),
  )

export default class ManagementHubSidebar extends Component {
  constructor(props) {
    super(props)
    this.handleItemClick = (id) => {
      hubStore.setActiveSection(id)
    }
  }

  render({activeSection}) {
    return h(
      'aside',
      {class: 'hub-sidebar'},
      h(
        'div',
        {class: 'hub-sidebar-top'},
        h(SidebarItem, {
          id: 'foxGames',
          label: '野狐对局',
          icon: 'search',
          active: activeSection === 'foxGames',
          onClick: this.handleItemClick,
        }),
        h(SidebarItem, {
          id: 'oneOhOneWeiqi',
          label: '101围棋',
          icon: 'sync',
          active: activeSection === 'oneOhOneWeiqi',
          onClick: this.handleItemClick,
        }),
      ),
    )
  }
}
