import {h, Component} from 'preact'
import classNames from 'classnames'

import GtpConsole from './sidebars/GtpConsole.js'
import {EnginePeerList} from './sidebars/PeerList.js'

export default class EngineFloatingPanel extends Component {
  constructor(props) {
    super(props)

    this.state = {
      selectedEngineSyncerId: null,
      position: {right: 24, bottom: 68},
      dragging: false,
    }

    this.handleEngineSelect = ({syncer}) => {
      this.setState({selectedEngineSyncerId: syncer.id})
    }

    this.handleCommandSubmit = ({command}) => {
      let syncer = this.props.attachedEngineSyncers.find(
        (syncer) => syncer.id === this.state.selectedEngineSyncerId,
      )

      if (syncer != null) syncer.queueCommand(command)
    }

    this.handleCommandControlStep = ({step}) => {
      let {attachedEngineSyncers} = this.props
      let engineIndex = attachedEngineSyncers.findIndex(
        (syncer) => syncer.id === this.state.selectedEngineSyncerId,
      )
      let stepEngineIndex = Math.min(
        Math.max(0, engineIndex + step),
        attachedEngineSyncers.length - 1,
      )
      let stepEngine = attachedEngineSyncers[stepEngineIndex]

      if (stepEngine != null) {
        this.setState({selectedEngineSyncerId: stepEngine.id})
      }
    }

    this.handleDragStart = (evt) => {
      if (evt.button !== 0) return

      let rect = this.element.getBoundingClientRect()
      this.dragOffset = {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top,
      }
      this.setState({dragging: true})
      window.addEventListener('mousemove', this.handleDragMove)
      window.addEventListener('mouseup', this.handleDragEnd)
    }

    this.handleDragMove = (evt) => {
      if (!this.state.dragging) return

      let width = this.element?.offsetWidth ?? 420
      let height = this.element?.offsetHeight ?? 520
      let left = Math.min(
        Math.max(8, evt.clientX - this.dragOffset.x),
        window.innerWidth - width - 8,
      )
      let top = Math.min(
        Math.max(8, evt.clientY - this.dragOffset.y),
        window.innerHeight - height - 8,
      )

      this.setState({
        position: {
          right: window.innerWidth - left - width,
          bottom: window.innerHeight - top - height,
        },
      })
    }

    this.handleDragEnd = () => {
      this.setState({dragging: false})
      window.removeEventListener('mousemove', this.handleDragMove)
      window.removeEventListener('mouseup', this.handleDragEnd)
    }
  }

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.attachedEngineSyncers.length > 0 &&
      nextProps.attachedEngineSyncers.find(
        (syncer) => syncer.id === this.state.selectedEngineSyncerId,
      ) == null
    ) {
      this.setState({selectedEngineSyncerId: nextProps.attachedEngineSyncers[0].id})
    } else if (nextProps.attachedEngineSyncers.length === 0) {
      this.setState({selectedEngineSyncerId: null})
    }
  }

  componentWillUnmount() {
    window.removeEventListener('mousemove', this.handleDragMove)
    window.removeEventListener('mouseup', this.handleDragEnd)
  }

  render(
    {
      open,
      attachedEngineSyncers,
      analyzingEngineSyncerId,
      blackEngineSyncerId,
      whiteEngineSyncerId,
      engineGameOngoing,
      consoleLog,
      onClose,
    },
    {selectedEngineSyncerId, position, dragging},
  ) {
    if (!open) return null

    let attachedEngine = attachedEngineSyncers
      .map((syncer) =>
        syncer.id !== selectedEngineSyncerId
          ? null
          : {
              name: syncer.engine.name,
              get commands() {
                return syncer.commands
              },
            },
      )
      .find((x) => x != null)

    return h(
      'section',
      {
        ref: (el) => (this.element = el),
        class: classNames('engine-floating-panel', {dragging}),
        style: {
          right: `${position.right}px`,
          bottom: `${position.bottom}px`,
        },
      },
      h(
        'header',
        {
          class: 'engine-floating-panel__header',
          onMouseDown: this.handleDragStart,
        },
        h('strong', {}, '引擎'),
        h(
          'span',
          {class: 'engine-floating-panel__status'},
          attachedEngineSyncers.length === 0
            ? '未连接'
            : analyzingEngineSyncerId != null
              ? `分析中 · ${attachedEngineSyncers.length} 个`
              : `已连接 ${attachedEngineSyncers.length} 个`,
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'engine-floating-panel__close',
            title: '关闭引擎窗口',
            onClick: onClose,
          },
          '×',
        ),
      ),
      h(
        'div',
        {class: 'engine-floating-panel__body'},
        h(EnginePeerList, {
          attachedEngineSyncers,
          analyzingEngineSyncerId,
          blackEngineSyncerId,
          whiteEngineSyncerId,
          selectedEngineSyncerId,
          engineGameOngoing,
          onEngineSelect: this.handleEngineSelect,
        }),
        h(GtpConsole, {
          show: open,
          consoleLog,
          attachedEngine,
          onSubmit: this.handleCommandSubmit,
          onControlStep: this.handleCommandControlStep,
        }),
      ),
    )
  }
}
