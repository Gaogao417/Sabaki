import assert from 'assert'
import {fromDimensions as newBoard} from '@sabaki/go-board'

import {
  applyMovesToSnapshot,
  buildKeyPointOwnershipMetrics,
  cloneSnapshot,
  createSnapshotFromBoard,
  deserializeKeyPoints,
  deserializeSnapshot,
  diffSnapshots,
  getTrialStartSnapshot,
  getStudyTerritoryDeltaMap,
  getSnapshotSignature,
  hasMeaningfulTrialSnapshotChange,
  serializeKeyPoints,
  serializeSnapshot,
  snapshotMatchesBoard,
} from '../src/modules/study.js'

function roundMetrics(metrics) {
  return metrics.map((metric) => ({
    ...metric,
    delta: Math.round(metric.delta * 100) / 100,
  }))
}

function roundMatrix(matrix) {
  return matrix.map((row) => row.map((value) => Math.round(value * 100) / 100))
}

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

    assert.deepEqual(
      deserializeKeyPoints(serializeKeyPoints(keyPoints)),
      keyPoints,
    )
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

  it('starts trial snapshots from the study reference when present', () => {
    let referenceBoard = newBoard(5, 5)
    referenceBoard.set([0, 0], 1)
    let baselineBoard = newBoard(5, 5)
    baselineBoard.set([1, 1], -1)

    let referenceSnapshot = createSnapshotFromBoard(referenceBoard, 1)
    let baselineSnapshot = createSnapshotFromBoard(baselineBoard, -1)
    let trialStart = getTrialStartSnapshot(referenceSnapshot, baselineSnapshot)

    assert.deepEqual(trialStart, referenceSnapshot)
    assert.notEqual(trialStart, referenceSnapshot)
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

    assert.deepEqual(roundMetrics(metrics), [
      {index: 1, vertex: [0, 0], baseline: 0.5, target: 0.7, delta: 0.2},
      {index: 2, vertex: [1, 1], baseline: -0.4, target: -0.1, delta: 0.3},
    ])
  })

  it('only computes study territory diff for active trial moves', () => {
    let baselineOwnership = [[0.2, -0.3]]
    let trialOwnership = [[0.5, -0.1]]

    assert.equal(
      getStudyTerritoryDeltaMap(
        'trial',
        baselineOwnership,
        trialOwnership,
        false,
      ),
      null,
    )

    assert.deepEqual(
      roundMatrix(
        getStudyTerritoryDeltaMap(
          'trial',
          baselineOwnership,
          trialOwnership,
          true,
        ),
      ),
      [[0.3, 0.2]],
    )
  })

  it('creates stable snapshot signatures', () => {
    let board = newBoard(5, 5)
    board.set([2, 2], 1)
    let snapshot = createSnapshotFromBoard(board, -1)

    assert.equal(getSnapshotSignature(snapshot), serializeSnapshot(snapshot))
  })

  it('treats trial changes as meaningful only when they differ from reference', () => {
    let referenceBoard = newBoard(5, 5)
    referenceBoard.set([0, 0], 1)
    let baselineBoard = newBoard(5, 5)
    baselineBoard.set([1, 1], -1)

    let referenceSnapshot = createSnapshotFromBoard(referenceBoard, 1)
    let baselineSnapshot = createSnapshotFromBoard(baselineBoard, -1)

    assert.equal(
      hasMeaningfulTrialSnapshotChange(
        cloneSnapshot(referenceSnapshot),
        referenceSnapshot,
        baselineSnapshot,
      ),
      false,
    )

    let changedTrialSnapshot = cloneSnapshot(referenceSnapshot)
    changedTrialSnapshot.signMap[0][1] = -1
    changedTrialSnapshot.nextPlayer = -1

    assert.equal(
      hasMeaningfulTrialSnapshotChange(
        changedTrialSnapshot,
        referenceSnapshot,
        baselineSnapshot,
      ),
      true,
    )
  })

  it('diffs snapshots for setup-node fallbacks', () => {
    let start = createSnapshotFromBoard(newBoard(5, 5), 1)
    let end = cloneSnapshot(start)
    end.signMap[0][0] = 1
    end.signMap[1][1] = -1
    end.nextPlayer = -1

    assert.deepEqual(diffSnapshots(start, end), {
      addedBlack: [[0, 0]],
      addedWhite: [[1, 1]],
      cleared: [],
      nextPlayerChanged: -1,
    })
  })

  it('clears replaced stones when diffing snapshots', () => {
    let board = newBoard(5, 5)
    board.set([0, 0], 1)
    let start = createSnapshotFromBoard(board, 1)
    let end = cloneSnapshot(start)
    end.signMap[0][0] = -1

    assert.deepEqual(diffSnapshots(start, end), {
      addedBlack: [],
      addedWhite: [[0, 0]],
      cleared: [[0, 0]],
      nextPlayerChanged: null,
    })
  })
})
