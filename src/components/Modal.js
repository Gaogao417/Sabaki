import {h, Component} from 'preact'

export default class Modal extends Component {
  constructor(props) {
    super(props)

    this.handleBackdropClick = (evt) => {
      if (evt.target === evt.currentTarget && this.props.onClose) {
        this.props.onClose()
      }
    }

    this.handleKeyDown = (evt) => {
      if (evt.key === 'Escape' && this.props.onClose) {
        this.props.onClose()
      }
    }
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown)
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown)
  }

  render({show, title, onClose, children, width}) {
    if (!show) return null

    return h(
      'section',
      {
        class: 'modal-backdrop',
        onClick: this.handleBackdropClick,
      },
      h(
        'div',
        {
          class: 'modal',
          style: width ? {width} : undefined,
        },
        h(
          'header',
          {class: 'modal__header'},
          h('h2', {}, title),
          onClose &&
            h(
              'button',
              {
                type: 'button',
                class: 'modal__close',
                onClick: onClose,
              },
              '×',
            ),
        ),
        h('div', {class: 'modal__body'}, children),
      ),
    )
  }
}
