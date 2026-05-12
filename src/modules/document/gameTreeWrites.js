import sgf from '@sabaki/sgf'
import * as gametree from '../gametree.js'
import * as helper from '../helper.js'

/**
 * Append a move node to the game tree and return the mutated tree plus
 * the new tree position.
 *
 * @param {object} tree - immutable game tree
 * @param {string} treePosition - current node id
 * @param {number[]} vertex - [x, y]
 * @param {number} player - 1 (black) or -1 (white)
 * @returns {{newTree: object, nextTreePosition: string, createNode: boolean}}
 */
export function appendMoveNode(tree, treePosition, vertex, player) {
  let color = player > 0 ? 'B' : 'W'
  let nextTreePosition

  let newTree = tree.mutate((draft) => {
    nextTreePosition = draft.appendNode(treePosition, {
      [color]: [sgf.stringifyVertex(vertex)],
    })
  })

  let createNode = tree.get(nextTreePosition) == null

  return {newTree, nextTreePosition, createNode}
}

/**
 * Detect ko: does the move reproduce the position two moves back?
 *
 * @param {object} tree
 * @param {string} treePosition
 * @param {object} board - @sabaki/go-board Board
 * @param {number} player
 * @param {number[]} vertex
 * @returns {boolean}
 */
export function detectKo(tree, treePosition, board, player, vertex) {
  let node = tree.get(treePosition)
  if (node.parentId == null) return false

  let prev = tree.get(node.parentId)
  if (prev == null) return false

  let nextBoard = board.makeMove(player, vertex)
  let prevBoard = gametree.getBoard(tree, prev.id)

  return helper.equals(prevBoard.signMap, nextBoard.signMap)
}

/**
 * Detect whether the previous move was a pass of the opposite color.
 * Used to recognise consecutive double-pass situations.
 *
 * @param {object} tree
 * @param {string} treePosition - current node (before the new move is appended)
 * @param {string} color - 'B' or 'W', the color of the move being played
 * @returns {boolean}
 */
export function detectPrevPass(tree, treePosition, color) {
  let node = tree.get(treePosition)
  let prevColor = color === 'B' ? 'W' : 'B'

  return node.data[prevColor] != null && node.data[prevColor][0] === ''
}
