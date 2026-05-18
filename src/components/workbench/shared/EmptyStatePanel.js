import {h} from 'preact'

/**
 * EmptyStatePanel renders a centered empty state with icon, title,
 * description, and an optional action button.
 *
 * @param {Object} props
 * @param {string} props.icon - Icon identifier/text
 * @param {string} props.title - Primary message
 * @param {string} props.description - Secondary description
 * @param {{label: string, onClick: Function}} [props.action] - Optional action button
 */
export default function EmptyStatePanel({icon, title, description, action}) {
  return h('div', {class: 'wb-empty-state-panel'},
    h('div', {'data-testid': 'empty-state-icon', class: 'wb-empty-state-panel__icon'}, icon),
    h('div', {class: 'wb-empty-state-panel__title'}, title),
    h('div', {class: 'wb-empty-state-panel__description'}, description),
    action && h('button', {
      'data-testid': 'empty-state-action',
      class: 'wb-btn wb-btn-primary',
      onClick: action.onClick,
    }, action.label),
  )
}
