/**
 * Overlay data-source types - what kind of analysis data feeds an overlay layer.
 *
 * - OWNERSHIP - KataGo ownership percentages per vertex.
 * - TERRITORY_DIFF - Territory difference between current and reference snapshots.
 * - HEATMAP - AI candidate-move heatmap (policy probability distribution).
 * - HUMAN_PREFERENCE - HumanSL human-player preference map (policy distribution).
 *
 * Phase 5 (defined, not yet imported): These values exist in the codebase as raw
 * strings (enginesyncer.js, Goban.js, sabaki.js) but are not yet referenced
 * through this constant. Will be wired up when the overlay composition layer is
 * implemented.
 */
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

/**
 * Overlay rendering modes - how an overlay layer is visually presented on the board.
 *
 * - PAINT - Canvas fill with per-vertex colors (e.g. ownership heat colors).
 * - MARKER - Board markers such as candidate-point circles or move labels.
 * - TOOLTIP - Hover-triggered popup showing precise data for a single vertex.
 * - SIDEBAR - Data displayed in a side panel instead of on the board canvas.
 *
 * Phase 5 (defined, not yet imported): The current code uses different rendering
 * paths (paintMap / markerMap arrays, component props) rather than string dispatch.
 * Will be wired up when the overlay composition layer is implemented.
 */
export const OVERLAY_RENDER_MODES = Object.freeze({
  PAINT: 'paint',
  MARKER: 'marker',
  TOOLTIP: 'tooltip',
  SIDEBAR: 'sidebar',
} as const)

export type OverlayRenderMode = 'paint' | 'marker' | 'tooltip' | 'sidebar'

export type OverlayLayer = {
  id: string
  priority: number
  opacity: number
  hitTest: boolean
  source: OverlayLayerSource
  renderMode: OverlayRenderMode
}
