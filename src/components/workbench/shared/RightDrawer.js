import {h} from 'preact'

/**
 * RightDrawer renders a slide-in panel from the right side with a backdrop overlay.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the drawer is visible
 * @param {string} props.title - Drawer title
 * @param {Function} props.onClose - Called when drawer should close
 * @param {Array} [props.children] - Drawer content
 */
export default function RightDrawer({open = false, title = '', onClose = () => {}, children}) {
  const drawerClass = 'wb-right-drawer' + (open ? '' : ' wb-right-drawer--hidden')
  const backdropClass = 'wb-right-drawer__backdrop' + (open ? '' : ' wb-right-drawer__backdrop--hidden')

  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose()
  }

  return [
    h('div', {
      key: 'backdrop',
      'data-testid': 'right-drawer-backdrop',
      class: backdropClass,
      onClick: onClose,
    }),
    h('div', {
      key: 'drawer',
      'data-testid': 'right-drawer',
      class: drawerClass,
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
    ),
  ]
}
