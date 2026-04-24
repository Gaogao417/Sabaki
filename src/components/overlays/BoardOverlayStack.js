import {h, Component, Fragment} from 'preact'

import Goban from '../Goban.js'

import * as helper from '../../modules/helper.js'
import {composeMarkerMaps} from '../../modules/overlays/compose.js'
import {getTerritoryPaintLayer} from './TerritoryPaintLayer.js'
import {getTerritoryDiffLayer} from './TerritoryDiffLayer.js'

export default class BoardOverlayStack extends Component {
  componentDidMount() {
    this.reportStatus()
  }

  componentDidUpdate() {
    this.reportStatus()
  }

  componentWillUnmount() {
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
      territoryMode,
      baselineOwnership,
      unavailableReason,
      gobanProps,
      analysis,
      lastMoveDeltaMap,
      lastMoveDiffAvailable,
      diffSourceType = null,
      keyPointSummary = null,
      comparisonOwnership = null,
    },
    {
      hoveredVertex = null,
      hoveredAnalysisVertex = null,
      hoverOwnership = null,
      hoverPending = false,
    },
  ) {
    let territoryPaintLayer =
      unavailableReason == null && territoryMode
        ? getTerritoryPaintLayer(baselineOwnership, hoveredVertex)
        : {
            paintMap: gobanProps.paintMap,
            markerMap: null,
            territorySummary: null,
            hoveredRegion: null,
          }

    let hoverDeltaMap =
      baselineOwnership != null && hoverOwnership != null
        ? helper.getOwnershipDelta(baselineOwnership, hoverOwnership)
        : null
    let activeDeltaMap = hoverDeltaMap ?? lastMoveDeltaMap
    let activeDiffSourceType =
      hoverDeltaMap != null
        ? 'hover'
        : lastMoveDiffAvailable && lastMoveDeltaMap != null
          ? diffSourceType
          : null

    let territoryDiffLayer =
      unavailableReason == null && territoryMode
        ? getTerritoryDiffLayer({
            ownership: baselineOwnership,
            comparisonOwnership,
            deltaMap: activeDeltaMap,
            hoveredVertex,
            hoveredRegion: territoryPaintLayer.hoveredRegion,
          })
        : {
            markerMap: null,
            deltaSummary: null,
            hoveredDelta: null,
            hoveredRegionDeltaSummary: null,
          }

    this.statusProps = territoryMode
      ? {
          territoryMode,
          unavailableReason:
            hoverPending && unavailableReason == null
              ? 'Loading territory diff preview...'
              : unavailableReason,
          territorySummary: territoryPaintLayer.territorySummary,
          hoveredRegion: territoryPaintLayer.hoveredRegion,
          deltaSummary: territoryDiffLayer.deltaSummary,
          hoveredDelta: territoryDiffLayer.hoveredDelta,
          hoveredRegionDeltaSummary:
            territoryDiffLayer.hoveredRegionDeltaSummary,
          diffSourceType: activeDiffSourceType,
          keyPointSummary,
        }
      : null

    return h(
      Fragment,
      null,
      h(Goban, {
        ...gobanProps,
        className: territoryMode ? 'territory-mode' : gobanProps.className,
        analysis,
        paintMap:
          territoryMode &&
          unavailableReason == null &&
          territoryPaintLayer.paintMap != null
            ? territoryPaintLayer.paintMap.map((row, y) =>
                row.map((value, x) => {
                  let areaValue = gobanProps.paintMap?.[y]?.[x] ?? 0
                  if (areaValue >= 0) return value
                  return value === 0 ? areaValue : value * 0.55
                }),
              )
            : gobanProps.paintMap,
        markerMap: composeMarkerMaps(
          gobanProps.markerMap,
          territoryPaintLayer.markerMap,
          territoryDiffLayer.markerMap,
        ),
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
