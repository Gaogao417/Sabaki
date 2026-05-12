/**
 * Pure overlay composition: given a normalized ResolvedOverlayInput, compute
 * the territory paint, diff markers, blended paint map, composed marker map,
 * status props, and CSS class name.
 *
 * Uses OVERLAY_LAYERS from overlayLayers.ts for layer definitions.
 * Does NOT import from components/.
 * Does NOT import sabaki.js, read global state, or produce side effects.
 */

import type {
  ResolvedOverlayInput,
  PaintMap,
  MarkerMap,
  OwnershipGrid,
  Vertex,
  MetricTotals,
} from './resolveOverlayInput.ts'

import {composeMarkerMaps} from './compose.js'
import {OVERLAY_LAYERS} from './overlayLayers.ts'
import {
  buildTerritoryPaintMap,
  buildTerritoryRegions,
  buildTerritorySummary,
  getRegionAtVertex,
} from './territory.js'
import {
  buildCompareTerritoryMarkerMap,
  buildOwnershipDeltaSummary,
  getDeltaAtVertex,
  summarizeCompareTerritoryRegion,
} from './territoryDiff.js'
import {getOwnershipDelta} from '../utils.js'

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type TerritoryRegionStats = {
  id: number
  owner: string
  sign: number
  vertices: Vertex[]
  total: MetricTotals
  solid: MetricTotals
  influence: MetricTotals
}

export type TerritorySummary = {
  black: {
    owner: string
    total: MetricTotals
    solid: MetricTotals
    influence: MetricTotals
    neutral: MetricTotals
  }
  white: {
    owner: string
    total: MetricTotals
    solid: MetricTotals
    influence: MetricTotals
    neutral: MetricTotals
  }
  neutral: {
    owner: string
    total: MetricTotals
    solid: MetricTotals
    influence: MetricTotals
    neutral: MetricTotals
  }
}

export type DeltaSummary = {
  black: MetricTotals
  white: MetricTotals
}

export type OverlayStatusProps = {
  territoryMode: boolean
  unavailableReason: string | null
  hoverPending: boolean
  territorySummary: TerritorySummary | null
  hoveredRegion: TerritoryRegionStats | null
  hoveredVertex: Vertex | null
  deltaSummary: DeltaSummary | null
  hoveredDelta: number | null
  hoveredRegionDeltaSummary: DeltaSummary | null
  diffSourceType: string | null
  keyPointSummary: ResolvedOverlayInput['keyPointSummary']
}

export type WorkbenchOverlayComposition = {
  /** Composed paint map for Goban, or the original base paint map. */
  paintMap: PaintMap | null | undefined

  /** Composed marker map for Goban, or null. */
  markerMap: MarkerMap | null

  /** Status props for OverlayStatusBar, or null if territory mode off. */
  statusProps: OverlayStatusProps | null

  /** CSS class name for the Goban element. */
  className: string

  /** Active layer IDs from OVERLAY_LAYERS, sorted by priority. */
  layers: string[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type PaintLayer = {
  paintMap: PaintMap | null
  markerMap: MarkerMap | null
  territorySummary: TerritorySummary | null
  hoveredRegion: TerritoryRegionStats | null
}

type DiffLayer = {
  markerMap: MarkerMap | null
  deltaSummary: DeltaSummary | null
  hoveredDelta: number | null
  hoveredRegionDeltaSummary: DeltaSummary | null
}

function computePaintLayer(
  ownership: OwnershipGrid | null,
  hoveredVertex: Vertex | null,
): PaintLayer {
  if (ownership == null) {
    return {
      paintMap: null,
      markerMap: null,
      territorySummary: null,
      hoveredRegion: null,
    }
  }

  let territoryRegions = buildTerritoryRegions(ownership)

  return {
    paintMap: buildTerritoryPaintMap(ownership),
    markerMap: null,
    territorySummary: buildTerritorySummary(ownership),
    hoveredRegion: getRegionAtVertex(territoryRegions, hoveredVertex),
  }
}

function computeDiffLayer(
  deltaMap: number[][] | null,
  hoveredVertex: Vertex | null,
  hoveredRegion: TerritoryRegionStats | null,
): DiffLayer {
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

function blendPaintMap(
  territoryPaint: PaintMap | null | undefined,
  basePaint: PaintMap | null | undefined,
): PaintMap | null | undefined {
  if (territoryPaint == null) return basePaint

  return territoryPaint.map((row, y) =>
    row.map((value, x) => {
      let areaValue = basePaint?.[y]?.[x] ?? 0
      if (areaValue >= 0) return value
      return value === 0 ? areaValue : value * 0.55
    }),
  )
}

// ---------------------------------------------------------------------------
// Main composition function
// ---------------------------------------------------------------------------

/**
 * Pure composition: given a normalized overlay input, produce the final
 * paint map, marker map, status props, CSS class, and active layer list.
 * Layer IDs come from OVERLAY_LAYERS, sorted by priority.
 */
export function composeWorkbenchOverlays(
  input: ResolvedOverlayInput,
): WorkbenchOverlayComposition {
  if (!input.territoryMode) {
    return {
      paintMap: input.basePaintMap,
      markerMap: input.baseMarkerMap ?? null,
      statusProps: null,
      className: '',
      layers: [],
    }
  }

  let active = input.unavailableReason == null

  // Territory paint layer
  let territoryPaintLayer: PaintLayer
  if (active) {
    territoryPaintLayer = computePaintLayer(
      input.baselineOwnership,
      input.hoveredVertex,
    )
  } else {
    territoryPaintLayer = {
      paintMap: null,
      markerMap: null,
      territorySummary: null,
      hoveredRegion: null,
    }
  }

  // Hover delta takes priority over last-move delta
  let hoverDeltaMap =
    input.baselineOwnership != null && input.hoverOwnership != null
      ? getOwnershipDelta(input.baselineOwnership, input.hoverOwnership)
      : null

  let activeDeltaMap = hoverDeltaMap ?? input.lastMoveDeltaMap
  let activeDiffSourceType =
    hoverDeltaMap != null
      ? 'hover'
      : input.lastMoveDiffAvailable && input.lastMoveDeltaMap != null
        ? input.diffSourceType
        : null

  // Territory diff layer
  let territoryDiffLayer: DiffLayer
  if (active) {
    territoryDiffLayer = computeDiffLayer(
      activeDeltaMap,
      input.hoveredVertex,
      territoryPaintLayer.hoveredRegion,
    )
  } else {
    territoryDiffLayer = {
      markerMap: null,
      deltaSummary: null,
      hoveredDelta: null,
      hoveredRegionDeltaSummary: null,
    }
  }

  // Paint map: blend territory paint with base area paint
  let paintMap: PaintMap | null | undefined
  if (active && territoryPaintLayer.paintMap != null) {
    paintMap = blendPaintMap(territoryPaintLayer.paintMap, input.basePaintMap)
  } else {
    paintMap = input.basePaintMap
  }

  // Marker map: compose base + territory + diff
  let markerMap = composeMarkerMaps(
    input.baseMarkerMap,
    territoryPaintLayer.markerMap,
    territoryDiffLayer.markerMap,
  )

  // Status props
  let statusProps: OverlayStatusProps = {
    territoryMode: true,
    unavailableReason: input.unavailableReason,
    hoverPending: input.hoverPending,
    territorySummary: territoryPaintLayer.territorySummary,
    hoveredRegion: territoryPaintLayer.hoveredRegion,
    hoveredVertex: input.hoveredVertex,
    deltaSummary: territoryDiffLayer.deltaSummary,
    hoveredDelta: territoryDiffLayer.hoveredDelta,
    hoveredRegionDeltaSummary: territoryDiffLayer.hoveredRegionDeltaSummary,
    diffSourceType: activeDiffSourceType,
    keyPointSummary: input.keyPointSummary,
  }

  // Build layers from OVERLAY_LAYERS sorted by priority, filtered to active ones
  let activeLayerIds: string[] = []
  if (active && territoryPaintLayer.paintMap != null) {
    activeLayerIds.push('ownership-paint')
  }
  if (active && territoryDiffLayer.markerMap != null) {
    activeLayerIds.push('territory-diff-marker')
  }

  // Goban-channel layers (not rendered by composeWorkbenchOverlays itself,
  // but tracked for layer awareness)
  if (input.heatmapActive) {
    activeLayerIds.push('heatmap')
  }
  if (input.humanPreferenceActive) {
    activeLayerIds.push('human-preference')
  }

  // Sort by OVERLAY_LAYERS priority
  let priorityMap = new Map(
    OVERLAY_LAYERS.map((l) => [l.id, l.priority]),
  )
  activeLayerIds.sort(
    (a, b) => (priorityMap.get(a) ?? 0) - (priorityMap.get(b) ?? 0),
  )

  return {
    paintMap,
    markerMap,
    statusProps,
    className: 'territory-mode',
    layers: activeLayerIds,
  }
}
