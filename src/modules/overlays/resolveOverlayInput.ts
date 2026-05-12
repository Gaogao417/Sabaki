/**
 * Overlay input resolution: raw facts → normalized overlay input.
 *
 * resolveOverlayInput takes raw overlay facts from App.js / component state
 * (mode, workspace, ownership data, hover state) and produces a flat,
 * serializable ResolvedOverlayInput with all derivation decisions made:
 * which ownership is active, whether compare is available, why overlay
 * is unavailable, which layers are active.
 *
 * It does NOT read sabaki.state, import sabaki.js, or produce side effects.
 */

import {getOwnershipDelta} from '../utils.js'
import {OVERLAY_LAYERS, type OverlayLayer} from './overlayLayers.ts'

// ---------------------------------------------------------------------------
// Board-domain types (mirrored here so overlay modules stay self-contained)
// ---------------------------------------------------------------------------

export type Vertex = [number, number]

/** Per-vertex ownership in [-1, 1]. Positive = black, negative = white. */
export type OwnershipGrid = number[][]

/** Per-vertex ownership delta. */
export type DeltaGrid = number[][]

/** Per-vertex paint intensity for Goban paintMap. */
export type PaintMap = number[][]

/** Per-vertex marker for Goban markerMap. */
export type MarkerMap = (null | {type: string; label?: string})[][]

// ---------------------------------------------------------------------------
// Key point summary (passed through from App.js)
// ---------------------------------------------------------------------------

export type MetricTotals = {
  sum: number
  intersections: number
}

export type KeyPointSummary = {
  blackGain: MetricTotals
  whiteGain: MetricTotals
}

// ---------------------------------------------------------------------------
// Unavailable reason codes (finite set; translation lives in UI components)
// ---------------------------------------------------------------------------

export type UnavailableReason =
  | 'scoring-or-estimator'
  | 'analysis-engine-required'
  | 'ownership-pending'
  | 'ownership-unavailable'

// ---------------------------------------------------------------------------
// Raw overlay input (facts from App.js / component state)
// ---------------------------------------------------------------------------

/**
 * Raw facts that the caller must provide. No derivation decisions here —
 * just the ground truth about app state and ownership data.
 */
export type RawOverlayInput = {
  /** Whether territory overlay is requested by the user. */
  territoryMode: boolean

  /** Current app mode ('play', 'analysis', 'scoring', 'estimator', etc.). */
  appMode: string

  /** Whether the edit workspace is active. */
  editWorkspaceActive: boolean

  /** Whether territory compare is active (user toggled it on). */
  territoryCompareActive: boolean

  /** Active edit tab: 'current' | 'reference' | null. */
  editActiveTab: string | null

  /** Whether analysis is pending in the edit workspace. */
  analysisPending: boolean

  /** Engine syncer available (non-null when an engine is attached). */
  engineSyncerAvailable: boolean

  /** Analysis data for the current position, or null. */
  activeAnalysis: {ownership?: number[][] | null} | null

  /** Whether analysis tree position matches current tree position. */
  analysisTreePositionMatches: boolean

  /** Ownership from the engine analysis cache, or null. */
  gameTreeOwnership: OwnershipGrid | null

  /** Edit workspace: current tab ownership, or null. */
  editCurrentOwnership: OwnershipGrid | null

  /** Edit workspace: reference tab ownership, or null. */
  editReferenceOwnership: OwnershipGrid | null

  /** Edit workspace: current ownership (for compare), or null. */
  editWorkspaceCurrentOwnership: OwnershipGrid | null

  /** Edit workspace: reference ownership (for compare), or null. */
  editWorkspaceReferenceOwnership: OwnershipGrid | null

  /** Edit workspace: preview ownership, or null. */
  editPreviewOwnership: OwnershipGrid | null

  /** Key point summary for status bar, or null. */
  keyPointSummary: KeyPointSummary | null

  /** Hovered vertex from component state. */
  hoveredVertex: Vertex | null

  /** Hover ownership preview, or null. */
  hoverOwnership: OwnershipGrid | null

  /** Whether hover preview is pending (async). */
  hoverPending: boolean

  /** Base paint map from gobanProps (scoring, guess, area). */
  basePaintMap: PaintMap | null | undefined

  /** Base marker map from gobanProps. */
  baseMarkerMap: MarkerMap | null | undefined

  /** Whether heatmap goban layer should be active. */
  heatmapActive: boolean

  /** Whether human preference goban layer should be active. */
  humanPreferenceActive: boolean
}

// ---------------------------------------------------------------------------
// Resolved overlay input (derivation decisions made)
// ---------------------------------------------------------------------------

/**
 * Normalized overlay input. Contains no component state, no sabaki instance,
 * no Preact refs. All data is serializable. All derivation decisions are made.
 */
export type ResolvedOverlayInput = {
  /** Whether any overlay mode is active (territoryEnabled || territoryCompareEnabled). */
  territoryMode: boolean

  /** Reason overlay cannot be displayed (code), or null if available. */
  unavailableReason: UnavailableReason | null

  /** Baseline ownership grid (from KataGo analysis), or null. */
  baselineOwnership: OwnershipGrid | null

  /** Delta map for last-move or comparison diff, or null. */
  lastMoveDeltaMap: DeltaGrid | null

  /** Whether lastMoveDeltaMap represents a real diff. */
  lastMoveDiffAvailable: boolean

  /** Source of the diff: 'hover' | 'previous' | 'reference' | 'workspace' | null. */
  diffSourceType: string | null

  /** Comparison ownership (current ownership in compare mode), or null. */
  comparisonOwnership: OwnershipGrid | null

  /** Key point summary for status bar, or null. */
  keyPointSummary: KeyPointSummary | null

  /** Hovered vertex from component state. */
  hoveredVertex: Vertex | null

  /** Hover ownership preview, or null. */
  hoverOwnership: OwnershipGrid | null

  /** Whether hover preview is pending (async). */
  hoverPending: boolean

  /** Base paint map from gobanProps (scoring, guess, area). */
  basePaintMap: PaintMap | null | undefined

  /** Base marker map from gobanProps. */
  baseMarkerMap: MarkerMap | null | undefined

  /** Active overlay layer IDs sorted by priority. */
  activeLayerIds: string[]

  /** Whether heatmap goban layer is active. */
  heatmapActive: boolean

  /** Whether human preference goban layer is active. */
  humanPreferenceActive: boolean
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

function computeUnavailableReason(
  raw: RawOverlayInput,
  baselineOwnership: OwnershipGrid | null,
): UnavailableReason | null {
  if (['scoring', 'estimator'].includes(raw.appMode)) {
    return 'scoring-or-estimator'
  }

  if (!raw.engineSyncerAvailable) {
    return 'analysis-engine-required'
  }

  if (
    raw.editWorkspaceActive &&
    raw.analysisPending &&
    (baselineOwnership == null ||
      (raw.territoryCompareActive && raw.editWorkspaceCurrentOwnership == null))
  ) {
    return 'ownership-pending'
  }

  if (
    raw.territoryCompareActive &&
    raw.editWorkspaceActive &&
    raw.editWorkspaceCurrentOwnership == null
  ) {
    return 'ownership-pending'
  }

  if (baselineOwnership == null) {
    if (
      !raw.analysisTreePositionMatches ||
      raw.activeAnalysis == null ||
      raw.activeAnalysis.ownership == null
    ) {
      return 'ownership-pending'
    }
    return 'ownership-unavailable'
  }

  return null
}

function computeBaselineOwnership(raw: RawOverlayInput): OwnershipGrid | null {
  if (raw.territoryCompareActive) {
    return raw.editWorkspaceReferenceOwnership
  }

  if (raw.editWorkspaceActive) {
    return raw.editCurrentOwnership
  }

  return raw.gameTreeOwnership
}

function computeComparisonOwnership(raw: RawOverlayInput): OwnershipGrid | null {
  if (!raw.editWorkspaceActive) return null

  return raw.territoryCompareActive
    ? raw.editWorkspaceCurrentOwnership
    : raw.editPreviewOwnership
}

function computeDeltaMap(raw: RawOverlayInput): {
  deltaMap: DeltaGrid | null
  diffAvailable: boolean
  diffSourceType: string | null
} {
  // Territory compare: reference → current delta
  if (
    raw.territoryCompareActive &&
    raw.editWorkspaceReferenceOwnership != null &&
    raw.editWorkspaceCurrentOwnership != null
  ) {
    let deltaMap = getOwnershipDelta(
      raw.editWorkspaceReferenceOwnership,
      raw.editWorkspaceCurrentOwnership,
    )
    return {
      deltaMap,
      diffAvailable: deltaMap != null,
      diffSourceType: deltaMap != null ? 'workspace' : null,
    }
  }

  return {deltaMap: null, diffAvailable: false, diffSourceType: null}
}

/**
 * Resolve raw overlay facts into a normalized ResolvedOverlayInput.
 *
 * This is the single point where derivation decisions are made:
 * - Which ownership is the active baseline
 * - Why the overlay is unavailable (structured reason code)
 * - Whether territory compare delta is available
 * - Which overlay layers are active
 */
export function resolveOverlayInput(raw: RawOverlayInput): ResolvedOverlayInput {
  if (!raw.territoryMode) {
    return {
      territoryMode: false,
      unavailableReason: null,
      baselineOwnership: null,
      lastMoveDeltaMap: null,
      lastMoveDiffAvailable: false,
      diffSourceType: null,
      comparisonOwnership: null,
      keyPointSummary: null,
      hoveredVertex: raw.hoveredVertex,
      hoverOwnership: raw.hoverOwnership,
      hoverPending: raw.hoverPending,
      basePaintMap: raw.basePaintMap,
      baseMarkerMap: raw.baseMarkerMap,
      activeLayerIds: [],
      heatmapActive: raw.heatmapActive ?? false,
      humanPreferenceActive: raw.humanPreferenceActive ?? false,
    }
  }

  let baselineOwnership = computeBaselineOwnership(raw)
  let unavailableReason = computeUnavailableReason(raw, baselineOwnership)
  let comparisonOwnership = computeComparisonOwnership(raw)
  let {deltaMap, diffAvailable, diffSourceType} = computeDeltaMap(raw)

  let active = unavailableReason == null

  // Build active layer IDs from OVERLAY_LAYERS
  let activeLayerIds: string[] = []
  if (active && baselineOwnership != null) {
    let ownershipLayer = OVERLAY_LAYERS.find(
      (l: OverlayLayer) => l.source === 'ownership',
    )
    if (ownershipLayer) activeLayerIds.push(ownershipLayer.id)
  }
  if (active && deltaMap != null) {
    let diffLayer = OVERLAY_LAYERS.find(
      (l: OverlayLayer) => l.source === 'territoryDiff',
    )
    if (diffLayer) activeLayerIds.push(diffLayer.id)
  }

  return {
    territoryMode: true,
    unavailableReason,
    baselineOwnership,
    lastMoveDeltaMap: deltaMap,
    lastMoveDiffAvailable: diffAvailable,
    diffSourceType,
    comparisonOwnership,
    keyPointSummary: raw.keyPointSummary,
    hoveredVertex: raw.hoveredVertex,
    hoverOwnership: raw.hoverOwnership,
    hoverPending: raw.hoverPending,
    basePaintMap: raw.basePaintMap,
    baseMarkerMap: raw.baseMarkerMap,
    activeLayerIds,
    heatmapActive: raw.heatmapActive ?? false,
    humanPreferenceActive: raw.humanPreferenceActive ?? false,
  }
}

// ---------------------------------------------------------------------------
// Territory compare availability helper
// ---------------------------------------------------------------------------

/**
 * Pure helper: check if territory compare is available based on app state.
 * Mirrors the logic in sabaki.getTerritoryCompareAvailable() but without
 * reading global state.
 */
export function getTerritoryCompareAvailability(input: {
  appMode: string
  editWorkspaceReferenceSnapshot: unknown
}): boolean {
  return (
    input.appMode === 'analysis' &&
    input.editWorkspaceReferenceSnapshot != null
  )
}
