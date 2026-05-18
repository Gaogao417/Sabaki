import {h} from 'preact'

const TABS = [
  {key: 'play', label: 'Play', color: '#2563ff'},
  {key: 'problem', label: 'Problem', color: '#d97706'},
  {key: 'recall', label: 'Recall', color: '#169b55'},
  {key: 'analysis', label: 'Analysis', color: '#7c3aed'},
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
    TABS.map(({key, label, color}) => {
      const isActive = activeTab === key
      const badgeCount = badgeCounts[key]

      return h('button', {
        key,
        'data-testid': 'training-tab',
        'data-tab': key,
        class: `wb-training-tab-bar__tab${isActive ? ' wb-training-tab-bar__tab--active' : ''}`,
        style: isActive ? {borderBottom: `2px solid ${color}`, color} : {},
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
