/**
 * Marker map helpers for working positions.
 *
 * Marker maps are 2D arrays parallel to signMap, where each cell is
 * `{type: string, label?: string} | null`. Marker operations never modify
 * the input map — they return a cloned copy.
 */

/**
 * Toggle a shape marker (cross, triangle, square, circle) at a vertex.
 * If the same marker type exists, it is removed; otherwise it is placed.
 *
 * @param {(null|{type: string, label?: string})[][]} markerMap
 * @param {number[]} vertex - [x, y]
 * @param {string} markerType - 'cross' | 'triangle' | 'square' | 'circle'
 * @returns {(null|{type: string, label?: string})[][]}
 */
export function toggleMarker(markerMap, vertex, markerType) {
  let [x, y] = vertex
  let updated = markerMap.map((row) => [...row])
  let existing = updated[y]?.[x]
  updated[y][x] =
    existing?.type === markerType ? null : {type: markerType}
  return updated
}

/**
 * Place a coordinate label marker (e.g. "A1", "B2") at a vertex.
 * Toggles off if the same label already exists.
 *
 * @param {(null|{type: string, label?: string})[][]} markerMap
 * @param {number[]} vertex - [x, y]
 * @param {number} boardHeight
 * @returns {(null|{type: string, label?: string})[][]}
 */
export function toggleCoordLabel(markerMap, vertex, boardHeight) {
  let [x, y] = vertex
  let alpha = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'
  let coordLabel = alpha[x] + (boardHeight - y)
  let updated = markerMap.map((row) => [...row])
  let existing = updated[y]?.[x]
  updated[y][x] =
    existing?.type === 'label' && existing.label === coordLabel
      ? null
      : {type: 'label', label: coordLabel}
  return updated
}

/**
 * Place or toggle a sequential number marker at a vertex.
 * If a number label already exists at the vertex, it is removed.
 * Otherwise, the next available positive integer is assigned.
 *
 * @param {(null|{type: string, label?: string})[][]} markerMap
 * @param {number[]} vertex - [x, y]
 * @returns {(null|{type: string, label?: string})[][]}
 */
export function toggleNumberLabel(markerMap, vertex) {
  let [x, y] = vertex
  let updated = markerMap.map((row) => [...row])
  let existing = updated[y]?.[x]
  let currentNum =
    existing?.type === 'label' ? parseInt(existing.label, 10) : 0

  if (currentNum > 0 && Number.isFinite(currentNum)) {
    updated[y][x] = null
  } else {
    let usedNums = new Set()
    for (let row of updated) {
      for (let cell of row) {
        if (cell?.type === 'label') {
          let n = parseInt(cell.label, 10)
          if (Number.isFinite(n) && n > 0) usedNums.add(n)
        }
      }
    }
    let next = 1
    while (usedNums.has(next)) next++
    updated[y][x] = {type: 'label', label: `${next}`}
  }

  return updated
}

/**
 * Create an empty marker map matching the given dimensions.
 *
 * @param {number} width
 * @param {number} height
 * @returns {null[][]}
 */
export function createEmptyMarkerMap(width, height) {
  return Array.from({length: height}, () => Array(width).fill(null))
}

/**
 * Set a custom label marker at a vertex.
 *
 * @param {(null|{type: string, label?: string})[][]} markerMap
 * @param {number[]} vertex - [x, y]
 * @param {string} label
 * @returns {(null|{type: string, label?: string})[][]}
 */
export function setLabelMarker(markerMap, vertex, label) {
  let [x, y] = vertex
  let updated = markerMap.map((row) => [...row])
  updated[y][x] = {type: 'label', label}
  return updated
}
