import {h} from 'preact'

/**
 * RightDrawer renders a slide-in panel from the right side.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the drawer is visible
 * @param {string} props.title - Drawer title
 * @param {Function} props.onClose - Called when drawer should close
 * @param {Array} [props.children] - Drawer content
 */
export default function RightDrawer({open = false, title = '', onClose = () => {}, children}) {
  const classNames = 'wb-right-drawer' + (open ? '' : ' wb-right-drawer--hidden')

  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose()
  }

  return h('div', {
    'data-testid': 'right-drawer',
    class: classNames,
    'aria-hidden': String(!open),
    onKeyDown: handleKeyDown,
    tabIndex: -1,
  },
    h('div', {class: 'wb-right-drawer__header'},
      h('span', {'data-testid': 'right-drawer-title', class: 'wb-right-drawer__title'}, title),
      h('button', {
        'data-testid': 'right-drawer-close',
        class: 'wb-right-drawer__close',
        onClick: onClose,
      }, '×'),
    ),
    h('div', {class: 'wb-right-drawer__body'}, children),
  )
}
