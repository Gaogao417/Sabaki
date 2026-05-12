import {fromDimensions as newBoard} from '@sabaki/go-board'
import {cloneMatrix} from '../../utils.js'
import {cloneWorkingPosition} from './workingPosition.js'

/**
 * @typedef {import('../contracts/positionSource.ts').ScratchPosition} WorkingPosition
 * @typedef {import('../contracts/positionSource.ts').ScratchRole} ScratchRole
 * @typedef {import('../contracts/positionSource.ts').ScratchPositionOrigin} ScratchPositionOrigin
 */

/**
 * Convert a working position to a go-board Board instance.
 * The board receives markers, lines, childrenInfo, siblingsInfo
 * extensions to match the shape produced by study.js boardFromSnapshot.
 *
 * @param {WorkingPosition} position
 * @returns {object|null}
 */
export function workingPositionToBoard(position) {
  if (position == null) return null

  let board = newBoard(position.width, position.height)

  for (let y = 0; y < position.height; y++) {
    for (let x = 0; x < position.width; x++) {
      board.set([x, y], position.signMap[y][x])
    }
  }

  Object.assign(board, {
    markers: board.signMap.map((row) => row.map(() => null)),
    lines: [],
    childrenInfo: [],
    siblingsInfo: [],
  })

  return board
}

/**
 * Create a working position from a Board instance.
 *
 * @param {object} board - A @sabaki/go-board Board instance
 * @param {{id: string, nextPlayer?: number, role?: ScratchRole, komi?: number, rules?: string, source?: ScratchPositionOrigin}} options
 * @returns {WorkingPosition}
 */
export function createWorkingPositionFromBoard(board, {id, nextPlayer = 1, role, komi, rules, source}) {
  return {
    id,
    width: board.width,
    height: board.height,
    signMap: cloneMatrix(board.signMap),
    nextPlayer: nextPlayer === -1 ? -1 : 1,
    ...(role != null ? {role} : {}),
    ...(komi != null ? {komi} : {}),
    ...(rules != null ? {rules} : {}),
    ...(source != null ? {source: {...source}} : {}),
  }
}

/**
 * Place a black stone at the given vertex. Applies auto-capture rules
 * via board.makeMove. Returns a new working position; does not modify
 * the input. Does not toggle nextPlayer.
 *
 * @param {WorkingPosition} position
 * @param {number[]} vertex - [x, y]
 * @returns {WorkingPosition}
 */
export function placeBlackStone(position, vertex) {
  return placeStone(position, 1, vertex)
}

/**
 * Place a white stone at the given vertex. Applies auto-capture rules
 * via board.makeMove. Returns a new working position; does not modify
 * the input. Does not toggle nextPlayer.
 *
 * @param {WorkingPosition} position
 * @param {number[]} vertex - [x, y]
 * @returns {WorkingPosition}
 */
export function placeWhiteStone(position, vertex) {
  return placeStone(position, -1, vertex)
}

/**
 * Erase the stone at the given vertex (set to 0).
 * Returns a new working position; does not modify the input.
 *
 * @param {WorkingPosition} position
 * @param {number[]} vertex - [x, y]
 * @returns {WorkingPosition}
 */
export function eraseWorkingStone(position, vertex) {
  let result = cloneWorkingPosition(position)
  let [x, y] = vertex
  result.signMap[y] = [...result.signMap[y]]
  result.signMap[y][x] = 0
  return result
}

/**
 * Update nextPlayer on a working position. sign > 0 normalizes to 1,
 * otherwise -1. Returns a new working position; does not modify the input.
 *
 * @param {WorkingPosition} position
 * @param {number} sign
 * @returns {WorkingPosition}
 */
export function setWorkingNextPlayer(position, sign) {
  let result = cloneWorkingPosition(position)
  result.nextPlayer = sign > 0 ? 1 : -1
  return result
}

// --- internal ---

function placeStone(position, sign, vertex) {
  let board = workingPositionToBoard(position)
  board = board.makeMove(sign, vertex)

  let result = cloneWorkingPosition(position)
  result.signMap = cloneMatrix(board.signMap)
  return result
}
