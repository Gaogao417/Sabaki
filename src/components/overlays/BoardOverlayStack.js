import {h, Component, Fragment} from 'preact'

import Goban from '../Goban.js'
import OverlayStatusBar from './OverlayStatusBar.js'

import sabaki from '../../modules/sabaki.js'
import * as helper from '../../modules/helper.js'
import {composeMarkerMaps} from '../../modules/overlays/compose.js'
import {getTerritoryPaintLayer} from './TerritoryPaintLayer.js'
import {getTerritoryDiffLayer} from './TerritoryDiffLayer.js'
import {getAnalysisLayerHover} from './AnalysisLayer.js'

export default class BoardOverlayStack extends Component {
  componentWillReceiveProps(nextProps) {
    if (
      nextProps.gobanProps.treePosition !== this.props.gobanProps.treePosition ||
      nextProps.ownership !== this.props.ownership ||
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

  async syncHoverPreview(vertex) {
    let {territoryMode, analysis, gobanProps} = this.props
    if (!territoryMode) return

    let {hoveredVariation} = getAnalysisLayerHover(analysis, vertex)
    if (hoveredVariation == null) {
      this.setState({
        hoveredAnalysisVertex: null,
        hoveredVariation: null,
        hoverOwnership: null,
        hoverPending: false,
      })
      return
    }

    if (
      helper.vertexEquals(vertex, this.state.hoveredAnalysisVertex || [-1, -1])
    ) {
      return
    }

    let hoverToken = (this.hoverToken || 0) + 1
    this.hoverToken = hoverToken

    this.setState({
      hoveredAnalysisVertex: vertex,
      hoveredVariation,
      hoverOwnership: null,
      hoverPending: true,
    })

    let ownership = await sabaki.fetchPreviewOwnership(
      gobanProps.treePosition,
      hoveredVariation.moves?.slice(0, 1) ?? [hoveredVariation.vertex],
    )

    if (hoverToken !== this.hoverToken) return

    this.setState({
      hoverOwnership: ownership,
      hoverPending: false,
    })
  }

  render(
    {
      territoryMode,
      ownership,
      unavailableReason,
      gobanProps,
      analysis,
      lastMoveDeltaMap,
      lastMoveDiffAvailable,
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
        ? getTerritoryPaintLayer(ownership, hoveredVertex)
        : {
            paintMap: gobanProps.paintMap,
            markerMap: null,
            territorySummary: null,
            hoveredRegion: null,
          }

    let hoverDeltaMap =
      ownership != null && hoverOwnership != null
        ? helper.getOwnershipDelta(ownership, hoverOwnership)
        : null
    let activeDeltaMap = hoverDeltaMap ?? lastMoveDeltaMap
    let activeDiffSourceType =
      hoverDeltaMap != null
        ? 'hover'
        : lastMoveDiffAvailable && lastMoveDeltaMap != null
          ? 'move'
          : null

    let territoryDiffLayer =
      unavailableReason == null && territoryMode
        ? getTerritoryDiffLayer({
            ownership,
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

    return h(
      Fragment,
      null,
      h(Goban, {
        ...gobanProps,
        className: territoryMode ? 'territory-mode' : gobanProps.className,
        analysis,
        paintMap:
          territoryMode && unavailableReason == null
            ? territoryPaintLayer.paintMap
            : gobanProps.paintMap,
        markerMap: composeMarkerMaps(
          gobanProps.markerMap,
          territoryPaintLayer.markerMap,
          territoryDiffLayer.markerMap,
        ),
        highlightVertices:
          territoryMode &&
          territoryPaintLayer.hoveredRegion != null &&
          hoveredAnalysisVertex == null
            ? territoryPaintLayer.hoveredRegion.vertices
            : gobanProps.highlightVertices,
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
      h(OverlayStatusBar, {
        territoryMode,
        unavailableReason:
          hoverPending && unavailableReason == null
            ? 'Loading territory diff preview...'
            : unavailableReason,
        territorySummary: territoryPaintLayer.territorySummary,
        hoveredRegion: territoryPaintLayer.hoveredRegion,
        deltaSummary: territoryDiffLayer.deltaSummary,
        hoveredDelta: territoryDiffLayer.hoveredDelta,
        hoveredRegionDeltaSummary: territoryDiffLayer.hoveredRegionDeltaSummary,
        diffSourceType: activeDiffSourceType,
      }),
    )
  }
}
