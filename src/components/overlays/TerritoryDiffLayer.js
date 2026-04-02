import {
  buildCompareTerritoryMarkerMap,
  buildOwnershipDeltaSummary,
  getDeltaAtVertex,
  summarizeCompareTerritoryRegion,
} from '../../modules/overlays/territoryDiff.js'

export function getTerritoryDiffLayer({
  ownership,
  deltaMap,
  hoveredVertex,
  hoveredRegion,
}) {
  if (ownership == null || deltaMap == null) {
    return {
      markerMap: null,
      deltaSummary: null,
      hoveredDelta: null,
      hoveredRegionDeltaSummary: null,
    }
  }

  return {
    markerMap: buildCompareTerritoryMarkerMap(ownership, deltaMap),
    deltaSummary: buildOwnershipDeltaSummary(deltaMap),
    hoveredDelta: getDeltaAtVertex(deltaMap, hoveredVertex),
    hoveredRegionDeltaSummary: summarizeCompareTerritoryRegion(
      hoveredRegion,
      deltaMap,
    ),
  }
}
