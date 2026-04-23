import {fromDimensions as newBoard} from '@sabaki/go-board'
import sgf from '@sabaki/sgf'

import * as gametree from './gametree.js'
import * as helper from './helper.js'

export const STUDY_BASELINE_PROP = 'SBBL'
export const STUDY_KEYPOINTS_PROP = 'SBKP'

export function cloneSnapshot(snapshot) {
  if (snapshot == null) return null

  return {
    width: snapshot.width,
    height: snapshot.height,
    nextPlayer: snapshot.nextPlayer,
    signMap: helper.cloneMatrix(snapshot.signMap),
  }
}

export function createSnapshotFromBoard(board, nextPlayer = 1) {
  if (board == null) return null

  return {
    width: board.width,
    height: board.height,
    nextPlayer,
    signMap: helper.cloneMatrix(board.signMap),
  }
}

export function serializeSnapshot(snapshot) {
  if (snapshot == null) return null
  return JSON.stringify(cloneSnapshot(snapshot))
}

export function getSnapshotSignature(snapshot) {
  return serializeSnapshot(snapshot)
}

export function deserializeSnapshot(raw) {
  if (raw == null || raw === '') return null

  try {
    let parsed = JSON.parse(raw)
    if (
      parsed == null ||
      !Number.isInteger(parsed.width) ||
      !Number.isInteger(parsed.height) ||
      !Array.isArray(parsed.signMap)
    ) {
      return null
    }

    let width = parsed.width
    let height = parsed.height
    if (
      width <= 1 ||
      height <= 1 ||
      parsed.signMap.length !== height ||
      parsed.signMap.some((row) => !Array.isArray(row) || row.length !== width)
    ) {
      return null
    }

    return {
      width,
      height,
      nextPlayer: parsed.nextPlayer === -1 ? -1 : 1,
      signMap: parsed.signMap.map((row) =>
        row.map((value) => {
          let sign = Number(value)
          return sign > 0 ? 1 : sign < 0 ? -1 : 0
        }),
      ),
    }
  } catch (err) {
    return null
  }
}

export function serializeKeyPoints(vertices) {
  if (!Array.isArray(vertices)) return null
  return JSON.stringify(vertices)
}

export function deserializeKeyPoints(raw) {
  if (raw == null || raw === '') return []

  try {
    let parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(
        (vertex) =>
          Array.isArray(vertex) &&
          vertex.length === 2 &&
          Number.isInteger(vertex[0]) &&
          Number.isInteger(vertex[1]),
      )
      .map(([x, y]) => [x, y])
  } catch (err) {
    return []
  }
}

export function boardFromSnapshot(snapshot) {
  if (snapshot == null) return null

  let board = newBoard(snapshot.width, snapshot.height)

  for (let y = 0; y < snapshot.height; y++) {
    for (let x = 0; x < snapshot.width; x++) {
      board.set([x, y], snapshot.signMap[y][x])
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

export function getSnapshotPlayer(snapshot, moves = []) {
  if (snapshot == null) return 1
  return moves.length % 2 === 0 ? snapshot.nextPlayer : -snapshot.nextPlayer
}

export function applyMovesToSnapshot(snapshot, moves = []) {
  if (snapshot == null) return null

  let board = boardFromSnapshot(snapshot)
  let sign = getSnapshotPlayer(snapshot, [])

  for (let move of moves) {
    board = board.makeMove(sign, move)
    sign = -sign
  }

  return createSnapshotFromBoard(board, sign)
}

export function getTrialStartSnapshot(referenceSnapshot, baselineSnapshot) {
  return cloneSnapshot(referenceSnapshot ?? baselineSnapshot)
}

export function hasMeaningfulTrialSnapshotChange(
  trialSnapshot,
  referenceSnapshot,
  baselineSnapshot,
) {
  let startSnapshot = referenceSnapshot ?? baselineSnapshot
  return (
    trialSnapshot != null &&
    startSnapshot != null &&
    getSnapshotSignature(trialSnapshot) !== getSnapshotSignature(startSnapshot)
  )
}

export function snapshotMatchesBoard(snapshot, board, nextPlayer) {
  if (snapshot == null || board == null) return false
  if (snapshot.width !== board.width || snapshot.height !== board.height) {
    return false
  }

  if (snapshot.nextPlayer !== nextPlayer) return false
  return helper.equals(snapshot.signMap, board.signMap)
}

export function snapshotToGameTree(snapshot, moves = []) {
  if (snapshot == null) return null

  let tree = gametree.new()
  let treePosition = tree.root.id
  let size =
    snapshot.width === snapshot.height
      ? snapshot.width.toString()
      : [snapshot.width, snapshot.height].join(':')

  tree = tree.mutate((draft) => {
    draft.updateProperty(draft.root.id, 'SZ', [size])
    draft.updateProperty(
      draft.root.id,
      'PL',
      [snapshot.nextPlayer > 0 ? 'B' : 'W'],
    )

    for (let y = 0; y < snapshot.height; y++) {
      for (let x = 0; x < snapshot.width; x++) {
        let sign = snapshot.signMap[y][x]
        if (sign === 0) continue

        draft.addToProperty(
          draft.root.id,
          sign > 0 ? 'AB' : 'AW',
          sgf.stringifyVertex([x, y]),
        )
      }
    }

    let sign = snapshot.nextPlayer
    for (let move of moves) {
      treePosition = draft.appendNode(treePosition, {
        [sign > 0 ? 'B' : 'W']: [sgf.stringifyVertex(move)],
      })
      sign = -sign
    }
  })

  return {tree, treePosition}
}

export function diffSnapshots(referenceSnapshot, targetSnapshot) {
  if (referenceSnapshot == null || targetSnapshot == null) return null
  if (
    referenceSnapshot.width !== targetSnapshot.width ||
    referenceSnapshot.height !== targetSnapshot.height
  ) {
    return null
  }

  let addedBlack = []
  let addedWhite = []
  let cleared = []

  for (let y = 0; y < referenceSnapshot.height; y++) {
    for (let x = 0; x < referenceSnapshot.width; x++) {
      let before = referenceSnapshot.signMap[y][x]
      let after = targetSnapshot.signMap[y][x]
      if (before === after) continue

      if (before !== 0) {
        cleared.push([x, y])
      }

      if (after > 0) {
        addedBlack.push([x, y])
      } else {
        if (after < 0) {
          addedWhite.push([x, y])
        }
      }
    }
  }

  return {
    addedBlack,
    addedWhite,
    cleared,
    nextPlayerChanged:
      referenceSnapshot.nextPlayer !== targetSnapshot.nextPlayer
        ? targetSnapshot.nextPlayer
        : null,
  }
}

export function buildKeyPointMarkerMap(board, keyPoints = []) {
  if (board == null) return null

  let markerMap = board.signMap.map((row) => row.map(() => null))

  keyPoints.forEach(([x, y], index) => {
    if (markerMap[y] == null) return
    markerMap[y][x] = {
      type: 'label',
      label: `${index + 1}`,
    }
  })

  return markerMap
}

export function buildKeyPointOwnershipMetrics(
  keyPoints = [],
  baselineOwnership,
  targetOwnership,
) {
  if (!Array.isArray(keyPoints)) return []

  return keyPoints
    .map(([x, y], index) => {
      let baseline = baselineOwnership?.[y]?.[x]
      let target = targetOwnership?.[y]?.[x]
      if (![baseline, target].every(Number.isFinite)) return null

      return {
        index: index + 1,
        vertex: [x, y],
        baseline,
        target,
        delta: target - baseline,
      }
    })
    .filter((metric) => metric != null)
}

export function summarizeKeyPointOwnershipMetrics(metrics = []) {
  let summary = {
    blackGain: {sum: 0, intersections: 0},
    whiteGain: {sum: 0, intersections: 0},
  }

  for (let metric of metrics) {
    if (metric.delta > 0) {
      summary.blackGain.sum += metric.delta
      summary.blackGain.intersections += 1
    } else if (metric.delta < 0) {
      summary.whiteGain.sum += Math.abs(metric.delta)
      summary.whiteGain.intersections += 1
    }
  }

  return {
    blackGain: {
      sum: Math.round(summary.blackGain.sum * 100) / 100,
      intersections: summary.blackGain.intersections,
    },
    whiteGain: {
      sum: Math.round(summary.whiteGain.sum * 100) / 100,
      intersections: summary.whiteGain.intersections,
    },
  }
}

export function getStudyTerritoryDeltaMap(
  studyPhase,
  baselineOwnership,
  trialOwnership,
  trialDirty = false,
) {
  if (
    studyPhase !== 'trial' ||
    baselineOwnership == null ||
    trialOwnership == null ||
    !trialDirty
  ) {
    return null
  }

  return helper.getOwnershipDelta(baselineOwnership, trialOwnership)
}
