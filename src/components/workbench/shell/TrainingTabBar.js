import {h} from 'preact'

const MODE_COLORS = {
  play: '#169b55',
  problem: '#2563ff',
  recall: '#7c3aed',
  analysis: '#e67e22',
}

const MODE_LABELS = {
  play: '对局',
  problem: '题目',
  recall: '回忆',
  analysis: '复盘',
}

const DEFAULT_TABS = [
  {id: 'tab-1', title: '攻击题 #1024', mode: 'problem', active: true},
  {id: 'tab-2', title: '定式练习', mode: 'recall', active: false},
  {id: 'tab-3', title: '对局复盘', mode: 'analysis', active: false},
]

export default function TrainingTabBar({
  tabs = DEFAULT_TABS,
  onTabClick = () => {},
  onNewTab = () => {},
}) {
  return h(
    'div',
    {class: 'wb-tab-bar'},

    h(
      'div',
      {class: 'wb-tab-bar__list'},
      tabs.map((tab) =>
        h(
          'div',
          {
            key: tab.id,
            class: `wb-tab-bar__tab${tab.active ? ' wb-tab-bar__tab--active' : ''}`,
            onClick: () => onTabClick(tab.id),
          },
          h('span', {class: 'wb-tab-bar__tab-title'}, tab.title),
          h(
            'span',
            {
              class: 'wb-tab-bar__tab-mode',
              style: {
                color: MODE_COLORS[tab.mode] || MODE_COLORS.problem,
                borderColor: MODE_COLORS[tab.mode] || MODE_COLORS.problem,
              },
            },
            MODE_LABELS[tab.mode] || tab.mode,
          ),
          h(
            'button',
            {
              class: 'wb-tab-bar__tab-close',
              onClick: (e) => {
                e.stopPropagation()
              },
              title: '关闭标签页',
            },
            '×',
          ),
        ),
      ),
    ),

    h(
      'button',
      {
        class: 'wb-tab-bar__new-tab',
        onClick: onNewTab,
        title: '新建标签页',
      },
      '+',
    ),
  )
}
