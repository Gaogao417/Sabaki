import {
  buildCompareTerritoryMarkerMap,
  buildOwnershipDeltaSummary,
  getDeltaAtVertex,
  summarizeCompareTerritoryRegion,
} from '../../modules/overlays/territoryDiff.js'

export function getTerritoryDiffLayer({
  deltaMap,
  hoveredVertex,
  hoveredRegion,
}) {
  if (deltaMap == null) {
    return {
      markerMap: null,
      deltaSummary: null,
      hoveredDelta: null,
      hoveredRegionDeltaSummary: null,
    }
  }

  return {
    markerMap: buildCompareTerritoryMarkerMap(deltaMap),
    deltaSummary: buildOwnershipDeltaSummary(deltaMap),
    hoveredDelta: getDeltaAtVertex(deltaMap, hoveredVertex),
    hoveredRegionDeltaSummary: summarizeCompareTerritoryRegion(
      hoveredRegion,
      deltaMap,
    ),
  }
}
