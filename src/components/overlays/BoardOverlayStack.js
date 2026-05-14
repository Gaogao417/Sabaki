import {h, Component, Fragment} from 'preact'

import Goban from '../Goban.js'

import * as helper from '../../modules/helper.js'
import {resolveOverlayInput} from '../../modules/overlays/resolveOverlayInput.ts'
import {composeWorkbenchOverlays} from '../../modules/overlays/composeWorkbenchOverlays.ts'

/**
 * Derive overlay toggle state from the injected overlayStore subscription.
 * Falls back to deriving from props for backwards compatibility.
 */
function getOverlaySnapshot({props, state}) {
  let overlayState = state.overlayState
  if (overlayState != null) {
    let territoryMode = overlayState.territoryEnabled || overlayState.territoryCompareEnabled
    let territoryCompareActive = overlayState.territoryCompareEnabled && (props.editWorkspaceActive ?? false)
    return {territoryMode, territoryCompareActive}
  }
  return {
    territoryMode: props.territoryMode ?? false,
    territoryCompareActive: props.territoryCompareActive ?? false,
  }
}

export default class BoardOverlayStack extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hoveredVertex: null,
      hoveredAnalysisVertex: null,
      hoveredVariation: null,
      hoverOwnership: null,
      hoverPending: false,
      overlayState: props.boardServices?.overlayStore?.getState() ?? null,
    }
  }

  componentDidMount() {
    const {overlayStore} = this.props.boardServices || {}
    if (overlayStore?.subscribe) {
      this.unsubscribeOverlay = overlayStore.subscribe(() => {
        this.setState({overlayState: overlayStore.getState()})
      })
    }
    this.reportStatus()
  }

  componentDidUpdate() {
    this.reportStatus()
  }

  componentWillUnmount() {
    this.unsubscribeOverlay?.()
    this.props.onStatusChange?.(null)
  }

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.gobanProps.treePosition !==
        this.props.gobanProps.treePosition ||
      nextProps.baselineOwnership !== this.props.baselineOwnership ||
      nextProps.analysis !== this.props.analysis
    ) {
      this.clearHoverState()
    }
  }

  clearHoverState() {
    this.hoverToken = (this.hoverToken || 0) + 1
    this.setState({
      hoveredVertex: null,
      hoveredAnalysisVertex: null,
      hoveredVariation: null,
      hoverOwnership: null,
      hoverPending: false,
    })
  }

  reportStatus() {
    if (helper.equals(this.lastStatusProps, this.statusProps)) return

    this.lastStatusProps = this.statusProps
    this.props.onStatusChange?.(this.statusProps)
  }

  async syncHoverPreview(vertex) {
    this.setState({
      hoveredAnalysisVertex: null,
      hoveredVariation: null,
      hoverOwnership: null,
      hoverPending: false,
    })
  }

  render(
    {
      appMode,
      editWorkspaceActive,
      editActiveTab,
      analysisPending,
      engineSyncerAvailable,
      activeAnalysis,
      analysisTreePositionMatches,
      gameTreeOwnership,
      editCurrentOwnership,
      editReferenceOwnership,
      editWorkspaceCurrentOwnership,
      editWorkspaceReferenceOwnership,
      editPreviewOwnership,
      keyPointSummary,
      gobanProps,
      analysis,
      showHeatmap,
      showHumanPreference,
    },
    {
      hoveredVertex = null,
      hoveredAnalysisVertex = null,
      hoverOwnership = null,
      hoverPending = false,
    },
  ) {
    let {territoryMode, territoryCompareActive} = getOverlaySnapshot({props: this.props, state: this.state})

    let resolved = resolveOverlayInput({
      territoryMode,
      appMode: appMode ?? 'analysis',
      editWorkspaceActive: editWorkspaceActive ?? false,
      territoryCompareActive,
      editActiveTab: editActiveTab ?? null,
      analysisPending: analysisPending ?? false,
      engineSyncerAvailable: engineSyncerAvailable ?? false,
      activeAnalysis: activeAnalysis ?? null,
      analysisTreePositionMatches: analysisTreePositionMatches ?? false,
      gameTreeOwnership,
      editCurrentOwnership: editCurrentOwnership ?? null,
      editReferenceOwnership: editReferenceOwnership ?? null,
      editWorkspaceCurrentOwnership: editWorkspaceCurrentOwnership ?? null,
      editWorkspaceReferenceOwnership: editWorkspaceReferenceOwnership ?? null,
      editPreviewOwnership: editPreviewOwnership ?? null,
      keyPointSummary: keyPointSummary ?? null,
      hoveredVertex,
      hoverOwnership,
      hoverPending,
      basePaintMap: gobanProps.paintMap,
      baseMarkerMap: gobanProps.markerMap,
      heatmapActive: showHeatmap ?? false,
      humanPreferenceActive: showHumanPreference ?? false,
    })

    let composition = composeWorkbenchOverlays(resolved)
    this.statusProps = composition.statusProps

    return h(
      Fragment,
      null,
      h(Goban, {
        ...gobanProps,
        className: composition.className || gobanProps.className,
        analysis,
        paintMap: composition.paintMap,
        markerMap: composition.markerMap,
        highlightVertices: gobanProps.highlightVertices,
        onVertexMouseMove: ({vertex, ...evt}) => {
          gobanProps.onVertexMouseMove?.({vertex, ...evt})
          this.setState({hoveredVertex: vertex})
          this.syncHoverPreview(vertex)
        },
        onVertexMouseEnter: ({vertex, ...evt}) => {
          gobanProps.onVertexMouseEnter?.({vertex, ...evt})
          this.setState({hoveredVertex: vertex})
          this.syncHoverPreview(vertex)
        },
        onVertexMouseLeave: ({vertex, ...evt}) => {
          gobanProps.onVertexMouseLeave?.({vertex, ...evt})
          this.clearHoverState()
        },
      }),
    )
  }
}
