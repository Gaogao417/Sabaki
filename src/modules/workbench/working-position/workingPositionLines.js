/**
 * Line/arrow helpers for working positions.
 *
 * Lines are stored as arrays of `{v1, v2, type}` objects where
 * v1/v2 are [x, y] vertices and type is 'line' | 'arrow'.
 * These helpers never modify the input array — they return a new array.
 */

/**
 * Add a line or arrow to the lines array.
 *
 * @param {Array<{v1: number[], v2: number[], type: string}>} lines
 * @param {number[]} v1 - start vertex [x, y]
 * @param {number[]} v2 - end vertex [x, y]
 * @param {string} lineType - 'line' | 'arrow'
 * @returns {Array<{v1: number[], v2: number[], type: string}>}
 */
export function addLine(lines, v1, v2, lineType) {
  return [...lines, {v1, v2, type: lineType}]
}

/**
 * Remove a line/arrow by index.
 *
 * @param {Array<{v1: number[], v2: number[], type: string}>} lines
 * @param {number} index
 * @returns {Array<{v1: number[], v2: number[], type: string}>}
 */
export function removeLineAt(lines, index) {
  return lines.filter((_, i) => i !== index)
}

/**
 * Create an empty lines array.
 *
 * @returns {Array<never>}
 */
export function createEmptyLines() {
  return []
}
