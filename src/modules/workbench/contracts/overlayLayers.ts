/**
 * Compat re-export from the canonical overlay layer contract.
 * All new code should import from src/modules/overlays/overlayLayers.ts directly.
 */
export {
  OVERLAY_LAYER_SOURCES,
  OVERLAY_LAYERS,
  OVERLAY_RENDER_MODES,
} from '../../overlays/overlayLayers.ts'

export type {
  OverlayLayer,
  OverlayLayerSource,
  OverlayRenderMode,
  OverlayVisualChannel,
} from '../../overlays/overlayLayers.ts'
