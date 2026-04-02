import assert from 'assert'
import {fromDimensions as newBoard} from '@sabaki/go-board'

import {
  applyMovesToSnapshot,
  buildKeyPointOwnershipMetrics,
  cloneSnapshot,
  createSnapshotFromBoard,
  deserializeKeyPoints,
  deserializeSnapshot,
  serializeKeyPoints,
  serializeSnapshot,
  snapshotMatchesBoard,
} from '../src/modules/study.js'

describe('study', () => {
  it('serializes and deserializes snapshots', () => {
    let board = newBoard(5, 5)
    board.set([1, 1], 1)
    board.set([2, 2], -1)

    let snapshot = createSnapshotFromBoard(board, -1)
    let roundTrip = deserializeSnapshot(serializeSnapshot(snapshot))

    assert.deepEqual(roundTrip, snapshot)
    assert.notEqual(cloneSnapshot(snapshot), snapshot)
  })

  it('serializes key points', () => {
    let keyPoints = [
      [3, 3],
      [10, 10],
    ]

    assert.deepEqual(deserializeKeyPoints(serializeKeyPoints(keyPoints)), keyPoints)
  })

  it('applies moves to a baseline snapshot', () => {
    let board = newBoard(5, 5)
    let snapshot = createSnapshotFromBoard(board, 1)
    let trial = applyMovesToSnapshot(snapshot, [
      [0, 0],
      [1, 0],
    ])

    assert.equal(trial.signMap[0][0], 1)
    assert.equal(trial.signMap[0][1], -1)
    assert.equal(trial.nextPlayer, 1)
  })

  it('compares snapshots to live boards', () => {
    let board = newBoard(5, 5)
    board.set([0, 0], 1)
    let snapshot = createSnapshotFromBoard(board, -1)

    assert.equal(snapshotMatchesBoard(snapshot, board, -1), true)
    assert.equal(snapshotMatchesBoard(snapshot, board, 1), false)
  })

  it('builds key point ownership metrics', () => {
    let metrics = buildKeyPointOwnershipMetrics(
      [
        [0, 0],
        [1, 1],
      ],
      [
        [0.5, 0],
        [0, -0.4],
      ],
      [
        [0.7, 0],
        [0, -0.1],
      ],
    )

    assert.deepEqual(metrics, [
      {index: 1, vertex: [0, 0], baseline: 0.5, target: 0.7, delta: 0.2},
      {index: 2, vertex: [1, 1], baseline: -0.4, target: -0.1, delta: 0.3},
    ])
  })
})
