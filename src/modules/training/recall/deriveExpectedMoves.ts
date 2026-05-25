/**
 * Pure function: derive expected moves from an attempt based on RecallPolicy.
 *
 * Architecture v0.5 section 5.8:
 *   - fullLine: return all userLine moves with indexes [0..N-1]
 *   - humanMovesOnly: filter to moveActors[i].actor === 'human'
 *   - sideToMoveOnly: filter by sideToMove color (moveIndex % 2)
 *
 * Fallback rules:
 *   - humanMovesOnly with no moveActors -> degrades to fullLine
 *   - sideToMoveOnly with no sideToMove -> degrades to fullLine
 */

import type { RecallPolicy } from '../types/recall'

type AttemptLike = {
  userLine: string[]
  moveActors?: { moveIndex: number; actor: 'human' | 'ai' }[]
}

export function deriveExpectedMoves(
  policy: RecallPolicy,
  attempt: AttemptLike,
  sideToMove?: 'black' | 'white',
): { expectedMoves: string[]; expectedMoveIndexes: number[] } {
  const { userLine, moveActors } = attempt

  // fullLine: return everything
  if (policy === 'fullLine') {
    return fullLineResult(userLine)
  }

  // humanMovesOnly: filter by actor
  if (policy === 'humanMovesOnly') {
    if (!moveActors) {
      // Degrade to fullLine when moveActors unavailable
      return fullLineResult(userLine)
    }
    const filtered = filterByActor(userLine, moveActors, 'human')
    return filtered
  }

  // sideToMoveOnly: filter by color parity
  if (policy === 'sideToMoveOnly') {
    if (!sideToMove) {
      // Degrade to fullLine when sideToMove unavailable
      return fullLineResult(userLine)
    }
    const filtered = filterBySideToMove(userLine, sideToMove)
    return filtered
  }

  // Unknown policy: treat as fullLine
  return fullLineResult(userLine)
}

function fullLineResult(userLine: string[]): { expectedMoves: string[]; expectedMoveIndexes: number[] } {
  return {
    expectedMoves: [...userLine],
    expectedMoveIndexes: userLine.map((_, i) => i),
  }
}

function filterByActor(
  userLine: string[],
  moveActors: { moveIndex: number; actor: 'human' | 'ai' }[],
  targetActor: 'human' | 'ai',
): { expectedMoves: string[]; expectedMoveIndexes: number[] } {
  const expectedMoves: string[] = []
  const expectedMoveIndexes: number[] = []

  for (const ma of moveActors) {
    if (ma.actor === targetActor && ma.moveIndex < userLine.length) {
      expectedMoves.push(userLine[ma.moveIndex])
      expectedMoveIndexes.push(ma.moveIndex)
    }
  }

  return { expectedMoves, expectedMoveIndexes }
}

function filterBySideToMove(
  userLine: string[],
  sideToMove: 'black' | 'white',
): { expectedMoves: string[]; expectedMoveIndexes: number[] } {
  const expectedMoves: string[] = []
  const expectedMoveIndexes: number[] = []

  // sideToMove='black' => moveIndex % 2 === 0 are black moves
  // sideToMove='white' => moveIndex % 2 === 1 are white moves
  const targetRemainder = sideToMove === 'black' ? 0 : 1

  for (let i = 0; i < userLine.length; i++) {
    if (i % 2 === targetRemainder) {
      expectedMoves.push(userLine[i])
      expectedMoveIndexes.push(i)
    }
  }

  return { expectedMoves, expectedMoveIndexes }
}
