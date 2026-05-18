import {h} from 'preact'

/**
 * ModeToggle renders a toggle switch for boolean mode settings.
 *
 * @param {Object} props
 * @param {boolean} props.checked - Whether the toggle is on
 * @param {Function} props.onChange - Called with the new boolean value on click
 */
export default function ModeToggle({checked = false, onChange = () => {}}) {
  const classNames = 'wb-mode-toggle' + (checked ? ' wb-mode-toggle--checked' : '')

  return h('button', {
    'data-testid': 'mode-toggle',
    class: classNames,
    role: 'switch',
    'aria-checked': String(checked),
    onClick: () => onChange(!checked),
  },
    h('span', {class: 'wb-mode-toggle__track'},
      h('span', {class: 'wb-mode-toggle__thumb'}),
    ),
  )
}
