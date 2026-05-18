import {h} from 'preact'

const ICONS = {
  search: () => h('svg', {width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'},
    h('circle', {cx: 11, cy: 11, r: 8}),
    h('path', {d: 'm21 21-4.35-4.35'}),
  ),
  tree: () => h('svg', {width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'},
    h('path', {d: 'M12 22V12m0 0l-4 4m4-4l4 4'}),
    h('circle', {cx: 12, cy: 8, r: 5}),
  ),
  circle: () => h('svg', {width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5},
    h('circle', {cx: 12, cy: 12, r: 9}),
  ),
  square: () => h('svg', {width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5},
    h('rect', {x: 4, y: 4, width: 16, height: 16, rx: 2}),
  ),
  triangle: () => h('svg', {width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linejoin': 'round'},
    h('path', {d: 'M12 4L3 20h18z'}),
  ),
  diamond: () => h('svg', {width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linejoin': 'round'},
    h('path', {d: 'M12 2l10 10-10 10L2 12z'}),
  ),
}

/**
 * EmptyStatePanel renders a centered empty state with icon, title,
 * description, and an optional action button.
 *
 * @param {Object} props
 * @param {string} props.icon - Icon key: 'search'|'tree'|'circle'|'square'|'triangle'|'diamond'
 * @param {string} props.title - Primary message
 * @param {string} props.description - Secondary description
 * @param {{label: string, onClick: Function}} [props.action] - Optional action button
 */
export default function EmptyStatePanel({icon, title, description, action}) {
  const iconRenderer = ICONS[icon]
  return h('div', {class: 'wb-empty-state-panel'},
    h('div', {'data-testid': 'empty-state-icon', class: 'wb-empty-state-panel__icon'},
      iconRenderer ? iconRenderer() : null,
    ),
    h('div', {class: 'wb-empty-state-panel__title'}, title),
    h('div', {class: 'wb-empty-state-panel__description'}, description),
    action && h('button', {
      'data-testid': 'empty-state-action',
      class: 'wb-btn wb-btn-primary',
      onClick: action.onClick,
    }, action.label),
  )
}
