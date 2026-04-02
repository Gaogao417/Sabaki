import {
  buildTerritoryMarkerMap,
  buildTerritoryPaintMap,
  buildTerritoryRegions,
  buildTerritorySummary,
  getRegionAtVertex,
} from '../../modules/overlays/territory.js'

export function getTerritoryPaintLayer(ownership, hoveredVertex) {
  if (ownership == null) {
    return {
      paintMap: null,
      markerMap: null,
      territoryRegions: null,
      territorySummary: null,
      hoveredRegion: null,
    }
  }

  let territoryRegions = buildTerritoryRegions(ownership)

  return {
    paintMap: buildTerritoryPaintMap(ownership),
    markerMap: buildTerritoryMarkerMap(ownership),
    territoryRegions,
    territorySummary: buildTerritorySummary(ownership),
    hoveredRegion: getRegionAtVertex(territoryRegions, hoveredVertex),
  }
}
