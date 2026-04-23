import {h, Component} from 'preact'
import classNames from 'classnames'
import sabaki from '../../modules/sabaki.js'

export default class Bar extends Component {
  constructor(props) {
    super(props)

    let active = props.active ?? props.type === props.mode
    this.state = {
      hidecontent: !active,
    }
  }

  componentWillReceiveProps(nextProps) {
    let isCurrent =
      nextProps.active ??
      (nextProps.type === nextProps.mode ||
        (nextProps.activeModes || []).includes(nextProps.mode))

    if (isCurrent) {
      clearTimeout(this.hidecontentId)

      if (this.state.hidecontent) this.setState({hidecontent: false})
    } else {
      if (!this.state.hidecontent)
        this.hidecontentId = setTimeout(
          () => this.setState({hidecontent: true}),
          500,
        )
    }
  }

  shouldComponentUpdate(nextProps) {
    let nextCurrent =
      nextProps.active ??
      (nextProps.mode === nextProps.type ||
        (nextProps.activeModes || []).includes(nextProps.mode))

    return nextProps.mode !== this.props.mode || nextCurrent
  }

  render(
    {children, type, mode, class: c = '', activeModes = [], active, onClose},
    {hidecontent},
  ) {
    let current = active ?? (type === mode || activeModes.includes(mode))

    return h(
      'section',
      {
        id: type,
        class: classNames(c, {
          bar: true,
          current,
          hidecontent,
        }),
      },

      children,
      h('a', {
        class: 'close',
        href: '#',
        onClick: onClose ?? (() => sabaki.setMode('play')),
      }),
    )
  }
}
