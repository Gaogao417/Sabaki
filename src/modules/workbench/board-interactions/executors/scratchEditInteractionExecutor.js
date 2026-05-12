import {
  placeBlackStone,
  placeWhiteStone,
  eraseWorkingStone,
  moveWorkingStone,
  setWorkingNextPlayer,
} from '../../working-position/index.js'

import {
  toggleMarker,
  toggleCoordLabel,
  toggleNumberLabel,
  setLabelMarker,
} from '../../working-position/workingPositionMarkers.js'

import {addLine} from '../../working-position/workingPositionLines.js'

const SUPPORTED_INTENTS = Object.freeze([
  'place-black-stone',
  'place-white-stone',
  'erase-stone',
  'drag-stone',
  'play-stone',
  'mark-point',
  'draw-line',
  'set-next-player',
  'capture-reference',
  'toggle-tab',
  'save-as-problem',
])

/**
 * @typedef {object} MarkerCell
 * @property {string} [label]
 * @property {string} type
 */

/**
 * @typedef {object} LineEntry
 * @property {number[]} v1
 * @property {number[]} v2
 * @property {string} type
 */

/**
 * Execute a scratch-edit intent against an edit workspace context.
 *
 * Returns an object describing what happened and what state changed.
 * The caller (sabaki.js or executeBoardInteraction) is responsible
 * for committing the returned state changes.
 *
 * @param {import('../intents.ts').BoardInteractionResult} result
 * @param {import('../../contracts/workspaceDefaults.ts').ScratchEditExecutionContext} context
 * @param {{invalidateEditAnalysis?: () => void, scheduleEditWorkspaceAnalysis?: (tab: string) => void}} [deps]
 * @returns {{
 *   handled: boolean,
 *   changed: boolean,
 *   reason?: string,
 *   tab?: string,
 *   snapshot?: object,
 *   markerMap?: (MarkerCell|null)[][],
 *   lines?: LineEntry[],
 *   lineFirstVertex?: {type: string, vertex: number[]} | null,
 *   newTab?: string,
 *   capturedSnapshot?: object,
 * }}
 */
export function executeScratchEdit(result, context, deps) {
  if (!SUPPORTED_INTENTS.includes(result.intent)) {
    return {handled: false, changed: false, reason: `unsupported intent: ${result.intent}`}
  }

  // --- Intents that do not need a snapshot ---

  if (result.intent === 'save-as-problem') {
    return {handled: true, changed: false, reason: 'save-as-problem: delegated to caller'}
  }

  if (result.intent === 'set-next-player') {
    let tab = context.activeTab ?? 'current'
    let snapshot =
      tab === 'reference' ? context.referenceSnapshot : context.currentSnapshot
    if (snapshot == null) {
      return {handled: false, changed: false, reason: 'no active snapshot'}
    }
    let sign = result.payload.sign
    let updated = setWorkingNextPlayer(snapshot, sign)
    if (deps?.invalidateEditAnalysis) deps.invalidateEditAnalysis()
    if (deps?.scheduleEditWorkspaceAnalysis) deps.scheduleEditWorkspaceAnalysis(tab)
    return {handled: true, changed: true, tab, snapshot: updated}
  }

  if (result.intent === 'capture-reference') {
    return executeCaptureReference(result, context, deps)
  }

  if (result.intent === 'toggle-tab') {
    let targetTab = result.payload.tab
    if (targetTab !== 'current' && targetTab !== 'reference') {
      return {handled: false, changed: false, reason: `invalid tab: ${targetTab}`}
    }
    if (targetTab === 'reference' && context.referenceSnapshot == null) {
      return {handled: false, changed: false, reason: 'no reference snapshot'}
    }
    if (deps?.scheduleEditWorkspaceAnalysis) deps.scheduleEditWorkspaceAnalysis(targetTab)
    return {handled: true, changed: true, tab: targetTab, newTab: targetTab}
  }

  // --- Intents that need a snapshot ---

  let tab = context.activeTab ?? 'current'
  let snapshot =
    tab === 'reference' ? context.referenceSnapshot : context.currentSnapshot

  if (snapshot == null) {
    return {handled: false, changed: false, reason: 'no active snapshot'}
  }

  let vertex = result.payload.vertex
  let [x, y] = vertex
  let updated

  switch (result.intent) {
    case 'place-black-stone': {
      if (result.payload.action === 'remove') {
        updated = eraseWorkingStone(snapshot, vertex)
      } else {
        updated = placeBlackStone(snapshot, vertex)
      }
      break
    }

    case 'place-white-stone': {
      if (result.payload.action === 'remove') {
        updated = eraseWorkingStone(snapshot, vertex)
      } else {
        updated = placeWhiteStone(snapshot, vertex)
      }
      break
    }

    case 'erase-stone': {
      if (snapshot.signMap[y][x] === 0) {
        return {handled: true, changed: false, reason: 'already empty'}
      }
      updated = eraseWorkingStone(snapshot, vertex)
      break
    }

    case 'drag-stone': {
      let source = result.payload.source
      let target = result.payload.target ?? result.payload.vertex
      let [sx, sy] = source
      let [tx, ty] = target

      if (sx === tx && sy === ty) {
        return {handled: true, changed: false, reason: 'same source and target'}
      }

      if ((snapshot.signMap[sy]?.[sx] ?? 0) === 0) {
        return {handled: true, changed: false, reason: 'empty source'}
      }

      if ((snapshot.signMap[ty]?.[tx] ?? 0) !== 0) {
        return {handled: true, changed: false, reason: 'occupied target'}
      }

      updated = moveWorkingStone(snapshot, source, target)
      break
    }

    case 'play-stone': {
      if (snapshot.signMap[y][x] !== 0) {
        return {handled: true, changed: false, reason: 'occupied point'}
      }
      let sign = snapshot.nextPlayer
      updated = sign > 0
        ? placeBlackStone(snapshot, vertex)
        : placeWhiteStone(snapshot, vertex)
      updated = setWorkingNextPlayer(updated, -sign)
      break
    }

    case 'mark-point': {
      return executeMarkPoint(result, context, tab)
    }

    case 'draw-line': {
      return executeDrawLine(result, context, tab)
    }
  }

  if (deps?.invalidateEditAnalysis) deps.invalidateEditAnalysis()
  if (deps?.scheduleEditWorkspaceAnalysis) deps.scheduleEditWorkspaceAnalysis(tab)

  return {handled: true, changed: true, tab, snapshot: updated}
}

// --- Marker sub-executor ---

function executeMarkPoint(result, context, tab) {
  let markerKey = tab === 'reference' ? 'referenceMarkerMap' : 'currentMarkerMap'
  let markerMap = context[markerKey]
  if (markerMap == null) {
    return {handled: false, changed: false, reason: 'no marker map for active tab'}
  }

  let {markerType, vertex, label} = result.payload
  let updated

  if (label != null) {
    updated = setLabelMarker(markerMap, vertex, label)
  } else if (markerType === 'label') {
    let snapshot =
      tab === 'reference' ? context.referenceSnapshot : context.currentSnapshot
    updated = toggleCoordLabel(markerMap, vertex, snapshot.height)
  } else if (markerType === 'number') {
    updated = toggleNumberLabel(markerMap, vertex)
  } else {
    // cross, triangle, square, circle
    updated = toggleMarker(markerMap, vertex, markerType)
  }

  return {handled: true, changed: true, tab, markerMap: updated}
}

// --- Line sub-executor ---

function executeDrawLine(result, context, tab) {
  let linesKey = tab === 'reference' ? 'referenceLines' : 'currentLines'
  let lines = context[linesKey] ?? []
  let {lineType, vertex} = result.payload

  // Two-click operation: first click stores the vertex, second click completes the line
  if (context.lineFirstVertex == null || context.lineFirstVertex.type !== lineType) {
    // First click: store the vertex
    return {
      handled: true,
      changed: false,
      tab,
      lineFirstVertex: {type: lineType, vertex},
    }
  }

  // Second click: create the line
  let v1 = context.lineFirstVertex.vertex
  let v2 = vertex
  let updated = addLine(lines, v1, v2, lineType)

  return {
    handled: true,
    changed: true,
    tab,
    lines: updated,
    lineFirstVertex: null,
  }
}

// --- Capture reference sub-executor ---

function executeCaptureReference(result, context, deps) {
  let sourceTab = context.activeTab ?? 'current'
  // If on reference tab, copy reference -> current; otherwise current -> reference
  let targetTab = sourceTab === 'reference' ? 'current' : 'reference'

  let sourceSnapshot =
    sourceTab === 'reference' ? context.referenceSnapshot : context.currentSnapshot
  if (sourceSnapshot == null) {
    return {handled: false, changed: false, reason: 'no source snapshot for capture'}
  }

  // Clone the source snapshot as the new target snapshot
  // The caller (sabaki.js) will assign the new id, role, and clear analysis/ownership/markers/lines
  // Here we just return the cloned snapshot and indicate the target tab
  let captured = {...sourceSnapshot}

  if (deps?.scheduleEditWorkspaceAnalysis) deps.scheduleEditWorkspaceAnalysis(targetTab)

  return {
    handled: true,
    changed: true,
    tab: targetTab,
    capturedSnapshot: captured,
  }
}
