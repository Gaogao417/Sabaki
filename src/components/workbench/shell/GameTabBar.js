import {h} from 'preact'

/**
 * @callback onSelectCallback
 * @param {number} index - Index of the selected game tab
 */

/**
 * @callback onCloseCallback
 * @param {number} index - Index of the game tab to close
 */

/**
 * @callback onAddCallback
 * Called when the user requests a new game
 */

/**
 * GameTabBar renders a browser-style multi-game tab bar.
 *
 * @param {Object} props
 * @param {Array<{index: number, title: string, active: boolean}>} props.games - List of games
 * @param {number} props.activeIndex - Currently active game index
 * @param {onSelectCallback} props.onSelect - Fired when a tab is selected
 * @param {onCloseCallback} props.onClose - Fired when a tab close button is clicked
 * @param {onAddCallback} props.onAdd - Fired when the add button is clicked
 */
export default function GameTabBar({
  games = [],
  activeIndex = 0,
  onSelect = () => {},
  onClose = () => {},
  onAdd = () => {},
}) {
  return h('nav', {
    'data-testid': 'game-tab-bar',
    class: 'wb-game-tab-bar',
  },
    games.map(({index, title, active}) =>
      h('button', {
        key: index,
        'data-testid': 'game-tab-item',
        'data-index': index,
        class: `wb-game-tab-bar__tab${index === activeIndex ? ' active' : ''}`,
        onClick: () => onSelect(index),
      },
        h('span', {class: 'wb-game-tab-bar__tab-title'}, title),
        h('span', {
          'data-testid': 'game-tab-close',
          class: 'wb-game-tab-bar__tab-close',
          onClick: (e) => {
            e.stopPropagation()
            onClose(index)
          },
        }, '×'),
      )
    ),
    h('button', {
      'data-testid': 'game-tab-add',
      class: 'wb-game-tab-bar__add',
      onClick: () => onAdd(),
    }, '+'),
  )
}
