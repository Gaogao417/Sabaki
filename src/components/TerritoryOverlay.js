import {h, Fragment, Component} from 'preact'

import Goban from './Goban.js'
import OverlayStatusBar from './OverlayStatusBar.js'

import {
  buildTerritoryMarkerMap,
  buildTerritoryPaintMap,
  buildTerritoryRegions,
  buildTerritorySummary,
  getRegionAtVertex,
} from '../modules/territory.js'

export default class TerritoryOverlay extends Component {
  componentWillReceiveProps(nextProps) {
    if (
      nextProps.ownership !== this.props.ownership ||
      nextProps.unavailableReason !== this.props.unavailableReason ||
      nextProps.gobanProps.treePosition !== this.props.gobanProps.treePosition
    ) {
      this.setState({hoveredVertex: null})
    }
  }

  render(
    {overlayMode, ownership, unavailableReason = null, gobanProps},
    {hoveredVertex = null},
  ) {
    let territorySummary = null
    let territoryRegions = null
    let hoveredRegion = null
    let paintMap = gobanProps.paintMap
    let markerMap = gobanProps.markerMap

    if (unavailableReason == null && ownership != null) {
      paintMap = buildTerritoryPaintMap(ownership)
      markerMap = buildTerritoryMarkerMap(ownership)
      territorySummary = buildTerritorySummary(ownership)
      territoryRegions = buildTerritoryRegions(ownership)
      hoveredRegion = getRegionAtVertex(territoryRegions, hoveredVertex)
    }

    return h(
      Fragment,
      null,
      h(Goban, {
        ...gobanProps,
        className: 'territory-mode',
        paintMap,
        markerMap,
        highlightVertices:
          hoveredRegion != null
            ? hoveredRegion.vertices
            : gobanProps.highlightVertices,
        onVertexMouseMove: ({vertex}) => this.setState({hoveredVertex: vertex}),
        onVertexMouseEnter: ({vertex}) =>
          this.setState({hoveredVertex: vertex}),
        onVertexMouseLeave: () => this.setState({hoveredVertex: null}),
      }),
      h(OverlayStatusBar, {
        overlayMode,
        territorySummary,
        hoveredRegion,
        unavailableReason,
      }),
    )
  }
}
