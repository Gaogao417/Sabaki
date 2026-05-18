import {h} from 'preact'

const TABS = [
  {key: 'play', label: '对局'},
  {key: 'problem', label: '做题'},
  {key: 'recall', label: '回忆'},
  {key: 'analysis', label: '复盘'},
]

/**
 * TrainingTabBar renders the 4 mode tabs with optional badge counts.
 *
 * @param {Object} props
 * @param {string} props.activeTab - Currently active tab key
 * @param {Function} props.onTabChange - Callback fired with tab key on click
 * @param {Object} [props.badgeCounts] - Map of tab key to count number
 */
export default function TrainingTabBar({activeTab = 'play', onTabChange = () => {}, badgeCounts = {}}) {
  return h('nav', {
    'data-testid': 'training-tab-bar',
    class: 'wb-training-tab-bar',
  },
    TABS.map(({key, label}) => {
      const isActive = activeTab === key
      const badgeCount = badgeCounts[key]

      return h('button', {
        key,
        'data-testid': 'training-tab',
        'data-tab': key,
        class: `wb-training-tab-bar__tab${isActive ? ' wb-training-tab-bar__tab--active' : ''}`,
        onClick: () => onTabChange(key),
      },
        label,
        badgeCount > 0
          ? h('span', {
              'data-testid': 'tab-badge',
              class: 'wb-training-tab-bar__badge',
            }, String(badgeCount))
          : null,
      )
    }),
  )
}
