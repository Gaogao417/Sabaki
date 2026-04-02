import sgf from '@sabaki/sgf'

import * as helper from './helper.js'

export function buildCompareRenderData(deltaMap, preset) {
  if (deltaMap == null || deltaMap.length === 0) {
    return {paintMap: null, markerMap: null}
  }

  let height = deltaMap.length
  let width = deltaMap[0].length
  let paintMap = helper.makeMatrix(width, height, 0)
  let markerMap = helper.makeMatrix(width, height, null)
  let labelThreshold = 0.15

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let delta = deltaMap[y][x]
      let absDelta = Math.abs(delta)
      if (absDelta < labelThreshold) continue

      if (preset === 'focus') {
        if (absDelta < 0.3) continue
        paintMap[y][x] = Math.sign(delta) * (absDelta >= 0.5 ? 1 : 0.55)
      } else {
        let strength =
          absDelta >= 0.5 ? 1 : absDelta >= 0.3 ? 0.7 : 0.4
        paintMap[y][x] = Math.sign(delta) * strength
      }

      if (preset === 'numbers') {
        markerMap[y][x] = {
          type: 'label',
          label: `${delta > 0 ? '+' : ''}${Math.round(delta * 100)}`,
        }
      }
    }
  }

  return {paintMap, markerMap}
}

export function getNodeMoveVertex(tree, treePosition) {
  let node = tree.get(treePosition)
  if (node == null) return null

  let move = node.data.B?.[0] ?? node.data.W?.[0]
  if (move == null || move === '') return null

  return sgf.parseVertex(move)
}
