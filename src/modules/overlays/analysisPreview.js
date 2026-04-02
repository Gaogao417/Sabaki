import sgf from '@sabaki/sgf'

export function getAnalysisVariationAtVertex(analysis, vertex) {
  if (analysis == null || vertex == null) return null

  return (
    analysis.variations.find(
      ({vertex: candidate}) =>
        candidate != null &&
        candidate[0] === vertex[0] &&
        candidate[1] === vertex[1],
    ) || null
  )
}

export function getAnalysisPreviewCacheKey(tree, treePosition, moves) {
  if (tree == null || treePosition == null || !Array.isArray(moves) || moves.length === 0) {
    return null
  }

  let signature = moves
    .map((vertex) => sgf.stringifyVertex(vertex))
    .join(',')

  return [tree.root.id, treePosition, signature].join(':')
}
