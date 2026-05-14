/**
 * Captures current board position as a stable snapshot for training use.
 *
 * Uses the existing study.js snapshot utilities under the hood.
 * Isolates training from direct gametree / board / documentStore dependencies.
 */

import {
  cloneSnapshot,
  createSnapshotFromBoard,
  serializeSnapshot,
  getSnapshotSignature,
} from '../../study.js'
import sgf from '@sabaki/sgf'

export type PositionSnapshot = {
  positionSgf: string
  sideToMove: 'black' | 'white'
  treePosition?: string
  moveNumber?: number
  positionHash: string
}

type DocumentStoreLike = {
  getCurrentTree(): unknown
  getCurrentTreePosition(): string
  getBoard(treePosition?: string): unknown
  getMoveNumber(treePosition?: string): number
}

type SabakiLike = {
  state: { treePosition: string }
  getPlayServices(): { documentStore: DocumentStoreLike }
}

export type PositionSnapshotAdapter = {
  captureCurrentPosition(): PositionSnapshot
  captureBeforeMove(moveIndex: number): PositionSnapshot
  captureAfterMove(moveIndex: number): PositionSnapshot
}

function boardToSgf(snapshot: { width: number; height: number; signMap: number[][]; nextPlayer: number }): string {
  // Serialize board signMap into SGF format (minimal: just board state as setup stones)
  let blackStones: string[] = []
  let whiteStones: string[] = []

  for (let y = 0; y < snapshot.height; y++) {
    for (let x = 0; x < snapshot.width; x++) {
      let sign = snapshot.signMap[y][x]
      let vertex = sgf.stringifyVertex([x, y])
      if (sign === 1) blackStones.push(vertex)
      else if (sign === -1) whiteStones.push(vertex)
    }
  }

  let properties: string[] = [`SZ[${snapshot.width}]`]
  if (blackStones.length > 0) properties.push(`AB[${blackStones.join('][')}]`)
  if (whiteStones.length > 0) properties.push(`AW[${whiteStones.join('][')}]`)
  properties.push(`PL[${snapshot.nextPlayer === 1 ? 'B' : 'W'}]`)

  return `(;${properties.join('')})`
}

export function createPositionSnapshotAdapter(sabaki: SabakiLike): PositionSnapshotAdapter {
  function getDocStore(): DocumentStoreLike {
    return sabaki.getPlayServices().documentStore
  }

  function captureAtPosition(treePosition: string): PositionSnapshot {
    let docStore = getDocStore()
    let board = docStore.getBoard(treePosition)
    let snapshot = createSnapshotFromBoard(board, board?.nextPlayer ?? 1)

    let positionSgf = snapshot ? boardToSgf(snapshot) : ''
    let positionHash = snapshot ? (getSnapshotSignature(snapshot) ?? '') : ''

    return {
      positionSgf,
      sideToMove: snapshot?.nextPlayer === 1 ? 'black' : 'white',
      treePosition,
      moveNumber: docStore.getMoveNumber(treePosition),
      positionHash,
    }
  }

  return {
    captureCurrentPosition() {
      let treePosition = sabaki.state.treePosition
      return captureAtPosition(treePosition)
    },

    captureBeforeMove(moveIndex: number): PositionSnapshot {
      // Navigate to the position before the given move index
      // Phase 0: returns current position; full implementation in Phase 2
      return this.captureCurrentPosition()
    },

    captureAfterMove(moveIndex: number): PositionSnapshot {
      // Navigate to the position after the given move index
      // Phase 0: returns current position; full implementation in Phase 2
      return this.captureCurrentPosition()
    },
  }
}
