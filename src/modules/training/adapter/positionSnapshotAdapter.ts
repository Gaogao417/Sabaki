/**
 * Captures current board position as a stable snapshot for training use.
 * Isolates training from direct gametree / board / documentStore dependencies.
 */

import sgf from '@sabaki/sgf'
import * as gametree from '../../gametree.js'

export type PositionSnapshot = {
  positionSgf: string
  sideToMove: 'black' | 'white'
  treePosition?: string
  moveNumber?: number
  positionHash: string
}

type SabakiLike = {
  state: { treePosition: string }
  getPlayServices(): {
    documentStore: {
      getCurrent(): {
        tree: { root: { data: Record<string, string[]> } }
        treePosition: string
      }
    }
  }
}

export type PositionSnapshotAdapter = {
  captureCurrentPosition(): PositionSnapshot
  captureBeforeMove(moveIndex: number): PositionSnapshot
  captureAfterMove(moveIndex: number): PositionSnapshot
}

function boardToSgf(board: { width: number; height: number; signMap: number[][]; nextPlayer: number }): string {
  let blackStones: string[] = []
  let whiteStones: string[] = []

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      let sign = board.signMap[y][x]
      let vertex = sgf.stringifyVertex([x, y])
      if (sign === 1) blackStones.push(vertex)
      else if (sign === -1) whiteStones.push(vertex)
    }
  }

  let properties: string[] = [`SZ[${board.width}]`]
  if (blackStones.length > 0) properties.push(`AB[${blackStones.join('][')}]`)
  if (whiteStones.length > 0) properties.push(`AW[${whiteStones.join('][')}]`)
  properties.push(`PL[${board.nextPlayer === 1 ? 'B' : 'W'}]`)

  return `(;${properties.join('')})`
}

function countMoveNumber(tree: { root: { data: Record<string, string[]> } }, treePosition: string): number {
  // Count nodes from root to treePosition to estimate move number.
  // This is a rough approximation — accurate for linear game lines.
  try {
    // @ts-expect-error — tree has navigate/list methods not in our type
    const nodes = tree.listNodesVertically?.(treePosition, -1, {})
    return nodes ? nodes.length - 1 : 0
  } catch {
    return 0
  }
}

export function createPositionSnapshotAdapter(sabaki: SabakiLike): PositionSnapshotAdapter {
  function captureAtPosition(treePosition: string): PositionSnapshot {
    const {tree} = sabaki.getPlayServices().documentStore.getCurrent()
    const board = gametree.getBoard(tree, treePosition)

    if (!board) {
      return {positionSgf: '', sideToMove: 'black', treePosition, moveNumber: 0, positionHash: ''}
    }

    return {
      positionSgf: boardToSgf(board),
      sideToMove: board.nextPlayer === 1 ? 'black' : 'white',
      treePosition,
      moveNumber: countMoveNumber(tree, treePosition),
      positionHash: `${board.width}x${board.height}:${board.signMap.map(r => r.join('')).join('/')}`,
    }
  }

  return {
    captureCurrentPosition() {
      let treePosition = sabaki.state.treePosition
      return captureAtPosition(treePosition)
    },

    captureBeforeMove(moveIndex: number): PositionSnapshot {
      return this.captureCurrentPosition()
    },

    captureAfterMove(moveIndex: number): PositionSnapshot {
      return this.captureCurrentPosition()
    },
  }
}
