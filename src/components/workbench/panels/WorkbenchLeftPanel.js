import {h, Component} from 'preact'

// Lazy import: PeerList.js imports sabaki.js at module level which has
// Electron-specific side effects. Use try-catch to tolerate environments
// where sabaki module is unavailable (test harnesses).
let EnginePeerList = null
try {
  const peerListMod = require('../../sidebars/PeerList.js')
  if (peerListMod && peerListMod.EnginePeerList) {
    EnginePeerList = peerListMod.EnginePeerList
  }
} catch (_) { /* PeerList unavailable in test harness */ }

/**
 * WorkbenchLeftPanel is a presentational wrapper that renders
 * EnginePeerList (top) + mode panel children (bottom) in the
 * left column of the WorkbenchShell.
 *
 * Props:
 * @param {Object} props.engineProps - Engine props forwarded to EnginePeerList
 * @param {import('preact').VNode} props.modePanel - Mode-specific panel VNode child
 */
export default function WorkbenchLeftPanel({engineProps = {}, modePanel}) {
  return h('div', {class: 'workbench-left-panel', style: {display: 'flex', flexDirection: 'column', height: '100%'}},
    EnginePeerList
      ? h('div', {style: {flex: '0 0 auto', maxHeight: '220px', overflow: 'hidden'}},
          h(EnginePeerListAdapter, engineProps),
        )
      : h('div', {class: 'workbench-left-panel__engine-placeholder'}),
    h('div', {style: {flex: '1 1 0', overflowY: 'auto', minHeight: 0}},
      modePanel,
    ),
  )
}

/**
 * EnginePeerListAdapter wraps EnginePeerList and manages
 * selectedEngineSyncerId as local Preact state.
 */
class EnginePeerListAdapter extends Component {
  constructor(props) {
    super(props)
    this.state = {
      selectedEngineSyncerId: null,
    }
  }

  render({
    attachedEngineSyncers,
    blackEngineSyncerId,
    whiteEngineSyncerId,
    analyzingEngineSyncerId,
    engineGameOngoing,
  }) {
    return h(EnginePeerList, {
      attachedEngineSyncers,
      selectedEngineSyncerId: this.state.selectedEngineSyncerId,
      blackEngineSyncerId,
      whiteEngineSyncerId,
      analyzingEngineSyncerId,
      engineGameOngoing,
      onEngineSelect: (evt) => {
        const syncer = evt.syncer || evt
        if (syncer && syncer.id != null) {
          this.setState({selectedEngineSyncerId: syncer.id})
        }
      },
    })
  }
}
