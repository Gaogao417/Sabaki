import {getAnalysisVariationAtVertex} from '../../modules/overlays/analysisPreview.js'

export function getAnalysisLayerHover(analysis, vertex) {
  let variation = getAnalysisVariationAtVertex(analysis, vertex)

  return {
    hoveredVertex: variation != null ? vertex : null,
    hoveredVariation: variation,
  }
}
