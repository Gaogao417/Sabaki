import {h, Component} from 'preact'
import {BoundedGoban} from '@sabaki/shudan'

export default class MiniGoban extends Component {
  shouldComponentUpdate({board, maxSize, visible}) {
    return (
      visible !== this.props.visible ||
      maxSize !== this.props.maxSize ||
      board !== this.props.board
    )
  }

  render({board, maxSize, visible = true}) {
    return h(BoundedGoban, {
      style: {
        visibility: visible ? 'visible' : 'hidden',
        pointerEvents: 'none',
      },
      maxWidth: maxSize,
      maxHeight: maxSize,
      signMap: board.signMap,
      showCoordinates: false,
      fuzzyStonePlacement: false,
      animateStonePlacement: false,
    })
  }
}
