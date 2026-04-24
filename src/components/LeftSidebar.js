import {h, Component} from 'preact'
import {parseVertex} from '@sabaki/sgf'

import sabaki from '../modules/sabaki.js'
import SplitContainer from './helpers/SplitContainer.js'
import GtpConsole from './sidebars/GtpConsole.js'
import {EnginePeerList} from './sidebars/PeerList.js'

const setting = {
  get: (key) => window.sabaki.setting.get(key),
  set: (key, value) => window.sabaki.setting.set(key, value),
}
const peerListMinHeight = setting.get('view.peerlist_minheight')
const alpha = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'

function getMoveInfo(node, index, boardSize = [19, 19]) {
  let color = node.data.B != null ? 1 : node.data.W != null ? -1 : 0
  let value = color > 0 ? node.data.B[0] : color < 0 ? node.data.W[0] : null
  let vertex = value == null || value === '' ? null : parseVertex(value)
  let label =
    vertex == null
      ? value === ''
        ? 'pass'
        : '-'
      : `${alpha[vertex[0]]}${boardSize[1] - vertex[1]}`

  return {color, label, number: index}
}

export default class LeftSidebar extends Component {
  constructor() {
    super()

    this.state = {
      peerListHeight: setting.get('view.peerlist_height'),
      selectedEngineSyncerId: null,
    }

    this.handlePeerListHeightChange = ({sideSize}) => {
      this.setState({peerListHeight: Math.max(sideSize, peerListMinHeight)})
    }

    this.handlePeerListHeightFinish = () => {
      setting.set('view.peerlist_height', this.state.peerListHeight)
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
      let stepEngine = this.props.attachedEngineSyncers[stepEngineIndex]

      if (stepEngine != null) {
        this.setState({selectedEngineSyncerId: stepEngine.id})
      }
    }

    this.handleEngineSelect = ({syncer}) => {
      this.setState({selectedEngineSyncerId: syncer.id}, () => {
        let input = this.element.querySelector('.gtp-console .input .command')

        if (input != null) {
          input.focus()
        }
      })
    }

    this.handleCommandSubmit = ({command}) => {
      let syncer = this.props.attachedEngineSyncers.find(
        (syncer) => syncer.id === this.state.selectedEngineSyncerId,
      )

      if (syncer != null) {
        syncer.queueCommand(command)
      }
    }
  }

  shouldComponentUpdate(nextProps) {
    return (
      nextProps.showLeftSidebar != this.props.showLeftSidebar ||
      nextProps.showLeftSidebar
    )
  }

  render(
    {
      attachedEngineSyncers,
      analyzingEngineSyncerId,
      blackEngineSyncerId,
      whiteEngineSyncerId,
      engineGameOngoing,
      showLeftSidebar,
      consoleLog,
      mode,
      editWorkspaceActive,
      currentLineNodes = [],
      treePosition,
      gameTree,
      gameInfo,
    },
    {peerListHeight, selectedEngineSyncerId},
  ) {
    let peerList = h(EnginePeerList, {
      attachedEngineSyncers,
      analyzingEngineSyncerId,
      blackEngineSyncerId,
      whiteEngineSyncerId,
      selectedEngineSyncerId,
      engineGameOngoing,

      onEngineSelect: this.handleEngineSelect,
    })
    let console = h(GtpConsole, {
      show: showLeftSidebar,
      consoleLog,
      attachedEngine: attachedEngineSyncers
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
        .find((x) => x != null),

      onSubmit: this.handleCommandSubmit,
      onControlStep: this.handleCommandControlStep,
    })
    let moveNodes = currentLineNodes.filter(
      (node) => node.data.B != null || node.data.W != null,
    )

    let inspectorSidebar = editWorkspaceActive || mode === 'play'

    if (inspectorSidebar) {
      return h(
        'section',
        {
          ref: (el) => (this.element = el),
          id: 'leftsidebar',
          class: 'inspector-sidebar left-inspector-sidebar',
        },

        peerList,
        h(
          'section',
          {class: 'panel-card engine-log-card'},
          h('div', {class: 'panel-title'}, 'ENGINE LOGS'),
          console,
        ),
        h(
          'section',
          {class: 'panel-card move-list-card'},
          h('div', {class: 'panel-title'}, 'MOVE LIST'),
          h(
            'ol',
            {class: 'move-list'},
            moveNodes.length === 0
              ? h('li', {class: 'empty'}, 'No moves on the current line.')
              : moveNodes.map((node, index) => {
                  let move = getMoveInfo(node, index + 1, gameInfo.size)

                  return h(
                    'li',
                    {
                      key: node.id,
                      class: `move-row${node.id === treePosition ? ' current' : ''}`,
                      onClick: () =>
                        sabaki.setCurrentTreePosition(gameTree, node.id),
                    },
                    h('span', {class: 'move-number'}, `${move.number}.`),
                    h('span', {
                      class: `stone-dot ${move.color > 0 ? 'black' : 'white'}`,
                    }),
                    h('span', {class: 'move-vertex'}, move.label),
                    h('span', {class: 'move-branch'}, '~'),
                  )
            }),
          ),
        ),
      )
    }

    return h(
      'section',
      {
        ref: (el) => (this.element = el),
        id: 'leftsidebar',
      },

      h(SplitContainer, {
        vertical: true,
        invert: true,
        sideSize: peerListHeight,

        sideContent: h(EnginePeerList, {
          attachedEngineSyncers,
          analyzingEngineSyncerId,
          blackEngineSyncerId,
          whiteEngineSyncerId,
          selectedEngineSyncerId,
          engineGameOngoing,

          onEngineSelect: this.handleEngineSelect,
        }),

        mainContent: h(GtpConsole, {
          show: showLeftSidebar,
          consoleLog,
          attachedEngine: attachedEngineSyncers
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
            .find((x) => x != null),

          onSubmit: this.handleCommandSubmit,
          onControlStep: this.handleCommandControlStep,
        }),

        onChange: this.handlePeerListHeightChange,
        onFinish: this.handlePeerListHeightFinish,
      }),
    )
  }
}

LeftSidebar.getDerivedStateFromProps = (props, state) => {
  if (
    props.attachedEngineSyncers.length > 0 &&
    props.attachedEngineSyncers.find(
      (syncer) => syncer.id === state.selectedEngineSyncerId,
    ) == null
  ) {
    return {selectedEngineSyncerId: props.attachedEngineSyncers[0].id}
  } else if (props.attachedEngineSyncers.length === 0) {
    return {selectedEngineSyncerId: null}
  }
}
