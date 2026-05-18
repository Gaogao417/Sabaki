import {h} from 'preact'

/**
 * MaterialLibraryDialog renders a modal dialog for the material library.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the dialog is visible
 * @param {Function} props.onClose - Called when dialog should close
 */
export default function MaterialLibraryDialog({open = false, onClose = () => {}}) {
  const classNames = 'wb-material-library-dialog' + (open ? '' : ' wb-material-library-dialog--hidden')

  return h('div', {
    'data-testid': 'material-library-dialog',
    class: classNames,
    'aria-hidden': String(!open),
  },
    h('div', {class: 'wb-material-library-dialog__header'},
      h('span', {class: 'wb-material-library-dialog__title'}, 'Material Library'),
      h('button', {
        'data-testid': 'material-library-close',
        class: 'wb-material-library-dialog__close',
        onClick: onClose,
      }, '×'),
    ),
    h('div', {class: 'wb-material-library-dialog__body'},
      h('div', {class: 'wb-material-library-dialog__placeholder'}, 'Library content placeholder'),
    ),
  )
}
