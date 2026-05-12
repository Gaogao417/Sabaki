/**
 * Canonical overlay layer contract definitions.
 *
 * Each layer declares its data source, render mode, priority (higher = on top),
 * and which visual channels it feeds. workbench/contracts/overlayLayers.ts
 * re-exports these for backward compatibility.
 */

// ---------------------------------------------------------------------------
// Data source types
// ---------------------------------------------------------------------------

export const OVERLAY_LAYER_SOURCES = Object.freeze({
  OWNERSHIP: 'ownership',
  TERRITORY_DIFF: 'territoryDiff',
  HEATMAP: 'heatmap',
  HUMAN_PREFERENCE: 'humanPreference',
} as const)

export type OverlayLayerSource =
  | 'ownership'
  | 'territoryDiff'
  | 'heatmap'
  | 'humanPreference'

// ---------------------------------------------------------------------------
// Render modes
// ---------------------------------------------------------------------------

export const OVERLAY_RENDER_MODES = Object.freeze({
  PAINT: 'paint',
  MARKER: 'marker',
  TOOLTIP: 'tooltip',
  SIDEBAR: 'sidebar',
} as const)

export type OverlayRenderMode = 'paint' | 'marker' | 'tooltip' | 'sidebar'

// ---------------------------------------------------------------------------
// Visual channels
// ---------------------------------------------------------------------------

/**
 * Which rendering pipeline a layer feeds into.
 *
 * - paint   → Goban paintMap (per-vertex color intensity)
 * - marker  → Goban markerMap (circles, labels, points)
 * - status  → OverlayStatusBar text/metrics
 * - goban   → Goban internal rendering (heatmap, humanPolicyMap)
 *             Declared but NOT extracted from Goban in Phase 11.
 */
export type OverlayVisualChannel = 'paint' | 'marker' | 'status' | 'goban'

// ---------------------------------------------------------------------------
// Layer definition
// ---------------------------------------------------------------------------

export type OverlayLayer = {
  id: string
  priority: number
  opacity: number
  hitTest: boolean
  source: OverlayLayerSource
  renderMode: OverlayRenderMode
  channels: readonly OverlayVisualChannel[]
}

/**
 * Canonical layer ordering. Higher priority values render on top.
 * Priority 0 = base (goban paint/marker from MainView).
 */
export const OVERLAY_LAYERS: readonly OverlayLayer[] = [
  {
    id: 'ownership-paint',
    priority: 10,
    opacity: 1,
    hitTest: true,
    source: 'ownership',
    renderMode: 'paint',
    channels: ['paint', 'status'],
  },
  {
    id: 'territory-diff-marker',
    priority: 20,
    opacity: 1,
    hitTest: true,
    source: 'territoryDiff',
    renderMode: 'marker',
    channels: ['marker', 'status'],
  },
  {
    id: 'heatmap',
    priority: 30,
    opacity: 1,
    hitTest: false,
    source: 'heatmap',
    renderMode: 'paint',
    channels: ['goban'],
  },
  {
    id: 'human-preference',
    priority: 40,
    opacity: 1,
    hitTest: false,
    source: 'humanPreference',
    renderMode: 'marker',
    channels: ['goban'],
  },
] as const
