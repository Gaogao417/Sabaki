import {h, Component} from 'preact'

import sabaki from '../modules/sabaki.js'
import SplitContainer from './helpers/SplitContainer.js'
import GtpConsole from './sidebars/GtpConsole.js'
import {EnginePeerList} from './sidebars/PeerList.js'
import BoardOverlayStack from './overlays/BoardOverlayStack.js'

const setting = {
  get: (key) => window.sabaki.setting.get(key),
  set: (key, value) => window.sabaki.setting.set(key, value),
}
const peerListMinHeight = setting.get('view.peerlist_minheight')

export default class LeftSidebar extends Component {
  constructor() {
    super()

    this.state = {
      peerListHeight: setting.get('view.peerlist_height'),
      selectedEngineSyncerId: null,
      engineLogExpanded: false,
    }

    this.handlePeerListHeightChange = ({sideSize}) => {
      this.setState({peerListHeight: Math.max(sideSize, peerListMinHeight)})
    }

    this.handlePeerListHeightFinish = () => {
      setting.set('view.peerlist_height', this.state.peerListHeight)
    }

    this.handleEngineLogToggle = () => {
      this.setState(({engineLogExpanded}) => ({engineLogExpanded: !engineLogExpanded}))
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
      editPreviewBoard,
      editPreviewOwnership,
      editPreviewTab,
      territoryMode,
      overlayUnavailableReason,
      boardTransformation,
      gameTree,
      treePosition,
    },
    {peerListHeight, selectedEngineSyncerId, engineLogExpanded},
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

    let inspectorSidebar = editWorkspaceActive || mode === 'play'

    if (inspectorSidebar) {
      // Compute engine log excerpt (last 5 lines)
      let logExcerpt = consoleLog.slice(-5)

      // Compute edit preview goban props for reference card
      let showReferenceCard = editWorkspaceActive && editPreviewBoard != null
      let editPreviewGobanProps = showReferenceCard
        ? {
            id: 'goban-edit-preview',
            gameTree,
            treePosition,
            board: editPreviewBoard,
            highlightVertices: [],
            analysisType: null,
            analysis: null,
            paintMap: null,
            markerMap: null,
            compareSelectedVertices: [],
            dimmedStones: [],
            overlayGhostStoneMap: null,
            crosshair: false,
            showCoordinates: false,
            showMoveColorization: false,
            showMoveNumbers: false,
            showNextMoves: false,
            showSiblings: false,
            fuzzyStonePlacement: false,
            animateStonePlacement: false,
            playVariation: null,
            drawLineMode: null,
            transformation: boardTransformation,
            dragMode: false,
          }
        : null

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
          {class: 'panel-card engine-card'},
          h('div', {class: 'panel-title'}, 'ENGINE'),
          h('div', {class: 'engine-card-body'},
            // Engine status summary
            h('div', {class: 'engine-status-summary'},
              h('span', {class: 'engine-count'},
                `${attachedEngineSyncers.length} engine${attachedEngineSyncers.length !== 1 ? 's' : ''} attached`,
              ),
              analyzingEngineSyncerId != null && h('span', {class: 'engine-analyzing'}, 'Analyzing...'),
            ),
            // Collapsed: log excerpt + expand button
            !engineLogExpanded && h('div', {class: 'engine-log-excerpt'},
              h('ol', {class: 'log-excerpt-list'},
                logExcerpt.length === 0
                  ? h('li', {class: 'empty'}, 'No log entries yet.')
                  : logExcerpt.map((entry, i) => {
                      let text = entry.command || entry.response || ''
                      return h('li', {key: i},
                        h('span', {class: `log-entry ${entry.command ? 'command' : 'response'}`}, text),
                      )
                    }),
              ),
            ),
            !engineLogExpanded &&
              h('button', {
                class: 'engine-log-toggle',
                onClick: this.handleEngineLogToggle,
              }, 'Expand Console'),
            // Expanded: full GtpConsole + collapse button
            engineLogExpanded && h(GtpConsole, {
              show: showLeftSidebar && engineLogExpanded,
              consoleLog,
              attached: attachedEngineSyncers
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
            engineLogExpanded &&
              h('button', {
                class: 'engine-log-toggle',
                onClick: this.handleEngineLogToggle,
              }, 'Collapse Console'),
          ),
        ),
        showReferenceCard &&
          h(
            'section',
            {class: 'panel-card reference-card'},
            h('div', {class: 'panel-title'},
              editPreviewTab === 'reference' ? 'REFERENCE' : 'CURRENT',
              h('span', {class: 'reference-preview-label'}, 'Preview'),
            ),
            h('div', {class: 'reference-card-body'},
              h(BoardOverlayStack, {
                territoryMode,
                baselineOwnership: editPreviewOwnership,
                unavailableReason: overlayUnavailableReason,
                gobanProps: editPreviewGobanProps,
                analysis: null,
                lastMoveDeltaMap: null,
                lastMoveDiffAvailable: false,
                diffSourceType: null,
                comparisonOwnership: null,
              }),
            ),
          ),
        !showReferenceCard && mode === 'play' &&
          h(
            'section',
            {class: 'panel-card reference-card'},
            h('div', {class: 'panel-title'}, 'POSITION PREVIEW'),
            h('div', {class: 'reference-card-body reference-empty'},
              h('span', {}, 'Current position'),
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
